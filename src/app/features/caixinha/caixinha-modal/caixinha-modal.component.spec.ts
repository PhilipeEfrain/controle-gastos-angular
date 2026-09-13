import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CaixinhaModalComponent } from './caixinha-modal.component';
import { CaixinhaService } from '../../../core/services/caixinha.service';
import { AuthStore } from '../../../core/state/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';

describe('CaixinhaModalComponent (CARD-068)', () => {
  let component: CaixinhaModalComponent;
  let fixture: ComponentFixture<CaixinhaModalComponent>;

  const mockCaixinha = {
    id: 'principal',
    userId: 'user-123',
    saldo: 1200,
    meta: 5000,
    nome: 'Reserva de Emergência'
  };

  const mockMovimentacoes = [
    {
      id: 'mov-1',
      caixinhaId: 'principal',
      userId: 'user-123',
      tipo: 'aporte' as const,
      valor: 500,
      data: '2025-03-10',
      observacao: 'Economia do mês'
    },
    {
      id: 'mov-2',
      caixinhaId: 'principal',
      userId: 'user-123',
      tipo: 'resgate' as const,
      valor: 200,
      data: '2025-03-12',
      observacao: 'Manutenção do carro',
      quinzenaDestino: 1 as const
    }
  ];

  let mockCaixinhaService: any;
  let mockAuthStore: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockCaixinhaService = {
      getCaixinhaStream: vi.fn().mockReturnValue(of(mockCaixinha)),
      getMovimentacoesStream: vi.fn().mockReturnValue(of(mockMovimentacoes)),
      registrarAporte: vi.fn().mockResolvedValue(undefined),
      registrarResgate: vi.fn().mockResolvedValue(undefined),
      initOrUpdateCaixinha: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthStore = {
      currentUser: signal({ uid: 'user-123', email: 'test@example.com' })
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CaixinhaModalComponent],
      providers: [
        { provide: CaixinhaService, useValue: mockCaixinhaService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CaixinhaModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('selectedMonth', '2025-03');
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o saldo da caixinha e a meta', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1.200,00');
    expect(el.textContent).toContain('5.000,00');
    expect(el.textContent).toContain('24%');
  });

  it('deve alternar entre os modos de exibição', () => {
    component.setMode('aporte');
    expect(component.activeMode()).toBe('aporte');

    component.setMode('resgate');
    expect(component.activeMode()).toBe('resgate');

    component.setMode('view');
    expect(component.activeMode()).toBe('view');
  });

  it('Cenário BDD 1: deve submeter aporte com sucesso e emitir movementSuccess', async () => {
    component.setMode('aporte');
    component.aporteForm.patchValue({
      valor: 300,
      observacao: 'Freelance'
    });

    let emitted = false;
    component.movementSuccess.subscribe(() => emitted = true);

    await component.submitAporte();

    expect(mockCaixinhaService.registrarAporte).toHaveBeenCalledWith(
      'user-123',
      300,
      'Freelance'
    );
    expect(mockNotificationService.success).toHaveBeenCalled();
    expect(component.activeMode()).toBe('view');
    expect(emitted).toBe(true);
  });

  it('Cenário BDD 2: deve validar saldo insuficiente ao tentar resgatar valor maior que o saldo', async () => {
    component.setMode('resgate');
    component.resgateForm.patchValue({
      valor: 1500, // saldo é 1200
      quinzena: 1
    });

    await component.submitResgate();

    expect(component.errorMessage()).toContain('Saldo insuficiente na caixinha');
    expect(mockCaixinhaService.registrarResgate).not.toHaveBeenCalled();
  });

  it('Cenário BDD 3: deve submeter resgate com sucesso e injetar no ciclo do mês', async () => {
    component.setMode('resgate');
    component.resgateForm.patchValue({
      valor: 400,
      quinzena: 2,
      observacao: 'Dentista emergência'
    });

    let emitted = false;
    component.movementSuccess.subscribe(() => emitted = true);

    await component.submitResgate();

    expect(mockCaixinhaService.registrarResgate).toHaveBeenCalledWith(
      'user-123',
      400,
      '2025-03',
      2,
      'Dentista emergência'
    );
    expect(mockNotificationService.success).toHaveBeenCalled();
    expect(component.activeMode()).toBe('view');
    expect(emitted).toBe(true);
  });

  it('deve listar o extrato de movimentações com os badges corretos', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Economia do mês');
    expect(el.textContent).toContain('+ R$ 500.00');
    expect(el.textContent).toContain('Manutenção do carro');
    expect(el.textContent).toContain('- R$ 200.00');
    expect(el.textContent).toContain('Injetado na Q1');
  });
});
