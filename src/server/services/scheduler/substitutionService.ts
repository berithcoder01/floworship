import { prisma } from '../../db';
import { calculateFairnessScore } from './fairness';
import { sendSubstituicaoUrgente } from '../whatsapp';

export async function reportUnavailability(assignmentId: string) {
  return prisma.serviceAssignment.update({
    where: { id: assignmentId },
    data: { status: 'recusado' },
  });
}

export async function findSubstitute(assignmentId: string) {
  const assignment = await prisma.serviceAssignment.findUnique({
    where: { id: assignmentId },
    include: { schedule: true },
  });

  if (!assignment) throw new Error('Assignment not found');

  const assignedMusicians = await prisma.serviceAssignment.findMany({
    where: {
      scheduleId: assignment.scheduleId,
      status: 'confirmado',
    },
    select: { musicianId: true },
  });

  const assignedIds = assignedMusicians.map((a) => a.musicianId).filter((id): id is string => !!id);

  const candidates = await prisma.musician.findMany({
    where: {
      ministryId: assignment.schedule.ministryId,
      NOT: { id: { in: assignedIds } },
    },
    include: {
      assignments: {
        where: { status: 'confirmado' },
        orderBy: { schedule: { date: 'desc' } },
        take: 1,
        select: { role: true, schedule: { select: { date: true } } },
      },
    },
  });

  const scored = candidates.map((c) => {
    const map: Record<string, Date> = {};
    for (const a of c.assignments) {
      if (!map[a.role]) {
        map[a.role] = a.schedule.date;
      }
    }
    return {
      id: c.id,
      userId: c.userId,
      timesServedThisMonth: c.assignments.length,
      lastServedAt: map,
      worshipRoles: JSON.parse(c.worshipRoles || '[]'),
    };
  });

  const sorted = calculateFairnessScore(scored, assignment.role);

  for (const candidate of sorted) {
    try {
      const musician = await prisma.musician.findUnique({ where: { id: candidate.id } });
      if (musician?.whatsappPhone) {
        await sendSubstituicaoUrgente(
          musician.whatsappPhone,
          assignment.schedule.date.toISOString(),
          assignment.role,
          new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        );
      }

      await prisma.serviceAssignment.update({
        where: { id: assignmentId },
        data: {
          musicianId: candidate.id,
          status: 'convidado',
          substitutionOf: assignment.musicianId,
        },
      });

      return candidate;
    } catch {
      continue;
    }
  }

  await prisma.serviceAssignment.update({
    where: { id: assignmentId },
    data: { status: 'vago', musicianId: null },
  });

  return null;
}