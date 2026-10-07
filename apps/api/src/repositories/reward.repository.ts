import type { Reward, RewardClaim, RewardPartner } from '@ecopulse/types';
import { pool } from '../db/index.js';

export class RewardRepository {
  async listRewards(category?: string): Promise<Reward[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT 
          r.id,
          r.partner_id AS "partnerId",
          rp.name AS "partnerName",
          rp.logo_url AS "partnerLogoUrl",
          r.title,
          r.description,
          r.category,
          r.cost_points AS "costPoints",
          r.discount_percent AS "discountPercent",
          r.discount_amount_inr AS "discountAmountInr",
          r.inventory_total AS "inventoryTotal",
          r.inventory_remaining AS "inventoryRemaining",
          r.redemption_instructions AS "redemptionInstructions",
          r.terms,
          r.status,
          r.valid_until AS "validUntil",
          r.created_at AS "createdAt"
        FROM rewards r
        JOIN reward_partners rp ON r.partner_id = rp.id
        WHERE r.status = 'ACTIVE' AND r.inventory_remaining > 0
      `;
      const params: any[] = [];
      if (category && category !== 'ALL') {
        params.push(category);
        query += ` AND r.category = $${params.length}`;
      }
      query += ` ORDER BY r.cost_points ASC, r.created_at DESC`;

      const res = await client.query(query, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async findRewardById(id: string): Promise<Reward | null> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `
        SELECT 
          r.id,
          r.partner_id AS "partnerId",
          rp.name AS "partnerName",
          rp.logo_url AS "partnerLogoUrl",
          r.title,
          r.description,
          r.category,
          r.cost_points AS "costPoints",
          r.discount_percent AS "discountPercent",
          r.discount_amount_inr AS "discountAmountInr",
          r.inventory_total AS "inventoryTotal",
          r.inventory_remaining AS "inventoryRemaining",
          r.redemption_instructions AS "redemptionInstructions",
          r.terms,
          r.status,
          r.valid_until AS "validUntil",
          r.created_at AS "createdAt"
        FROM rewards r
        JOIN reward_partners rp ON r.partner_id = rp.id
        WHERE r.id = $1
      `,
        [id]
      );
      return res.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async claimRewardAtomic(
    userId: string,
    rewardId: string,
    clientEventId: string,
    couponCode: string,
    expiresAt: Date
  ): Promise<{ claim: RewardClaim; newBalance: number; isDuplicate: boolean }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Check idempotency: If this client_event_id was already claimed, return existing claim
      const existingRes = await client.query(
        `
        SELECT 
          rc.id,
          rc.reward_id AS "rewardId",
          rc.user_id AS "userId",
          r.title AS "rewardTitle",
          r.category AS "rewardCategory",
          rp.name AS "partnerName",
          rc.client_event_id AS "clientEventId",
          rc.cost_points AS "costPoints",
          rc.coupon_code AS "couponCode",
          rc.status,
          rc.claimed_at AS "claimedAt",
          rc.used_at AS "usedAt",
          rc.expires_at AS "expiresAt",
          r.redemption_instructions AS "redemptionInstructions",
          rc.metadata
        FROM reward_claims rc
        JOIN rewards r ON rc.reward_id = r.id
        JOIN reward_partners rp ON r.partner_id = rp.id
        WHERE rc.client_event_id = $1
      `,
        [clientEventId]
      );

      if (existingRes.rows.length > 0) {
        // Fetch user balance
        const balanceRes = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0)::int AS balance FROM point_ledger WHERE user_id = $1`,
          [userId]
        );
        await client.query('COMMIT');
        return {
          claim: existingRes.rows[0],
          newBalance: balanceRes.rows[0].balance,
          isDuplicate: true,
        };
      }

      // 2. Lock reward row FOR UPDATE
      const rewardRes = await client.query(
        `SELECT * FROM rewards WHERE id = $1 FOR UPDATE`,
        [rewardId]
      );

      if (rewardRes.rows.length === 0) {
        throw Object.assign(new Error('Reward not found'), { statusCode: 404, code: 'REWARD_NOT_FOUND' });
      }

      const reward = rewardRes.rows[0];
      if (reward.status !== 'ACTIVE') {
        throw Object.assign(new Error('Reward is currently not active'), {
          statusCode: 400,
          code: 'REWARD_INACTIVE',
        });
      }

      if (reward.inventory_remaining <= 0) {
        throw Object.assign(new Error('This reward coupon is out of stock'), {
          statusCode: 400,
          code: 'OUT_OF_STOCK',
        });
      }

      // 3. Check user balance
      const balanceRes = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0)::int AS balance FROM point_ledger WHERE user_id = $1`,
        [userId]
      );
      const currentBalance = balanceRes.rows[0].balance;

      if (currentBalance < reward.cost_points) {
        throw Object.assign(
          new Error(
            `Insufficient EcoPoints. Required: ${reward.cost_points} pts, Current balance: ${currentBalance} pts.`
          ),
          {
            statusCode: 400,
            code: 'INSUFFICIENT_BALANCE',
            details: { required: reward.cost_points, current: currentBalance },
          }
        );
      }

      // 4. Insert reward claim
      const insertClaimRes = await client.query(
        `
        INSERT INTO reward_claims (
          reward_id,
          user_id,
          client_event_id,
          cost_points,
          coupon_code,
          status,
          expires_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, 'CLAIMED', $6, $7)
        RETURNING 
          id,
          reward_id AS "rewardId",
          user_id AS "userId",
          client_event_id AS "clientEventId",
          cost_points AS "costPoints",
          coupon_code AS "couponCode",
          status,
          claimed_at AS "claimedAt",
          expires_at AS "expiresAt",
          metadata
      `,
        [
          rewardId,
          userId,
          clientEventId,
          reward.cost_points,
          couponCode,
          expiresAt,
          JSON.stringify({ rewardTitle: reward.title, discountPercent: reward.discount_percent }),
        ]
      );

      const claim = insertClaimRes.rows[0];

      // 5. Decrement inventory
      await client.query(
        `UPDATE rewards SET inventory_remaining = inventory_remaining - 1, updated_at = NOW() WHERE id = $1`,
        [rewardId]
      );

      // 6. Record debit in authoritative immutable point ledger
      await client.query(
        `
        INSERT INTO point_ledger (
          user_id,
          source,
          reference_id,
          amount,
          type,
          client_event_id,
          metadata
        ) VALUES ($1, 'REWARD_REDEMPTION', $2, $3, 'DEBIT', $4, $5)
      `,
        [
          userId,
          claim.id,
          reward.cost_points,
          `debit_${clientEventId}`,
          JSON.stringify({ rewardId, couponCode, title: reward.title }),
        ]
      );

      await client.query('COMMIT');

      // Fetch partner name & title for rich return
      const partnerRes = await client.query(
        `SELECT r.title, r.category, rp.name as partner_name, r.redemption_instructions FROM rewards r JOIN reward_partners rp ON r.partner_id = rp.id WHERE r.id = $1`,
        [rewardId]
      );

      const enrichedClaim: RewardClaim = {
        ...claim,
        rewardTitle: partnerRes.rows[0]?.title,
        rewardCategory: partnerRes.rows[0]?.category,
        partnerName: partnerRes.rows[0]?.partner_name,
        redemptionInstructions: partnerRes.rows[0]?.redemption_instructions,
      };

      return {
        claim: enrichedClaim,
        newBalance: currentBalance - reward.cost_points,
        isDuplicate: false,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getUserClaims(userId: string): Promise<RewardClaim[]> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `
        SELECT 
          rc.id,
          rc.reward_id AS "rewardId",
          rc.user_id AS "userId",
          r.title AS "rewardTitle",
          r.category AS "rewardCategory",
          rp.name AS "partnerName",
          rc.client_event_id AS "clientEventId",
          rc.cost_points AS "costPoints",
          rc.coupon_code AS "couponCode",
          rc.status,
          rc.claimed_at AS "claimedAt",
          rc.used_at AS "usedAt",
          rc.expires_at AS "expiresAt",
          r.redemption_instructions AS "redemptionInstructions",
          rc.metadata
        FROM reward_claims rc
        JOIN rewards r ON rc.reward_id = r.id
        JOIN reward_partners rp ON r.partner_id = rp.id
        WHERE rc.user_id = $1
        ORDER BY rc.claimed_at DESC
      `,
        [userId]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }
}

export const rewardRepository = new RewardRepository();
