import { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import type { AuthenticatedUser } from '../middleware/auth';

function getUser(request: { user?: unknown }): AuthenticatedUser | null {
  return (request.user as AuthenticatedUser) || null;
}

export async function songsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // List songs
  fastify.get('/songs', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    const songs = await prisma.song.findMany({
      where: { ministryId: user.ministryId },
      include: { cueSheet: true },
      orderBy: { title: 'asc' },
    });

    return songs;
  });

  // Get song by id
  fastify.get<{ Params: { id: string } }>('/songs/:id', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    const song = await prisma.song.findFirst({
      where: { id: request.params.id, ministryId: user.ministryId },
      include: {
        cueSheet: {
          include: { blocks: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    return song;
  });

  // Create song
  fastify.post('/songs', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { title, artist, defaultKey, tags, notes } = request.body as Record<string, unknown>;

    if (!title) {
      return reply.status(400).send({ error: 'Title is required' });
    }

    const song = await prisma.song.create({
      data: {
        title: title as string,
        artist: artist as string,
        defaultKey: defaultKey as string,
        tags: JSON.stringify((tags as string[]) || []),
        notes: notes as string,
        ministryId: user.ministryId,
        createdById: user.id,
      },
    });

    return reply.status(201).send(song);
  });

  // Update song
  fastify.put<{ Params: { id: string } }>('/songs/:id', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const song = await prisma.song.findFirst({
      where: { id: request.params.id, ministryId: user.ministryId },
    });

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    const { title, artist, defaultKey, tags, notes, status } = request.body as Record<string, unknown>;

    const updated = await prisma.song.update({
      where: { id: request.params.id },
      data: {
        ...(title !== undefined && { title: title as string }),
        ...(artist !== undefined && { artist: artist as string }),
        ...(defaultKey !== undefined && { defaultKey: defaultKey as string }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(notes !== undefined && { notes: notes as string }),
        ...(status !== undefined && { status: status as string }),
      },
    });

    return updated;
  });

  // Delete song (soft delete - set status to arquivada)
  fastify.delete<{ Params: { id: string } }>('/songs/:id', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const song = await prisma.song.findFirst({
      where: { id: request.params.id, ministryId: user.ministryId },
    });

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    await prisma.song.update({
      where: { id: request.params.id },
      data: { status: 'arquivada' },
    });

    return { success: true };
  });

  // Upsert cue sheet with blocks
  fastify.post<{ Params: { id: string } }>('/songs/:id/cue-sheet', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const song = await prisma.song.findFirst({
      where: { id: request.params.id, ministryId: user.ministryId },
    });

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    const { referenceTrackUrl, totalDurationSeconds, blocks } = request.body as Record<string, unknown>;

    const cueSheet = await prisma.songCueSheet.upsert({
      where: { songId: request.params.id },
      create: {
        songId: request.params.id,
        referenceTrackUrl: referenceTrackUrl as string,
        totalDurationSeconds: totalDurationSeconds as number,
        blocks: blocks ? {
          create: (blocks as Record<string, unknown>[]).map((b, i) => ({
            label: b.label as string,
            startTime: b.startTime as number,
            endTime: b.endTime as number,
            duration: b.duration as number,
            chordproContent: b.chordproContent as string,
            order: (b.order as number) ?? i,
          })),
        } : undefined,
      },
      update: {
        referenceTrackUrl: referenceTrackUrl as string,
        totalDurationSeconds: totalDurationSeconds as number,
        blocks: blocks ? {
          deleteMany: {},
          create: (blocks as Record<string, unknown>[]).map((b, i) => ({
            label: b.label as string,
            startTime: b.startTime as number,
            endTime: b.endTime as number,
            duration: b.duration as number,
            chordproContent: b.chordproContent as string,
            order: (b.order as number) ?? i,
          })),
        } : undefined,
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });

    return cueSheet;
  });

  // Get cue sheet
  fastify.get<{ Params: { id: string } }>('/songs/:id/cue-sheet', async (request: any, reply: any) => {
    const user = getUser(request);
    if (!user?.ministryId) {
      return reply.status(400).send({ error: 'Ministry required' });
    }

    const song = await prisma.song.findFirst({
      where: { id: request.params.id, ministryId: user.ministryId },
    });

    if (!song) {
      return reply.status(404).send({ error: 'Song not found' });
    }

    const cueSheet = await prisma.songCueSheet.findUnique({
      where: { songId: request.params.id },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });

    return cueSheet || { blocks: [] };
  });
}