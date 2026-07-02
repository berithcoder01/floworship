export interface WhatsAppTemplate {
  name: string;
  language: string;
  body: string;
  buttons?: { type: string; payload: string; text: string }[];
}

export const TEMPLATES: Record<string, WhatsAppTemplate> = {
  disponibilidade_mensal: {
    name: 'disponibilidade_mensal',
    language: 'pt_BR',
    body: 'Ola {{nome}}! Confirme sua disponibilidade para {{mes}}:\n\n{{lista_de_domingos}}',
    buttons: [
      { type: 'reply', payload: 'disponivel', text: 'Disponivel' },
      { type: 'reply', payload: 'nao_disponivel', text: 'Nao disponivel' },
    ],
  },
  escala_confirmada: {
    name: 'escala_confirmada',
    language: 'pt_BR',
    body: 'Ola {{nome}}! Voce esta escalado(a) para {{data}} como {{funcao}}.',
    buttons: [
      { type: 'reply', payload: 'ver_escala', text: 'Ver escala completa' },
    ],
  },
  substituicao_urgente: {
    name: 'substituicao_urgente',
    language: 'pt_BR',
    body: 'Ola {{nome}}! Ha uma vaga para {{funcao}} em {{data}}. Responda ate {{prazo}}.',
    buttons: [
      { type: 'reply', payload: 'aceito', text: 'Aceito' },
      { type: 'reply', payload: 'nao_posso', text: 'Nao posso' },
    ],
  },
  lembrete_disponibilidade: {
    name: 'lembrete_disponibilidade',
    language: 'pt_BR',
    body: 'Ola {{nome}}! Lembramos que o prazo para confirmar disponibilidade de {{mes}} e {{prazo}}.',
  },
  repertorio_definido: {
    name: 'repertorio_definido',
    language: 'pt_BR',
    body: 'Ola {{nome}}! O repertorio de {{data}} esta definido:\n\n{{lista_de_musicas}}\n\nAcesse o modo estudo:',
    buttons: [
      { type: 'reply', payload: 'estudar', text: 'Estudar agora' },
    ],
  },
};

export function renderTemplate(templateName: string, variables: Record<string, string>): string {
  const template = TEMPLATES[templateName];
  if (!template) return '';

  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return body;
}