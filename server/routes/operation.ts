import type { FastifyInstance } from 'fastify';
import type { Operation } from '../models/interfaces';

export default function operationRoutes(app: FastifyInstance) {
    app.get('/operations', async (request, reply) => {
        try {
            const operations = await app.prisma.operation.findMany();
            reply.send(operations);
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.get('/operations/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            const operation = await app.prisma.operation.findUnique({
                where: { id }
            });
            if (operation) {
                reply.send(operation);
            } else {
                reply.code(404).send({ error: 'Operation not found' });
            }
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.post<{ Body: Operation }>('/operations', async (request, reply) => {
        try {
            const data = request.body;
            const operation = await app.prisma.operation.create({ data });
            reply.code(201).send(operation);
        } catch (error) {
            reply.code(500).send({ error: 'Failed to create operation' });
        }
    });

    app.put<{ Params: { id: number }, Body: Operation }>('/operations/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const data = request.body;
            const updatedOperation = await app.prisma.operation.update({
                where: { id },
                data
            });
            reply.send(updatedOperation);
        } catch (error) {
            reply.code(500).send({ error: 'Failed to update operation' });
        }
    });

    app.delete('/operations/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            await app.prisma.operation.delete({
                where: { id }
            });
            reply.code(204).send();
        } catch (error) {
            reply.code(500).send({ error: 'Failed to delete operation' });
        }
    });
}
