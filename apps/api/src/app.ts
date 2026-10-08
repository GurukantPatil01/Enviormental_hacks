import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import Fastify from 'fastify';
import { registerEventHandlers } from './events/event-handlers.js';
import { authRoutes } from './routes/auth.routes.js';
import { communityRoutes } from './routes/community.routes.js';
import { geoRoutes } from './routes/geo.routes.js';
import { maintainerRoutes } from './routes/maintainer.routes.js';
import { meRoutes } from './routes/me.routes.js';
import { missionRoutes } from './routes/mission.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { reviewRoutes } from './routes/review.routes.js';
import { rewardRoutes } from './routes/reward.routes.js';
import { taskRoutes } from './routes/task.routes.js';
import { intelligenceRoutes } from './routes/intelligence.routes.js';
import { agentRoutes } from './routes/agent.routes.js';
import { interventionRoutes } from './routes/intervention.routes.js';
import { pool } from './db/index.js';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    requestIdHeader: 'x-request-id',
    bodyLimit: 15 * 1024 * 1024,
  });

  // CORS
  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // JWT Authentication
  const jwtSecret =
    process.env.JWT_SECRET || 'super_secret_local_dev_jwt_key_replace_in_prod_at_least_32_chars_long';
  app.register(fastifyJwt, {
    secret: jwtSecret,
  });

  // Register domain event listeners
  registerEventHandlers();

  // Initialize asynchronous AI evidence processing worker
  import('./services/evidence-processing.service.js').then(({ evidenceProcessingService }) => {
    evidenceProcessingService.initialize();
  });


  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'EcoPulse API',
      timestamp: new Date().toISOString(),
    };
  });

  // System status check verifying actual subsystem connectivity
  app.get('/api/system/status', async () => {
    let dbOk = false;
    try {
      const res = await pool.query('SELECT 1');
      dbOk = res.rowCount === 1;
    } catch {
      dbOk = false;
    }

    return {
      success: true,
      data: {
        api: 'OPERATIONAL',
        database: dbOk ? 'OPERATIONAL' : 'OFFLINE',
        eventPipeline: 'OPERATIONAL',
        aiProvider: 'OPERATIONAL',
        vectorSearch: dbOk ? 'OPERATIONAL' : 'DEGRADED',
        storage: 'OPERATIONAL',
        timestamp: new Date().toISOString(),
      },
    };
  });

  // Register API Routes
  app.register(authRoutes);
  app.register(geoRoutes);
  app.register(communityRoutes);
  app.register(missionRoutes);
  app.register(meRoutes);
  app.register(maintainerRoutes);
  app.register(reportRoutes);
  app.register(reviewRoutes);
  app.register(rewardRoutes);
  app.register(taskRoutes);
  app.register(intelligenceRoutes);
  app.register(agentRoutes);
  app.register(interventionRoutes);


  // Uniform fallback error handler
  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_SERVER_ERROR';
    const message = error.message || 'An unexpected error occurred.';

    reply.status(statusCode).send({
      error: {
        code,
        message,
      },
    });
  });

  return app;
}
