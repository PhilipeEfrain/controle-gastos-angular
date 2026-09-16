import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MonthlyCycleService } from './monthly-cycle.service';
import { FirebaseService } from './firebase.service';

describe('MonthlyCycleService', () => {
  let service: MonthlyCycleService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    TestBed.configureTestingModule({
      providers: [
        MonthlyCycleService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(MonthlyCycleService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });

  describe('Cenário BDD (CARD-088): Continuidade e Herança de Renda para Meses Futuros', () => {
    it('deve salvar e recuperar configuração de renda ativa no cache local', () => {
      const config = {
        renda_quinzena_1: 3500,
        renda_quinzena_2: 2500,
        total_renda: 6000,
        regime_salarial: 'quinzenal' as const,
        dia_pagamento: '31_15',
        descricao_dia_pagamento: 'Dia 31 e Dia 15',
        effectiveFrom: '2026-03',
        updatedAt: '2026-03-01T10:00:00Z'
      };

      service.saveLocalActiveIncome('user_test_1', config);
      const retrieved = service.getLocalActiveIncome('user_test_1');

      expect(retrieved).toEqual(config);
      expect(retrieved?.total_renda).toBe(6000);
      expect(retrieved?.effectiveFrom).toBe('2026-03');
    });

    it('deve retornar ciclo padrão no getCycleStream para usuário e2e', () => {
      return new Promise<void>((resolve) => {
        service.getCycleStream('e2e-test-user', '2026-04').subscribe(cycle => {
          expect(cycle).toBeTruthy();
          expect(cycle?.mesAno).toBe('2026-04');
          expect(cycle?.renda_quinzena_1).toBe(3000);
          expect(cycle?.renda_quinzena_2).toBe(2500);
          expect(cycle?.total_renda).toBe(5500);
          resolve();
        });
      });
    });

    it('deve executar saveIncome para usuário e2e e salvar activeIncomeConfig localmente', async () => {
      const cycle = await service.saveIncome(
        'e2e-test-user',
        '2026-05',
        4000,
        3000,
        'quinzenal',
        '31_15',
        'Dia 31 e Dia 15'
      );

      expect(cycle.mesAno).toBe('2026-05');
      expect(cycle.renda_quinzena_1).toBe(4000);
      expect(cycle.renda_quinzena_2).toBe(3000);
      expect(cycle.total_renda).toBe(7000);

      const activeConfig = service.getLocalActiveIncome('e2e-test-user');
      expect(activeConfig).toBeTruthy();
      expect(activeConfig?.total_renda).toBe(7000);
      expect(activeConfig?.effectiveFrom).toBe('2026-05');
    });

    it('deve retornar null em resolveInheritedCycle para usuário e2e ou id inválido', async () => {
      const res = await service.resolveInheritedCycle('e2e-user', '2026-06');
      expect(res).toBeNull();
    });

    it('deve executar propagateIncomeToFutureCycles sem erros para usuário e2e', async () => {
      await expect(
        service.propagateIncomeToFutureCycles('e2e-user', '2026-05', {
          renda_quinzena_1: 4000,
          renda_quinzena_2: 3000,
          total_renda: 7000,
          effectiveFrom: '2026-05',
          updatedAt: new Date().toISOString()
        })
      ).resolves.toBeUndefined();
    });
  });
});
