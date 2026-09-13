export type FeedbackType = 'sugestao' | 'erro' | 'elogio' | 'outro';
export type FeedbackSeverity = 'baixa' | 'media' | 'alta' | 'critica';

export interface FeedbackTechnicalData {
  urlAtual?: string;
  userAgent?: string;
  resolucao?: string;
  appVersion?: string;
  erroOriginal?: string;
}

export interface FeedbackPayload {
  tipo: FeedbackType;
  assunto: string;
  mensagem: string;
  gravidade?: FeedbackSeverity;
  dadosTecnicos?: FeedbackTechnicalData;
}

export interface FeedbackResponse {
  success: boolean;
  messageId?: number;
  reportId?: string;
  error?: string;
}

export interface FeedbackContextData {
  tipo?: FeedbackType;
  assunto?: string;
  errorMessage?: string;
  gravidade?: FeedbackSeverity;
}
