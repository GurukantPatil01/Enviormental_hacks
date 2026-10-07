import type { Report, Task, TaskPriority, TaskStatus } from '@ecopulse/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reports, tasks, users } from '../db/schema.js';

export interface CreateTaskInput {
  communityId: string;
  reportId?: string | null;
  assignedTo?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
}

export interface UpdateTaskInput {
  assignedTo?: string | null;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
  completedAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
}

export class TaskRepository {
  async create(data: CreateTaskInput): Promise<Task> {
    const [row] = await db
      .insert(tasks)
      .values({
        communityId: data.communityId,
        reportId: data.reportId,
        assignedTo: data.assignedTo,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        status: data.status || 'CREATED',
        dueDate: data.dueDate,
      })
      .returning();

    return this.mapToTask(row);
  }

  async findById(id: string): Promise<Task | null> {
    const [row] = await db
      .select({
        task: tasks,
        assignedUser: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
        report: {
          id: reports.id,
          title: reports.title,
          category: reports.category,
          status: reports.status,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(reports, eq(tasks.reportId, reports.id))
      .where(eq(tasks.id, id));

    if (!row) return null;
    return {
      ...this.mapToTask(row.task),
      assignedUser: row.assignedUser ?? undefined,
      report: row.report ? (row.report as any) : undefined,
    };
  }

  async list(filters?: {
    communityId?: string;
    assignedTo?: string;
    status?: TaskStatus | TaskStatus[];
    reportId?: string;
  }): Promise<Task[]> {
    const conditions = [];

    if (filters?.communityId) {
      conditions.push(eq(tasks.communityId, filters.communityId));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(tasks.status, filters.status));
      } else {
        conditions.push(eq(tasks.status, filters.status));
      }
    }
    if (filters?.reportId) {
      conditions.push(eq(tasks.reportId, filters.reportId));
    }

    const query = db
      .select({
        task: tasks,
        assignedUser: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
        report: {
          id: reports.id,
          title: reports.title,
          category: reports.category,
          status: reports.status,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(reports, eq(tasks.reportId, reports.id))
      .orderBy(desc(tasks.createdAt));

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query);

    return rows.map((r) => ({
      ...this.mapToTask(r.task),
      assignedUser: r.assignedUser ?? undefined,
      report: r.report ? (r.report as any) : undefined,
    }));
  }

  async update(id: string, data: UpdateTaskInput): Promise<Task | null> {
    const [row] = await db
      .update(tasks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!row) return null;
    return this.findById(row.id);
  }

  private mapToTask(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      communityId: row.communityId,
      reportId: row.reportId,
      assignedTo: row.assignedTo,
      title: row.title,
      description: row.description,
      priority: row.priority as TaskPriority,
      status: row.status as TaskStatus,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
      verifiedBy: row.verifiedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const taskRepository = new TaskRepository();
