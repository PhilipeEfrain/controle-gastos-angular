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
});
