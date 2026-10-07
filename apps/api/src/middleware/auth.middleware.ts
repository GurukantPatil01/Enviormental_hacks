import type { UserRole } from '@ecopulse/types';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: UserRole };
    user: { id: string; email: string; role: UserRole };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header.',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = request.server.jwt.verify<{ id: string; email: string; role: UserRole }>(token);
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authorization token.',
      },
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;

    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: This resource requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      });
    }
  };
}
