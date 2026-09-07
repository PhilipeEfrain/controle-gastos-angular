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
      2200
    );
    expect(savedEmitted).toBe(true);
  });
});
