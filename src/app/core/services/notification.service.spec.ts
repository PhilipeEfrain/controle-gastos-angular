import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [NotificationService]
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve ser instanciado corretamente com array de notificações vazio', () => {
    expect(service).toBeTruthy();
    expect(service.notifications().length).toBe(0);
  });

  it('deve adicionar uma notificação de sucesso', () => {
    const id = service.success('Operação realizada com sucesso!');
    const list = service.notifications();

    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id);
    expect(list[0].type).toBe('success');
    expect(list[0].message).toBe('Operação realizada com sucesso!');
  });

  it('deve adicionar notificações de erro, warning e info', () => {
    service.error('Erro na requisição');
    service.warning('Atenção ao saldo');
    service.info('Nova mensagem');

    const list = service.notifications();
    expect(list.length).toBe(3);
    expect(list[0].type).toBe('error');
    expect(list[1].type).toBe('warning');
    expect(list[2].type).toBe('info');
  });

  it('deve remover uma notificação pelo id via dismiss', () => {
    const id1 = service.success('Msg 1');
    const id2 = service.error('Msg 2');

    expect(service.notifications().length).toBe(2);
    service.dismiss(id1);

    const list = service.notifications();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id2);
  });

  it('deve fechar a notificação automaticamente após o timeout', () => {
    service.success('Auto dismiss', 2000);
    expect(service.notifications().length).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(service.notifications().length).toBe(0);
  });

  it('deve limpar todas as notificações via clear', () => {
    service.success('Msg 1');
    service.info('Msg 2');
    expect(service.notifications().length).toBe(2);

    service.clear();
    expect(service.notifications().length).toBe(0);
  });
});
