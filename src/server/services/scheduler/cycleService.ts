import { prisma } from '../../db';
import { generateSchedule } from './engine';

export type CycleStatus = 'coletando_disponibilidade' | 'gerando' | 'aguardando_aprovacao' | 'publicada';

export async function createCycle(ministryId: string, month: number, year: number) {
  return prisma.monthlyScheduleCycle.create({
    data: {
      ministryId,
      month,
      year,
      status: 'coletando_disponibilidade',
      availabilityDeadline: new Date(year, month - 1, 15),
    },
  });
}

export async function closeAvailability(cycleId: string) {
  const cycle = await prisma.monthlyScheduleCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== 'coletando_disponibilidade') {
    throw new Error('Invalid cycle status');
  }

  await prisma.monthlyScheduleCycle.update({
    where: { id: cycleId },
    data: { status: 'gerando' },
  });

  return generateScheduleForCycle(cycleId);
}

export async function approveCycle(cycleId: string) {
  const cycle = await prisma.monthlyScheduleCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== 'gerando') {
    throw new Error('Invalid cycle status');
  }

  return prisma.monthlyScheduleCycle.update({
    where: { id: cycleId },
    data: { status: 'aguardando_aprovacao' },
  });
}

export async function publishCycle(cycleId: string) {
  const cycle = await prisma.monthlyScheduleCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== 'aguardando_aprovacao') {
    throw new Error('Invalid cycle status');
  }

  return prisma.monthlyScheduleCycle.update({
    where: { id: cycleId },
    data: { status: 'publicada' },
  });
}

async function generateScheduleForCycle(cycleId: string) {
  const cycle = await prisma.monthlyScheduleCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error('Cycle not found');

  const sundays = getSundaysInMonth(cycle.month, cycle.year);
  const roles = ['vocalista', 'guitarrista', 'tecladista', 'baterista', 'baixista'];

  const schedules = await Promise.all(
    sundays.map(async (date) => {
      const schedule = await prisma.serviceSchedule.create({
        data: { ministryId: cycle.ministryId, date, createdById: cycle.ministryId },
      });
      return { date, scheduleId: schedule.id };
    })
  );

  const musicians = await prisma.musician.findMany({
    where: { ministryId: cycle.ministryId },
  });

  const candidates = musicians.map((m) => ({
    id: m.id,
    userId: m.userId,
    timesServedThisMonth: 0,
    lastServedAt: {} as Record<string, Date>,
    worshipRoles: JSON.parse(m.worshipRoles || '[]'),
  }));

  const assignments = generateSchedule(schedules, roles, candidates, new Map());

  for (const assignment of assignments) {
    const user = assignment.musicianId
      ? await prisma.musician.findUnique({ where: { id: assignment.musicianId }, select: { userId: true } })
      : null;

    await prisma.serviceAssignment.create({
      data: {
        scheduleId: assignment.scheduleId,
        role: assignment.role,
        userId: user?.userId || cycle.ministryId,
        musicianId: assignment.musicianId,
        status: assignment.status,
      },
    });
  }

  return schedules;
}

function getSundaysInMonth(month: number, year: number): Date[] {
  const sundays: Date[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 0) {
      sundays.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return sundays;
}