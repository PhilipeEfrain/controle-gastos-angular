import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { IncomeFormModalComponent } from './income-form-modal.component';
import { MonthlyCycleService } from '../../../../core/services/monthly-cycle.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { UserProfile } from '../../../../core/models/user.model';

describe('IncomeFormModalComponent', () => {
  let component: IncomeFormModalComponent;
  let fixture: ComponentFixture<IncomeFormModalComponent>;

  let mockCycleService: any;
  let mockAuthStore: any;

  const mockUser: UserProfile = {
    uid: 'user-456',
    email: 'user@finance.com',
    displayName: 'Usuário Pro',
    photoURL: null
  };

  beforeEach(async () => {
    mockCycleService = {
      saveIncome: vi.fn().mockResolvedValue({
        id: '2025-03',
        mesAno: '2025-03',
        renda_quinzena_1: 3000,
        renda_quinzena_2: 2000,
        total_renda: 5000,
        total_gastos: 0,
        saldo_final: 5000
      })
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser)
    };

    await TestBed.configureTestingModule({
      imports: [IncomeFormModalComponent],
      providers: [
        { provide: MonthlyCycleService, useValue: mockCycleService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('mesAno', '2025-03');
    fixture.componentRef.setInput('currentQ1', 2500);
    fixture.componentRef.setInput('currentQ2', 1800);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar com os valores atuais de Q1 e Q2', () => {
    expect(component.form.get('rendaQ1')?.value).toBe(2500);
    expect(component.form.get('rendaQ2')?.value).toBe(1800);
  });

  it('deve salvar rendas ao submeter formulário válido', async () => {
    component.form.patchValue({
      rendaQ1: 3500,
      rendaQ2: 2200
    });

    let savedEmitted = false;
    component.saved.subscribe(() => savedEmitted = true);

    await component.onSubmit();

    expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
      'user-456',
      '2025-03',
      3500,
      2200,
      'quinzenal',
      undefined,
      undefined
    );
    expect(savedEmitted).toBe(true);
  });

  it('Cenário BDD: deve configurar Salário Mensal Único na Quinzena 1 (Dia 31)', async () => {
    component.setRegime('mensal_q1');
    component.form.patchValue({ salarioTotal: 6000 });
    component.onSalarioTotalChange();

    expect(component.form.get('rendaQ1')?.value).toBe(6000);
    expect(component.form.get('rendaQ2')?.value).toBe(0);

    await component.onSubmit();

    expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
      'user-456',
      '2025-03',
      6000,
      0,
      'mensal_q1',
      undefined,
      undefined
    );
  });

  it('Cenário BDD: deve configurar Salário com Divisão Automática 50/50', async () => {
    component.setRegime('divisao_50_50');
    component.form.patchValue({ salarioTotal: 5000 });
    component.onSalarioTotalChange();

    expect(component.form.get('rendaQ1')?.value).toBe(2500);
    expect(component.form.get('rendaQ2')?.value).toBe(2500);

    await component.onSubmit();

    expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
      'user-456',
      '2025-03',
      2500,
      2500,
      'divisao_50_50',
      undefined,
      undefined
    );
  });

  describe('Cenários BDD (CARD-046): Flexibilidade de Data no Regime Mensal Único', () => {
    it('Cenário BDD 1: deve alocar na 1ª Quinzena ao escolher Mensal Único com 5º dia útil', async () => {
      component.setRegime('mensal_unico');
      component.setPaymentDayPreset('5_dia_util');
      component.form.patchValue({ salarioTotal: 5000 });
      component.onSalarioTotalChange();

      expect(component.paymentDayInfo().quinzena).toBe(1);
      expect(component.paymentDayInfo().descricao).toBe('5º dia útil');
      expect(component.form.get('rendaQ1')?.value).toBe(5000);
      expect(component.form.get('rendaQ2')?.value).toBe(0);

      await component.onSubmit();

      expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
        'user-456',
        '2025-03',
        5000,
        0,
        'mensal_unico',
        '5_dia_util',
        '5º dia útil'
      );
    });

    it('Cenário BDD 2: deve alocar na 2ª Quinzena ao escolher Dia 20', async () => {
      component.setRegime('mensal_unico');
      component.setPaymentDayPreset('20');
      component.form.patchValue({ salarioTotal: 4500 });
      component.onSalarioTotalChange();

      expect(component.paymentDayInfo().quinzena).toBe(2);
      expect(component.paymentDayInfo().descricao).toBe('Dia 20');
      expect(component.form.get('rendaQ1')?.value).toBe(0);
      expect(component.form.get('rendaQ2')?.value).toBe(4500);

      await component.onSubmit();

      expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
        'user-456',
        '2025-03',
        0,
        4500,
        'mensal_unico',
        20,
        'Dia 20'
      );
    });

    it('Cenário BDD 3: deve suportar dia customizado livremente (ex: dia 8 na Q1, dia 22 na Q2)', async () => {
      component.setRegime('mensal_unico');
      component.setPaymentDayPreset('custom');
      component.form.patchValue({ diaCustomizado: 8, salarioTotal: 7000 });
      component.onDiaCustomizadoChange();

      expect(component.paymentDayInfo().quinzena).toBe(1);
      expect(component.paymentDayInfo().descricao).toBe('Dia 8');
      expect(component.form.get('rendaQ1')?.value).toBe(7000);
      expect(component.form.get('rendaQ2')?.value).toBe(0);

      // Agora muda para dia 22
      component.form.patchValue({ diaCustomizado: 22 });
      component.onDiaCustomizadoChange();

      expect(component.paymentDayInfo().quinzena).toBe(2);
      expect(component.paymentDayInfo().descricao).toBe('Dia 22');
      expect(component.form.get('rendaQ1')?.value).toBe(0);
      expect(component.form.get('rendaQ2')?.value).toBe(7000);

      await component.onSubmit();

      expect(mockCycleService.saveIncome).toHaveBeenCalledWith(
        'user-456',
        '2025-03',
        0,
        7000,
        'mensal_unico',
        22,
        'Dia 22'
      );
    });
  });
});
