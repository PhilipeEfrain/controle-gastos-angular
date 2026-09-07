import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {

  /**
   * Log informativo seguro (suprimido em produção se não for mensagem amigável)
   */
  info(message: string, ...optionalParams: any[]): void {
    if (isDevMode()) {
      console.info(`[Quinzena INFO] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log de aviso seguro (evita expor estruturas internas)
   */
  warn(message: string, ...optionalParams: any[]): void {
    if (isDevMode()) {
      console.warn(`[Quinzena WARN] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log de erro sanitizado (evita vazamento de stacktrace e dados de Firestore em produção)
   */
  error(message: string, error?: any): void {
    if (isDevMode()) {
      console.error(`[Quinzena ERROR] ${message}`, error);
    }
  }
}
