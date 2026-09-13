import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeTelegramHtml,
  getTipoLabel,
  formatTelegramMessage,
  validateFeedbackPayload,
  sendTelegramFeedback,
  TelegramFeedbackData,
  UserContext
} from './feedback.js';

describe('Feedback Telegram Functions Unit Tests', () => {
  const mockUser: UserContext = {
    uid: 'usr-12345',
    email: 'philipe@example.com',
    displayName: 'Philipe Silva'
  };

  const validData: TelegramFeedbackData = {
    tipo: 'erro',
    assunto: 'Botão não responde',
    mensagem: 'Ao tentar salvar a despesa na quinzena 2, o botão fica inativo.',
    gravidade: 'alta',
    dadosTecnicos: {
      urlAtual: '/dashboard',
      userAgent: 'Mozilla/5.0 Chrome 128',
      resolucao: '1920x1080',
      appVersion: 'v1.4.0',
      erroOriginal: 'Permission denied'
    }
  };

  describe('escapeTelegramHtml', () => {
    it('deve escapar corretamente &, < e >', () => {
      expect(escapeTelegramHtml('Texto com <b>tag</b> & "aspas"')).toBe('Texto com &lt;b&gt;tag&lt;/b&gt; &amp; "aspas"');
    });

    it('deve retornar string vazia para entrada vazia', () => {
      expect(escapeTelegramHtml('')).toBe('');
    });
  });

  describe('getTipoLabel', () => {
    it('deve retornar os rótulos semânticos corretos', () => {
      expect(getTipoLabel('sugestao')).toContain('Sugestão');
      expect(getTipoLabel('erro')).toContain('Erro');
      expect(getTipoLabel('elogio')).toContain('Elogio');
      expect(getTipoLabel('outro')).toContain('Feedback Geral');
    });
  });

  describe('formatTelegramMessage', () => {
    it('deve gerar mensagem HTML estruturada com metadados do usuário e técnicos', () => {
      const msg = formatTelegramMessage(validData, mockUser);

      expect(msg).toContain('<b>📌 Categoria:</b> 🐞 Reporte de Erro / Bug');
      expect(msg).toContain('<b>🟠 Gravidade:</b> ALTA');
      expect(msg).toContain('<b>👤 Usuário:</b> Philipe Silva');
      expect(msg).toContain('<code>philipe@example.com</code>');
      expect(msg).toContain('<b>📝 Assunto:</b>\nBotão não responde');
      expect(msg).toContain('<b>💬 Mensagem:</b>\nAo tentar salvar a despesa');
      expect(msg).toContain('• <b>Página / Rota:</b> <code>/dashboard</code>');
      expect(msg).toContain('• <b>Versão do App:</b> v1.4.0');
      expect(msg).toContain('• <b>Erro Técnico:</b> <code>Permission denied</code>');
    });

    it('deve formatar sugestão sem exibir bloco de gravidade', () => {
      const sugestaoData: TelegramFeedbackData = {
        tipo: 'sugestao',
        assunto: 'Atalho de teclado',
        mensagem: 'Gostaria de um atalho para abrir o modal de nova despesa.'
      };
      const msg = formatTelegramMessage(sugestaoData, mockUser);

      expect(msg).toContain('💡 Sugestão / Melhoria');
      expect(msg).not.toContain('Gravidade:');
      expect(msg).not.toContain('Diagnóstico Técnico:');
    });
  });

  describe('validateFeedbackPayload', () => {
    it('deve validar payload correto', () => {
      expect(validateFeedbackPayload(validData)).toEqual({ valid: true });
    });

    it('deve rejeitar tipo inválido', () => {
      const res = validateFeedbackPayload({ ...validData, tipo: 'invalido' as any });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Tipo inválido');
    });

    it('deve rejeitar assunto menor que 3 caracteres', () => {
      const res = validateFeedbackPayload({ ...validData, assunto: 'ab' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('assunto deve ter entre 3 e 120');
    });

    it('deve rejeitar mensagem com menos de 5 caracteres', () => {
      const res = validateFeedbackPayload({ ...validData, mensagem: 'ola' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('mensagem deve ter entre 5 e 2.000');
    });

    it('deve rejeitar gravidade desconhecida', () => {
      const res = validateFeedbackPayload({ ...validData, gravidade: 'urgente' as any });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Gravidade inválida');
    });
  });

  describe('sendTelegramFeedback', () => {
    const mockEnv = (key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return 'test-token-123';
      if (key === 'TELEGRAM_CHAT_ID') return 'test-chat-456';
      return undefined;
    };

    it('deve retornar erro quando as credenciais do Telegram não existirem', async () => {
      const res = await sendTelegramFeedback(validData, mockUser, {
        getEnv: () => undefined
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Configurações de integração do Telegram não encontradas');
    });

    it('deve despachar a mensagem para a API do Telegram com sucesso e salvar no Firestore', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 9991 } })
      });

      const mockAdd = vi.fn().mockResolvedValue({ id: 'report-doc-123' });
      const mockDb = {
        collection: vi.fn().mockReturnValue({ add: mockAdd })
      } as any;

      const res = await sendTelegramFeedback(validData, mockUser, {
        getEnv: mockEnv,
        fetchFn: mockFetch as any,
        db: mockDb
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe(9991);
      expect(res.reportId).toBe('report-doc-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token-123/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(bodySent.chat_id).toBe('test-chat-456');
      expect(bodySent.parse_mode).toBe('HTML');
      expect(bodySent.text).toContain('Botão não responde');

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr-12345',
          tipo: 'erro',
          assunto: 'Botão não responde',
          status: 'novo'
        })
      );
    });

    it('deve retornar erro amigável quando o Telegram rejeitar a requisição', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ ok: false, description: 'bot was blocked by the user' })
      });

      const res = await sendTelegramFeedback(validData, mockUser, {
        getEnv: mockEnv,
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('bot was blocked by the user');
    });

    it('deve capturar exceções de rede e retornar falha sem crashar', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const res = await sendTelegramFeedback(validData, mockUser, {
        getEnv: mockEnv,
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Falha de comunicação com o servidor do Telegram');
    });
  });
});
