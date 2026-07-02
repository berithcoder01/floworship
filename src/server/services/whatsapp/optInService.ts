import { prisma } from '../../db';
import { validatePhoneNumber } from './metaCloudApi';

export async function getOptedInMusicians(ministryId: string) {
  return prisma.musician.findMany({
    where: {
      ministryId,
      whatsappOptIn: true,
      whatsappPhone: { not: null },
    },
  });
}

export async function optIn(musicianId: string, phone: string) {
  if (!validatePhoneNumber(phone)) {
    throw new Error('Invalid phone number format');
  }

  return prisma.musician.update({
    where: { id: musicianId },
    data: { whatsappPhone: phone, whatsappOptIn: true },
  });
}

export async function optOut(musicianId: string) {
  return prisma.musician.update({
    where: { id: musicianId },
    data: { whatsappOptIn: false },
  });
}