import type { FastifyInstance } from 'fastify';
import type { Template } from '../models/interfaces';

export default function templateRoutes(app: FastifyInstance) {
    app.get('/templates', async (request, reply) => {
        try {
            const templates = await app.prisma.template.findMany();
            reply.send(templates);
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.get('/templates/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            const template = await app.prisma.template.findUnique({
                where: { id }
            });
            if (template) {
                reply.send(template);
            } else {
                reply.code(404).send({ error: 'Template not found' });
            }
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.post<{ Body: Template }>('/templates', async (request, reply) => {
        try {
            const data = request.body;
            const template = await app.prisma.template.create({ data });
            reply.code(201).send(template);
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.put<{ Params: { id: number }, Body: Template }>('/templates/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const data = request.body;
            const template = await app.prisma.template.update({
                where: { id },
                data
            });
            reply.send(template);
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });

    app.delete('/templates/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            await app.prisma.template.delete({
                where: { id }
            });
            reply.code(204).send();
        } catch (error) {
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
}
