import type { Firestore } from 'firebase-admin/firestore';

export interface TelegramFeedbackData {
  tipo: 'sugestao' | 'erro' | 'elogio' | 'outro';
  assunto: string;
  mensagem: string;
  gravidade?: 'baixa' | 'media' | 'alta' | 'critica';
  dadosTecnicos?: {
    urlAtual?: string;
    userAgent?: string;
    resolucao?: string;
    appVersion?: string;
    erroOriginal?: string;
  };
}

export interface UserContext {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface SendFeedbackResult {
  success: boolean;
  messageId?: number;
  reportId?: string;
  error?: string;
}

export interface FeedbackDependencies {
  db?: Firestore;
  fetchFn?: typeof fetch;
  getEnv?: (key: string) => string | undefined;
}

/**
 * Escapa caracteres reservados da formatação HTML do Telegram.
 */
export function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Mapeia o tipo para título amigável e emoji semântico.
 */
export function getTipoLabel(tipo: TelegramFeedbackData['tipo']): string {
  switch (tipo) {
    case 'sugestao':
      return '💡 Sugestão / Melhoria';
    case 'erro':
      return '🐞 Reporte de Erro / Bug';
    case 'elogio':
      return '⭐ Elogio';
    case 'outro':
    default:
      return '💬 Feedback Geral / Dúvida';
  }
}

/**
 * Formata a mensagem HTML rica para envio ao bot do Telegram.
 */
export function formatTelegramMessage(data: TelegramFeedbackData, user: UserContext): string {
  const tipoLabel = getTipoLabel(data.tipo);
  const userName = escapeTelegramHtml(user.displayName || 'Usuário Não Identificado');
  const userEmail = escapeTelegramHtml(user.email || 'Não informado');
  const userUid = escapeTelegramHtml(user.uid);
  const assunto = escapeTelegramHtml(data.assunto.trim());
  const mensagem = escapeTelegramHtml(data.mensagem.trim());

  let text = `<b>🔔 NOVO REPORTE NO QUINZENA APP</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<b>📌 Categoria:</b> ${tipoLabel}\n`;

  if (data.tipo === 'erro' && data.gravidade) {
    const gravidadeEmoji = data.gravidade === 'critica' ? '🔴' : data.gravidade === 'alta' ? '🟠' : '🟡';
    text += `<b>${gravidadeEmoji} Gravidade:</b> ${escapeTelegramHtml(data.gravidade.toUpperCase())}\n`;
  }

  text += `<b>👤 Usuário:</b> ${userName} (<code>${userEmail}</code>)\n`;
  text += `<b>🆔 UID:</b> <code>${userUid}</code>\n\n`;

  text += `<b>📝 Assunto:</b>\n${assunto}\n\n`;
  text += `<b>💬 Mensagem:</b>\n${mensagem}\n`;

  if (data.dadosTecnicos) {
    const { urlAtual, userAgent, resolucao, appVersion, erroOriginal } = data.dadosTecnicos;
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `<b>🛠️ Diagnóstico Técnico:</b>\n`;
    if (urlAtual) text += `• <b>Página / Rota:</b> <code>${escapeTelegramHtml(urlAtual)}</code>\n`;
    if (appVersion) text += `• <b>Versão do App:</b> ${escapeTelegramHtml(appVersion)}\n`;
    if (resolucao) text += `• <b>Resolução de Tela:</b> ${escapeTelegramHtml(resolucao)}\n`;
    if (userAgent) {
      // Limita userAgent para não estourar limite do Telegram
      const cleanUserAgent = escapeTelegramHtml(userAgent.substring(0, 150));
      text += `• <b>Ambiente:</b> ${cleanUserAgent}\n`;
    }
    if (erroOriginal) {
      const cleanError = escapeTelegramHtml(erroOriginal.substring(0, 500));
      text += `• <b>Erro Técnico:</b> <code>${cleanError}</code>\n`;
    }
  }

  return text;
}

/**
 * Valida o payload de feedback recebido do cliente.
 */
export function validateFeedbackPayload(data: TelegramFeedbackData): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Payload de feedback inválido ou ausente.' };
  }

  const validTipos = ['sugestao', 'erro', 'elogio', 'outro'];
  if (!data.tipo || !validTipos.includes(data.tipo)) {
    return { valid: false, error: `Tipo inválido. Deve ser um de: ${validTipos.join(', ')}` };
  }

  if (!data.assunto || typeof data.assunto !== 'string' || data.assunto.trim().length < 3 || data.assunto.trim().length > 120) {
    return { valid: false, error: 'O assunto deve ter entre 3 e 120 caracteres.' };
  }

  if (!data.mensagem || typeof data.mensagem !== 'string' || data.mensagem.trim().length < 5 || data.mensagem.trim().length > 2000) {
    return { valid: false, error: 'A mensagem deve ter entre 5 e 2.000 caracteres.' };
  }

  if (data.gravidade) {
    const validGravidades = ['baixa', 'media', 'alta', 'critica'];
    if (!validGravidades.includes(data.gravidade)) {
      return { valid: false, error: `Gravidade inválida. Deve ser uma de: ${validGravidades.join(', ')}` };
    }
  }

  return { valid: true };
}

