import type { User, UserRole } from '@ecopulse/types';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { maintainerProfiles, residentProfiles, users } from '../db/schema.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
}

export class UserRepository {
  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || null;
  }

  async create(data: CreateUserData): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        phone: data.phone || null,
        role: data.role || 'RESIDENT',
      })
      .returning();

    // Create profile
    if (user.role === 'MAINTAINER') {
      await db.insert(maintainerProfiles).values({
        userId: user.id,
        department: 'General Sanitation',
        badgeNumber: `MTR-${Math.floor(1000 + Math.random() * 9000)}`,
      });
    } else {
      await db.insert(residentProfiles).values({
        userId: user.id,
        preferredLanguage: 'en',
        notificationsEnabled: true,
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async getProfile(userId: string) {
    const [resident] = await db
      .select()
      .from(residentProfiles)
      .where(eq(residentProfiles.userId, userId));
    return resident || null;
  }
}

export const userRepository = new UserRepository();
