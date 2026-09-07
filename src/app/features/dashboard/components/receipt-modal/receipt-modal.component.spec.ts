import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReceiptModalComponent } from './receipt-modal.component';
import { ExpenseService } from '../../../../core/services/expense.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { UserProfile } from '../../../../core/models/user.model';
import { Expense } from '../../../../core/models/finance.model';

describe('ReceiptModalComponent', () => {
  let component: ReceiptModalComponent;
  let fixture: ComponentFixture<ReceiptModalComponent>;

  let mockExpenseService: any;
  let mockAuthStore: any;

  const mockUser: UserProfile = {
    uid: 'user-789',
    email: 'receipt@finance.com',
    displayName: 'Usuário Recibo',
    photoURL: null
  };

  const mockExpense: Expense = {
    id: 'exp-99',
    descricao: 'Seguro Auto',
    valor: 450,
    quinzena: 2,
    categoria: 'Transporte',
    status_pagamento: true,
    codigo_comprovante: 'OLD-CODE-123'
  };

  beforeEach(async () => {
    mockExpenseService = {
      updateReceiptCode: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser)
    };

    await TestBed.configureTestingModule({
      imports: [ReceiptModalComponent],
      providers: [
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('mesAno', '2025-03');
    fixture.componentRef.setInput('expense', mockExpense);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve preencher o campo com o código de comprovante existente', () => {
    expect(component.form.get('codigoComprovante')?.value).toBe('OLD-CODE-123');
  });

  it('deve salvar o novo código de comprovante', async () => {
    component.form.patchValue({
      codigoComprovante: 'PIX-AUTH-887766'
    });

    let savedEmitted = false;
    component.saved.subscribe(() => savedEmitted = true);

    await component.onSubmit();

    expect(mockExpenseService.updateReceiptCode).toHaveBeenCalledWith(
      'user-789',
      '2025-03',
      'exp-99',
      'PIX-AUTH-887766'
    );
    expect(savedEmitted).toBe(true);
  });
});
