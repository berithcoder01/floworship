import { prisma } from '../../db';

export async function logMessage(
  musicianId: string,
  templateName: string,
  context: Record<string, unknown>,
  messageId: string,
  status: string = 'enviado'
) {
  const musician = await prisma.musician.findUnique({ where: { id: musicianId } });
  if (!musician) return;

  return prisma.whatsAppMessageLog.create({
    data: {
      ministryId: musician.ministryId,
      musicianId,
      templateName,
      context: JSON.stringify(context),
      messageId,
      status,
      sentById: musician.userId,
    },
  });
}

export async function updateStatus(messageId: string, status: string) {
  return prisma.whatsAppMessageLog.updateMany({
    where: { messageId },
    data: { status },
  });
}

export async function getMessagesByMusician(musicianId: string) {
  return prisma.whatsAppMessageLog.findMany({
    where: { musicianId },
    orderBy: { sentAt: 'desc' },
  });
}

export async function getMessagesByCycle(_cycleId: string) {
  return prisma.whatsAppMessageLog.findMany({
    orderBy: { sentAt: 'desc' },
  });
}