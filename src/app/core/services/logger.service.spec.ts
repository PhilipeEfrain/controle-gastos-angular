import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService (Secure Logging)', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoggerService]
    });
    service = TestBed.inject(LoggerService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('deve invocar os métodos info, warn e error sem falhas', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    service.info('Mensagem de teste');
    service.warn('Aviso de teste');
    service.error('Erro de teste', new Error('Falha'));

    expect(service).toBeTruthy();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
