import type { AuthResponse, User, UserRole } from '@ecopulse/types';
import type { LoginInput, RegisterInput } from '@ecopulse/validation';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { eventBus } from '../events/event-bus.js';
import { userRepository } from '../repositories/user.repository.js';

export class AuthService {
  async register(input: RegisterInput, app: FastifyInstance): Promise<AuthResponse> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      const err = new Error('An account with this email already exists.');
      (err as any).statusCode = 409;
      (err as any).code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      // SECURITY: public signup is hard-coded to RESIDENT.
      // Privileged roles are assigned exclusively via the internal,
      // audited role-assignment process — client input is never trusted.
      role: 'RESIDENT' as UserRole,
    });

    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      { expiresIn: '7d' }
    );

    await eventBus.publish(
      'USER_REGISTERED',
      user.id,
      {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      user.id
    );

    return { token, user };
  }

  async login(input: LoginInput, app: FastifyInstance): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      const err = new Error('Invalid email or password.');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      const err = new Error('Invalid email or password.');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
      },
      { expiresIn: '7d' }
    );

    const safeUser: User = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return { token, user: safeUser };
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      (err as any).statusCode = 404;
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
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
}

export const authService = new AuthService();
