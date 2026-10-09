import path from 'node:path';
import dotenv from 'dotenv';
import { pool } from '../apps/api/src/db/index.js';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

async function clearReports() {
  console.log('\n============================================================');
  console.log('🧹 EcoPulse: Clearing All Incident Reports & Evidence');
  console.log('============================================================\n');

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Clear reviews tied to reports or evidence
      const revRes = await client.query(`
        DELETE FROM reviews 
        WHERE entity_type = 'REPORT' OR evidence_id IS NOT NULL
      `);
      console.log(`• Removed ${revRes.rowCount || 0} reviews`);

      // 2. Clear tasks tied to reports
      const taskRes = await client.query(`
        DELETE FROM tasks 
        WHERE report_id IS NOT NULL
      `);
      console.log(`• Removed ${taskRes.rowCount || 0} tasks linked to reports`);

      // 3. Clear evidence records
      const evRes = await client.query('DELETE FROM evidence');
      console.log(`• Removed ${evRes.rowCount || 0} evidence records`);

      // 4. Clear intervention outcomes and interventions
      const ioRes = await client.query('DELETE FROM intervention_outcomes');
      console.log(`• Removed ${ioRes.rowCount || 0} intervention outcomes`);

      const intRes = await client.query('DELETE FROM interventions');
      console.log(`• Removed ${intRes.rowCount || 0} interventions`);

      // 5. Clear hotspots
      const hotRes = await client.query('DELETE FROM hotspots');
      console.log(`• Removed ${hotRes.rowCount || 0} hotspots`);

      // 6. Clear AI observations & embeddings tied to environmental events
      const obsRes = await client.query('DELETE FROM ai_observations');
      console.log(`• Removed ${obsRes.rowCount || 0} AI observations`);

      const embRes = await client.query('DELETE FROM environmental_embeddings');
      console.log(`• Removed ${embRes.rowCount || 0} environmental embeddings`);

      // 7. Clear environmental events
      const eventRes = await client.query('DELETE FROM environmental_events');
      console.log(`• Removed ${eventRes.rowCount || 0} environmental events`);

      // 8. Clear citizen reports
      const repRes = await client.query('DELETE FROM reports');
      console.log(`• Removed ${repRes.rowCount || 0} citizen reports`);

      await client.query('COMMIT');

      console.log('\n============================================================');
      console.log('✅ ALL REPORTS & ASSOCIATED TELEMETRY SUCCESSFULLY CLEARED!');
      console.log('   Users, communities, wards, clusters, and missions remain intact.');
      console.log('============================================================\n');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('\n❌ Failed to clear reports:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearReports();
