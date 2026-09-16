import { ErrorHandler, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {
  /**
   * Intercepta erros globais da aplicação.
   * Conforme diretriz estrita do usuário:
   * Erros de console são apenas registrados no console local para inspeção/debug.
   * NENHUM erro de console é enviado automaticamente para o bot do Telegram.
   * O Telegram é acionado EXCLUSIVAMENTE quando o usuário envia um feedback manual.
   */
  handleError(error: any): void {
    console.error('[GlobalErrorHandler Intercepted]:', error);
  }
}
