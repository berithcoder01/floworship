import type { FastifyInstance } from 'fastify';
import { createHmac } from 'crypto';
import { processButtonReply } from '../services/whatsapp/replyProcessor';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'floworship-verify';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

function verifySignature(body: string, signature: string): boolean {
  if (!APP_SECRET) {
    console.warn('WHATSAPP_APP_SECRET not set - rejecting webhook');
    return false;
  }
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return expected === signature;
}

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get('/webhook', async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (query['hub.verify_token'] === VERIFY_TOKEN) {
      return reply.send(query['hub.challenge']);
    }
    return reply.status(403).send({ error: 'Invalid verify token' });
  });

  app.post('/webhook', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const rawBody = JSON.stringify(request.body);

    if (!verifySignature(rawBody, signature)) {
      return reply.status(403).send({ error: 'Invalid signature' });
    }

    const payload = request.body as Record<string, any>;
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages) {
      for (const msg of messages) {
        if (msg.type === 'button' && msg.button) {
          await processButtonReply(
            msg.from,
            msg.button.payload,
            { messageId: msg.id, timestamp: msg.timestamp }
          );
        }
      }
    }

    return reply.send({ status: 'ok' });
  });
}