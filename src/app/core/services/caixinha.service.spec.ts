import { TestBed } from '@angular/core/testing';
import { CaixinhaService } from './caixinha.service';
import { FirebaseService } from './firebase.service';
import { firstValueFrom, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CaixinhaService (CARD-068)', () => {
  let service: CaixinhaService;
  let mockFirebaseService: any;
  let mockFirestore: any;

  beforeEach(() => {
    mockFirestore = {};
    mockFirebaseService = {
      firestore: mockFirestore
    };

    TestBed.configureTestingModule({
      providers: [
        CaixinhaService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(CaixinhaService);
  });

  it('deve ser instanciado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('Cenário BDD 1: deve retornar caixinha mock em modo e2e ou nulo para id vazio', async () => {
    const resEmpty = await firstValueFrom(service.getCaixinhaStream(''));
    expect(resEmpty).toBeNull();

    const resE2e = await firstValueFrom(service.getCaixinhaStream('e2e-user'));
    expect(resE2e).toEqual(expect.objectContaining({
      userId: 'e2e-user',
      saldo: 1500,
      nome: 'Reserva de Emergência'
    }));
  });

  it('Cenário BDD 2: deve validar que aporte com valor <= 0 lança erro', async () => {
    await expect(service.registrarAporte('user-1', 0)).rejects.toThrow('O valor do aporte deve ser maior que zero.');
    await expect(service.registrarAporte('user-1', -50)).rejects.toThrow('O valor do aporte deve ser maior que zero.');
  });

  it('Cenário BDD 3: deve validar que resgate com valor <= 0 lança erro', async () => {
    await expect(service.registrarResgate('user-1', 0, '2025-03', 1)).rejects.toThrow('O valor do resgate deve ser maior que zero.');
  });
});
