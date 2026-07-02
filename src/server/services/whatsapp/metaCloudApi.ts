const META_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

export interface TemplateMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

let lastSentAt = 0;
const RATE_LIMIT_MS = 12.5;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSentAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastSentAt = Date.now();
}

export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  params: Record<string, string>
): Promise<TemplateMessageResponse> {
  await waitForRateLimit();

  const body = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: Object.entries(params).map(([_, value]) => ({
            type: 'text',
            text: value,
          })),
        },
      ],
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.messages?.[0]?.id };
      }

      if (res.status >= 400 && res.status < 500) {
        const err = await res.json();
        return { success: false, error: err.error?.message || 'Client error' };
      }

      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

export function validatePhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}