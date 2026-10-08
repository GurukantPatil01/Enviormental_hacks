import { pool } from '../db/index.js';

export interface InsertEmbeddingOptions {
  eventId: string;
  provider: string;
  model: string;
  modality?: string;
  dimensions?: number;
  vector: number[];
}

export interface VectorSearchOptions {
  limit?: number;
  minSimilarity?: number;
  maxDistanceMeters?: number; // e.g. 2000 for 2 km
  centerLat?: number;
  centerLng?: number;
  wasteType?: string;
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface VectorSearchResult {
  eventId: string;
  similarity: number;
  distanceMeters?: number;
  event?: {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    status: string;
    source: string;
    timestamp: string;
  } | null;
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorRepository {
  async insertEmbedding(options: InsertEmbeddingOptions): Promise<string> {
    const res = await pool.query(
      `
      INSERT INTO environmental_embeddings (
        event_id, provider, model, modality, dimensions, vector
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        options.eventId,
        options.provider,
        options.model,
        options.modality || 'TEXT',
        options.dimensions || options.vector.length,
        JSON.stringify(options.vector),
      ]
    );

    return res.rows[0].id;
  }

  async searchSimilar(
    targetVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity ?? 0.5;

    // Fetch embeddings joined with environmental events
    const query = `
      SELECT 
        ee.event_id,
        ee.vector,
        ee.provider,
        ee.model,
        ev.id AS "eventId",
        ev.description,
        ev.latitude,
        ev.longitude,
        ev.status,
        ev.source,
        ev.timestamp
      FROM environmental_embeddings ee
      LEFT JOIN environmental_events ev ON ee.event_id = ev.id
      ORDER BY ee.created_at DESC
      LIMIT 100
    `;

    const res = await pool.query(query);
    const results: VectorSearchResult[] = [];

    for (const row of res.rows) {
      let storedVector: number[] = [];
      try {
        storedVector = typeof row.vector === 'string' ? JSON.parse(row.vector) : row.vector;
      } catch {
        continue;
      }

      if (!Array.isArray(storedVector) || storedVector.length === 0) continue;

      const similarity = cosineSimilarity(targetVector, storedVector);
      if (similarity < minSimilarity) continue;

      let distanceMeters: number | undefined;
      if (options.centerLat !== undefined && options.centerLng !== undefined && row.latitude && row.longitude) {
        distanceMeters = haversineDistanceMeters(
          options.centerLat,
          options.centerLng,
          Number(row.latitude),
          Number(row.longitude)
        );

        if (options.maxDistanceMeters !== undefined && distanceMeters > options.maxDistanceMeters) {
          continue; // Outside requested geographic radius
        }
      }

      results.push({
        eventId: row.event_id,
        similarity: Number(similarity.toFixed(4)),
        distanceMeters: distanceMeters !== undefined ? Math.round(distanceMeters) : undefined,
        event: row.eventId
          ? {
              id: row.eventId,
              description: row.description,
              latitude: Number(row.latitude),
              longitude: Number(row.longitude),
              status: row.status,
              source: row.source,
              timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
            }
          : null,
      });
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async deleteEmbedding(eventId: string): Promise<void> {
    await pool.query(`DELETE FROM environmental_embeddings WHERE event_id = $1`, [eventId]);
  }
}

export const vectorRepository = new VectorRepository();
