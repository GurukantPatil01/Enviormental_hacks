import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.middleware.js';
import { reportService } from '../services/report.service.js';
import { reviewService } from '../services/review.service.js';
import { taskService } from '../services/task.service.js';

export async function maintainerRoutes(app: FastifyInstance) {
  const maintainerGuard = { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] };

  // 1. Operations Overview summary
  app.get('/maintainer/operations', maintainerGuard, async (request, reply) => {
    const communityId = (request.query as any)?.communityId;

    const [reportsList, reviewsList, tasksList] = await Promise.all([
      reportService.listReports({ communityId }),
      reviewService.listReviews(),
      taskService.listTasks({ communityId }),
    ]);

    const openIncidents = reportsList.filter(
      (r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'
    );
    const activeTasks = tasksList.filter(
      (t) => t.status === 'CREATED' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS'
    );
    const resolvedToday = reportsList.filter((r) => {
      if (r.status !== 'RESOLVED' && r.status !== 'VERIFIED') return false;
      const today = new Date().toISOString().slice(0, 10);
      return r.updatedAt.slice(0, 10) === today;
    }).length;

    const highPriorityIncidents = openIncidents.filter(
      (r) => r.category === 'ILLEGAL_DUMPING' || r.category === 'WASTE_HOTSPOT'
    ).length;

    return reply.send({
      data: {
        status: 'ONLINE',
        operatorId: request.user!.id,
        openIncidentsCount: openIncidents.length,
        pendingReviewsCount: openIncidents.length, // Unreviewed submitted reports
        activeTasksCount: activeTasks.length,
        resolvedTodayCount: resolvedToday,
        communityPulseScore: 78,
        highPriorityIncidents,
      },
    });

  });

  // 2. Incident Queue
  app.get('/maintainer/incidents', maintainerGuard, async (request, reply) => {
    const communityId = (request.query as any)?.communityId;
    const incidents = await reportService.listReports({
      communityId,
      status: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'],
    });
    return reply.send({ data: incidents });
  });

  // 3. Human Review queue
  app.get('/maintainer/reviews', maintainerGuard, async (request, reply) => {
    const reviews = await reviewService.listReviews();
    return reply.send({ data: reviews });
  });

  // 4. Tasks list for maintainers
  app.get('/maintainer/tasks', maintainerGuard, async (request, reply) => {
    const communityId = (request.query as any)?.communityId;
    const tasks = await taskService.listTasks({ communityId });
    return reply.send({ data: tasks });
  });
}
