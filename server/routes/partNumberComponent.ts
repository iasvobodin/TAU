import type { FastifyInstance } from 'fastify';
import type { PartNumberComponent } from '../models/interfaces';

export default function partNumberComponentRoutes(app: FastifyInstance) {
    app.get('/part-number-components', async (request, reply) => {
        try {
            const partNumberComponents = await app.prisma.partNumberComponent.findMany();
            reply.send(partNumberComponents);
        } catch (error) {
            reply.code(500).send({ error: 'Failed to retrieve part number components' });
        }
    });

    app.get('/part-number-components/:partNumber', async (request, reply) => {
        try {
            const { partNumber } = request.params as { partNumber: string };
            const partNumberComponent = await app.prisma.partNumberComponent.findUnique({
                where: { partNumber }
            });
            if (partNumberComponent) {
                reply.send(partNumberComponent);
            } else {
                reply.code(404).send({ error: 'Part number component not found' });
            }
        } catch (error) {
            reply.code(500).send({ error: 'Failed to retrieve part number component' });
        }
    });

    app.post<{ Body: PartNumberComponent }>('/part-number-components', async (request, reply) => {
        try {
            const data = request.body;
            const partNumberComponent = await app.prisma.partNumberComponent.create({ data });
            reply.code(201).send(partNumberComponent);
        } catch (error) {
            reply.code(500).send({ error: 'Failed to create part number component' });
        }
    });

    app.put<{ Params: { id: number }, Body: PartNumberComponent }>('/part-number-components/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const data = request.body;
            const partNumberComponent = await app.prisma.partNumberComponent.update({
                where: { id },
                data
            });
            reply.send(partNumberComponent);
        } catch (error) {
            reply.code(500).send({ error: 'Failed to update part number component' });
        }
    });

    app.delete('/part-number-components/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: number };
            await app.prisma.partNumberComponent.delete({
                where: { id }
            });
            reply.code(204).send();
        } catch (error) {
            reply.code(500).send({ error: 'Failed to delete part number component' });
        }
    });
}
