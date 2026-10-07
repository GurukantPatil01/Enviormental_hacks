import { assignTaskSchema, createTaskSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { taskService } from '../services/task.service.js';

export async function taskRoutes(app: FastifyInstance) {
  // 1. List tasks
  app.get<{
    Querystring: {
      communityId?: string;
      assignedTo?: string;
      status?: string;
      reportId?: string;
    };
  }>('/tasks', { preHandler: [authenticate] }, async (request, reply) => {
    const { communityId, assignedTo, status, reportId } = request.query;
    const list = await taskService.listTasks({
      communityId,
      assignedTo,
      status: status as any,
      reportId,
    });
    return reply.send({ data: list });
  });

  // 2. Create task (Maintainers/Admins)
  app.post(
    '/tasks',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      const parsed = createTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task data',
            details: parsed.error.format(),
          },
        });
      }

      const task = await taskService.createTask({
        communityId: parsed.data.communityId,
        reportId: parsed.data.reportId,
        assignedTo: parsed.data.assignedTo,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate,
        actorId: request.user!.id,
      });

      return reply.status(201).send({ data: task });
    }
  );

  // 3. Get task by ID
  app.get<{ Params: { id: string } }>('/tasks/:id', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const task = await taskService.getTask(request.params.id);
      return reply.send({ data: task });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'TASK_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 4. Assign task (Maintainers/Admins)
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/assign',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      const parsed = assignTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid assignment payload',
            details: parsed.error.format(),
          },
        });
      }

      try {
        const task = await taskService.assignTask(request.params.id, parsed.data.assignedTo, request.user!.id);
        return reply.send({ data: task });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'TASK_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 5. Complete task
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/complete',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const task = await taskService.completeTask(request.params.id, request.user!.id);
        return reply.send({ data: task });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'TASK_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 6. Verify task (Maintainers/Admins)
  app.post<{ Params: { id: string } }>(
    '/tasks/:id/verify',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      try {
        const task = await taskService.verifyTask(request.params.id, request.user!.id);
        return reply.send({ data: task });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'TASK_ERROR',
            message: err.message,
          },
        });
      }
    }
  );
}
