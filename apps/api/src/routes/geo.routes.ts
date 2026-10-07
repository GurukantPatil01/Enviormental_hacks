import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { geoService } from '../services/geo.service.js';

const resolveLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const joinClusterSchema = z.object({}).passthrough();

export async function geoRoutes(app: FastifyInstance) {
  // Geographic hierarchy browsing (public — no PII)
  app.get('/geo/cities', async (_request, reply) => {
    const cities = await geoService.listCities();
    return reply.send({ data: cities });
  });

  app.get<{ Params: { cityId: string } }>('/geo/cities/:cityId/wards', async (request, reply) => {
    const wards = await geoService.listWards(request.params.cityId);
    return reply.send({ data: wards });
  });

  app.get<{ Querystring: { communityId?: string } }>(
    '/geo/clusters',
    async (request, reply) => {
      const clusters = await geoService.listClusters(request.query.communityId);
      return reply.send({ data: clusters });
    }
  );

  // Resolve coordinates to city/ward/cluster (auth: membership context)
  app.post('/geo/resolve-location', { preHandler: [authenticate] }, async (request, reply) => {
      const parsed = resolveLocationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid coordinates.',
            details: parsed.error.flatten(),
          },
        });
      }
      const resolved = await geoService.resolveLocation(parsed.data.lat, parsed.data.lng);
      return reply.send({ data: resolved });
  });

  // Map overview for a viewport
  app.get<{ Querystring: { minLat?: string; maxLat?: string; minLng?: string; maxLng?: string } }>(
    '/map/overview',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const q = request.query;
      const parsed = z
        .object({
          minLat: z.coerce.number().min(-90).max(90),
          maxLat: z.coerce.number().min(-90).max(90),
          minLng: z.coerce.number().min(-180).max(180),
          maxLng: z.coerce.number().min(-180).max(180),
        })
        .safeParse({
          minLat: q.minLat ?? 18.4,
          maxLat: q.maxLat ?? 18.62,
          minLng: q.minLng ?? 73.72,
          maxLng: q.maxLng ?? 73.95,
        });

      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid viewport.' },
        });
      }

      const overview = await geoService.mapOverview(parsed.data);
      return reply.send({ data: overview });
    }
  );
  // Cluster detail (public intelligence, no member PII)
  app.get<{ Params: { id: string }; Querystring: { history?: string } }>(
    '/clusters/:id',
    async (request, reply) => {
      try {
        const detail = await geoService.getClusterDetail(request.params.id, {
          includeHistory: request.query.history === 'true',
        });
        return reply.send({ data: detail });
      } catch (err: any) {
        return reply
          .status(err.statusCode || 500)
          .send({ error: { code: err.code || 'CLUSTER_ERROR', message: err.message } });
      }
    }
  );

  // Join a cluster as the user's primary geographic community
  app.post<{ Params: { id: string } }>(
    '/clusters/:id/join',
    { preHandler: [authenticate] },
    async (request, reply) => {
      joinClusterSchema.parse(request.body || {});
      try {
        const cluster = await geoService.joinCluster(request.params.id, request.user!.id);
        return reply.send({ data: { success: true, cluster } });
      } catch (err: any) {
        return reply
          .status(err.statusCode || 500)
          .send({ error: { code: err.code || 'JOIN_CLUSTER_FAILED', message: err.message } });
      }
    }
  );

  // The caller's primary cluster
  app.get('/me/cluster', { preHandler: [authenticate] }, async (request, reply) => {
      const cluster = await geoService.getUserPrimaryCluster(request.user!.id);
      return reply.send({ data: cluster });
  });
}
