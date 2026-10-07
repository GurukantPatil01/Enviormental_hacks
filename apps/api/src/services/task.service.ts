import type { Task, TaskPriority, TaskStatus } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { reportRepository } from '../repositories/report.repository.js';
import { taskRepository } from '../repositories/task.repository.js';

export interface CreateTaskParams {
  communityId: string;
  reportId?: string | null;
  assignedTo?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  actorId: string;
}

export class TaskService {
  async createTask(params: CreateTaskParams): Promise<Task> {
    const task = await taskRepository.create({
      communityId: params.communityId,
      reportId: params.reportId,
      assignedTo: params.assignedTo,
      title: params.title,
      description: params.description,
      priority: params.priority || 'MEDIUM',
      status: params.assignedTo ? 'ASSIGNED' : 'CREATED',
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
    });

    await eventBus.publish(
      'TASK_CREATED',
      task.id,
      {
        taskId: task.id,
        communityId: task.communityId,
        title: task.title,
        priority: task.priority,
        reportId: task.reportId,
      },
      params.actorId
    );

    if (params.assignedTo) {
      await eventBus.publish(
        'TASK_ASSIGNED',
        task.id,
        {
          taskId: task.id,
          assignedTo: params.assignedTo,
        },
        params.actorId
      );
    }

    return task;
  }

  async assignTask(taskId: string, assignedTo: string, actorId: string): Promise<Task> {
    const task = await this.getTask(taskId);

    const updated = await taskRepository.update(taskId, {
      assignedTo,
      status: task.status === 'CREATED' ? 'ASSIGNED' : task.status,
    });

    if (!updated) {
      throw new Error('Failed to update task assignment');
    }

    await eventBus.publish(
      'TASK_ASSIGNED',
      task.id,
      {
        taskId: task.id,
        assignedTo,
      },
      actorId
    );

    return updated;
  }

  async startTask(taskId: string, actorId: string): Promise<Task> {
    const task = await this.getTask(taskId);

    if (task.status === 'COMPLETED' || task.status === 'VERIFIED') {
      const err: any = new Error(`Cannot start task in status ${task.status}`);
      err.statusCode = 400;
      err.code = 'INVALID_STATE';
      throw err;
    }

    const updated = await taskRepository.update(taskId, {
      status: 'IN_PROGRESS',
    });

    return updated!;
  }

  async completeTask(taskId: string, actorId: string): Promise<Task> {
    const task = await this.getTask(taskId);

    if (task.status === 'COMPLETED' || task.status === 'VERIFIED') {
      return task; // idempotent
    }

    const updated = await taskRepository.update(taskId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    await eventBus.publish(
      'TASK_COMPLETED',
      task.id,
      {
        taskId: task.id,
        communityId: task.communityId,
        completedBy: actorId,
      },
      actorId
    );

    return updated!;
  }

  async verifyTask(taskId: string, verifiedBy: string): Promise<Task> {
    const task = await this.getTask(taskId);

    const updated = await taskRepository.update(taskId, {
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy,
    });

    // If task was addressing a report incident, mark the report as RESOLVED!
    if (task.reportId) {
      await reportRepository.updateStatus(task.reportId, 'RESOLVED');
    }

    await eventBus.publish(
      'TASK_VERIFIED',
      task.id,
      {
        taskId: task.id,
        communityId: task.communityId,
        verifiedBy,
        reportId: task.reportId,
      },
      verifiedBy
    );

    await eventBus.publish(
      'COMMUNITY_PROGRESS_UPDATED',
      task.communityId,
      {
        communityId: task.communityId,
        trigger: 'TASK_VERIFIED',
      },
      verifiedBy
    );

    return updated!;
  }

  async getTask(id: string): Promise<Task> {
    const task = await taskRepository.findById(id);
    if (!task) {
      const err: any = new Error('Task not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return task;
  }

  async listTasks(filters?: {
    communityId?: string;
    assignedTo?: string;
    status?: TaskStatus | TaskStatus[];
    reportId?: string;
  }): Promise<Task[]> {
    return taskRepository.list(filters);
  }
}

export const taskService = new TaskService();
