import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ExpenseService } from './expense.service';
import { FirebaseService } from './firebase.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(ExpenseService);
  });

  it('deve instanciar o serviço de despesas com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('deve retornar id fictício ao adicionar despesa recorrente para usuário e2e', async () => {
    const recId = await service.addRecurringExpense('e2e-user', {
      descricao: 'Internet Fibra',
      valor: 100,
      quinzena: 1,
      categoria: 'Serviços & Assinaturas',
      ativo: true
    });
    expect(recId).toMatch(/^rec_\d+$/);
  });

  it('deve executar updateRecurringExpense sem erros para usuário e2e', async () => {
    await expect(
      service.updateRecurringExpense('e2e-user', 'rec_123', { valor: 150 })
    ).resolves.toBeUndefined();
  });

  it('deve executar deleteRecurringExpense sem erros para usuário e2e', async () => {
    await expect(
      service.deleteRecurringExpense('e2e-user', 'rec_123')
    ).resolves.toBeUndefined();
  });

  it('deve executar syncRecurringExpensesForMonth sem erros para usuário e2e', async () => {
    await expect(
      service.syncRecurringExpensesForMonth('e2e-user', '2025-04', [])
    ).resolves.toBeUndefined();
  });
});