/**
 * Envia o feedback formatado para a API do Telegram e salva backup auditável no Firestore.
 */
export async function sendTelegramFeedback(
  data: TelegramFeedbackData,
  user: UserContext,
  deps: FeedbackDependencies = {}
): Promise<SendFeedbackResult> {
  const getEnv = deps.getEnv || ((key: string) => process.env[key]);
  const fetchClient = deps.fetchFn || fetch;

  const botToken = getEnv('TELEGRAM_BOT_TOKEN');
  const chatId = getEnv('TELEGRAM_CHAT_ID');

  if (!botToken || !chatId) {
    console.error('[Telegram Feedback] Configurações ausentes: TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID.');
    return {
      success: false,
      error: 'Configurações de integração do Telegram não encontradas no servidor.'
    };
  }

  const validation = validateFeedbackPayload(data);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  const text = formatTelegramMessage(data, user);
  const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  let telegramMessageId: number | undefined;

  try {
    const response = await fetchClient(telegramEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const resJson = await response.json() as any;

    if (!response.ok || !resJson?.ok) {
      const errMsg = resJson?.description || response.statusText || 'Falha ao despachar mensagem para o Telegram.';
      console.error('[Telegram Feedback] Erro na API do Telegram:', errMsg);
      return {
        success: false,
        error: `Erro ao enviar para o Telegram: ${errMsg}`
      };
    }

    telegramMessageId = resJson?.result?.message_id;
  } catch (err: any) {
    console.error('[Telegram Feedback] Falha de rede ao conectar à API do Telegram:', err?.message || err);
    return {
      success: false,
      error: 'Falha de comunicação com o servidor do Telegram.'
    };
  }

  // Backup opcional no Firestore (/feedback_reports) para governança e histórico
  let reportId: string | undefined;
  if (deps.db) {
    try {
      const docRef = await deps.db.collection('feedback_reports').add({
        userId: user.uid,
        userName: user.displayName || null,
        userEmail: user.email || null,
        tipo: data.tipo,
        assunto: data.assunto.trim(),
        mensagem: data.mensagem.trim(),
        gravidade: data.gravidade || null,
        dadosTecnicos: data.dadosTecnicos || null,
        telegramMessageId: telegramMessageId || null,
        status: 'novo',
        createdAt: new Date().toISOString()
      });
      reportId = docRef.id;
    } catch (err: any) {
      console.warn('[Telegram Feedback] Falha ao persistir feedback no Firestore (não-bloqueante):', err?.message || err);
    }
  }

  return {
    success: true,
    messageId: telegramMessageId,
    reportId
  };
}
