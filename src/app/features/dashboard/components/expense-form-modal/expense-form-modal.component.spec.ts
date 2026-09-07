import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExpenseFormModalComponent } from './expense-form-modal.component';
import { ExpenseService } from '../../../../core/services/expense.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { UserProfile } from '../../../../core/models/user.model';

describe('ExpenseFormModalComponent', () => {
  let component: ExpenseFormModalComponent;
  let fixture: ComponentFixture<ExpenseFormModalComponent>;

  let mockExpenseService: any;
  let mockAuthStore: any;

  const mockUser: UserProfile = {
    uid: 'user-123',
    email: 'user@finance.com',
    displayName: 'Usuário Teste',
    photoURL: null
  };

  beforeEach(async () => {
    mockExpenseService = {
      addExpense: vi.fn().mockResolvedValue('exp-id-1'),
      updateExpense: vi.fn().mockResolvedValue(undefined),
      createInstallments: vi.fn().mockResolvedValue('group-id-1')
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser)
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseFormModalComponent],
      providers: [
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('mesAno', '2025-03');
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve submeter criação de despesa simples', async () => {
    component.form.patchValue({
      descricao: 'Supermercado Mensal',
      valor: 450,
      quinzena: 1,
      categoria: 'Alimentação'
    });

    let savedEmitted = false;
    component.saved.subscribe(() => savedEmitted = true);

    await component.onSubmit();

    expect(mockExpenseService.addExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        descricao: 'Supermercado Mensal',
        valor: 450,
        quinzena: 1,
        categoria: 'Alimentação'
      })
    );
    expect(savedEmitted).toBe(true);
  });

  it('deve submeter compra parcelada com createInstallments', async () => {
    component.form.patchValue({
      descricao: 'Notebook Trabalho',
      valor: 3000,
      quinzena: 2,
      categoria: 'Educação',
      isParcelado: true,
      total_parcelas: 10
    });

    await component.onSubmit();

    expect(mockExpenseService.createInstallments).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        descricao: 'Notebook Trabalho',
        valor: 300,
        quinzena: 2
      }),
      10
    );
  });

  it('deve submeter updateExpense quando expenseToEdit for informado', async () => {
    fixture.componentRef.setInput('expenseToEdit', {
      id: 'exp-edit-1',
      descricao: 'Aluguel Original',
      valor: 1500,
      quinzena: 1,
      categoria: 'Moradia',
      status_pagamento: false
    });
    fixture.detectChanges();

    component.form.patchValue({
      descricao: 'Aluguel Reajustado',
      valor: 1600
    });

    await component.onSubmit();

    expect(mockExpenseService.updateExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      'exp-edit-1',
      expect.objectContaining({
        descricao: 'Aluguel Reajustado',
        valor: 1600
      })
    );
  });
});
