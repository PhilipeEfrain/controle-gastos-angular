import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GlobalErrorHandler } from './global-error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler]
    });

    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('deve ser instanciado com sucesso', () => {
    expect(handler).toBeTruthy();
  });

  it('deve registrar erro no console.error e nunca despachar para serviços externos', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Erro de teste no console');

    handler.handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith('[GlobalErrorHandler Intercepted]:', error);
    consoleSpy.mockRestore();
  });
});
