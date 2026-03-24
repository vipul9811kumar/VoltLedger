import type { FastifyReply } from 'fastify';

export function notFound(reply: FastifyReply, message: string) {
  return reply.status(404).send({ error: message });
}

export function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: message });
}

export function serverError(reply: FastifyReply, err: unknown) {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.status(500).send({ error: message });
}
