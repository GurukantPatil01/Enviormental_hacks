import { loginSchema, registerSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { authService } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input',
          details: parseResult.error.flatten(),
        },
      });
    }

    try {
      const result = await authService.register(parseResult.data, app);
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'REGISTRATION_FAILED',
          message: err.message,
        },
      });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login input',
          details: parseResult.error.flatten(),
        },
      });
    }

    try {
      const result = await authService.login(parseResult.data, app);
      return reply.send({ data: result });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'LOGIN_FAILED',
          message: err.message,
        },
      });
    }
  });

  app.get('/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await authService.getCurrentUser(request.user!.id);
    return reply.send({ data: { user } });
  });
}
