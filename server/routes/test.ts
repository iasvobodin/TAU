import type { FastifyInstance } from 'fastify';
import type { Test } from '../models/interfaces';

export default function testRoutes(app: FastifyInstance) {
    app.get('/tests', async (request, reply) => {
        try {
            const tests = await app.prisma.test.findMany();
            reply.send(tests);
        } catch (error) {
            reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    app.get('/tests/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            const test = await app.prisma.test.findUnique({
                where: { id }
            });
            if (test) {
                reply.send(test);
            } else {
                reply.code(404).send({ error: 'test not found' });
            }
        } catch (error) {
            reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    app.post<{ Body: Test }>('/tests', async (request, reply) => {
        try {
            const data = request.body;
            const test = await app.prisma.test.create({ data });
            reply.code(201).send(test);
        } catch (error) {
            reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    app.put<{ Params: { id: number }, Body: Test }>('/tests/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const data = request.body;
            const test = await app.prisma.test.update({
                where: { id },
                data
            });
            reply.send(test);
        } catch (error) {
            reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    app.delete('/tests/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            await app.prisma.test.delete({
                where: { id }
            });
            reply.code(204).send();
        } catch (error) {
            reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}
