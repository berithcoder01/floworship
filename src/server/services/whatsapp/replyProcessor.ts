import { prisma } from '../../db';
import { logMessage } from './messageLogService';

export async function processButtonReply(
  phone: string,
  buttonId: string,
  context: { messageId: string; timestamp: string }
): Promise<void> {
  const musician = await prisma.musician.findFirst({
    where: { whatsappPhone: phone },
  });

  if (!musician) return;

  if (buttonId === 'disponivel' || buttonId === 'nao_disponivel') {
    const available = buttonId === 'disponivel';
    const cycleId = context.messageId;
    await prisma.$executeRawUnsafe(
      `INSERT OR REPLACE INTO availability_response (cycle_id, musician_id, sunday_date, available, responded_at)
       VALUES (?, ?, datetime('now'), ?, datetime('now'))`,
      cycleId,
      musician.id,
      available ? 1 : 0
    );
  }

  if (buttonId === 'aceito' || buttonId === 'nao_posso') {
    const accept = buttonId === 'aceito';
    const assignment = await prisma.serviceAssignment.findFirst({
      where: { musicianId: musician.id, status: 'convidado' },
    });

    if (assignment) {
      await prisma.serviceAssignment.update({
        where: { id: assignment.id },
        data: { status: accept ? 'confirmado' : 'recusado' },
      });
    }
  }

  await logMessage(musician.id, 'button_reply', { buttonId }, context.messageId, 'respondido');
}