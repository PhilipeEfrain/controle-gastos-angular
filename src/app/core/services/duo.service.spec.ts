import { TestBed } from '@angular/core/testing';
import { DuoService } from './duo.service';
import { FirebaseService } from './firebase.service';
import { Expense } from '../models/finance.model';

describe('DuoService', () => {
  let service: DuoService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {},
      auth: {}
    };

    TestBed.configureTestingModule({
      providers: [
        DuoService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(DuoService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeTruthy();
  });

  describe('generateInviteCode', () => {
    it('deve gerar código no formato DUO-XXXX', () => {
      const code = service.generateInviteCode();
      expect(code).toMatch(/^DUO-\d{4}$/);
    });
  });

  describe('calculateSettlement', () => {
    const mockExpenses: Expense[] = [
      {
        id: '1',
        descricao: 'Aluguel',
        valor: 2000,
        categoria: 'Moradia',
        quinzena: 1,
        status_pagamento: true,
        tipo: 'despesa',
        codigo_comprovante: 'user-owner'
      },
      {
        id: '2',
        descricao: 'Supermercado',
        valor: 1000,
        categoria: 'Alimentação',
        quinzena: 1,
        status_pagamento: true,
        tipo: 'despesa',
        codigo_comprovante: 'user-partner'
      }
    ];

    it('Cenário BDD (Cálculo 50/50): deve calcular quando o parceiro deve ao titular', () => {
      const summary = service.calculateSettlement(
        mockExpenses,
        'user-owner',
        'Philipe',
        'user-partner',
        'Mariana'
      );

      expect(summary.totalShared).toBe(3000);
      expect(summary.targetSharePerPerson).toBe(1500);
      expect(summary.ownerTotalPaid).toBe(2000);
      expect(summary.partnerTotalPaid).toBe(1000);
      expect(summary.debtor).toBe('partner');
      expect(summary.settlementAmount).toBe(500);
      expect(summary.message).toContain('Mariana deve transferir R$ 500,00 para Philipe');
    });

    it('Cenário BDD: deve informar equilíbrio quando ambos pagam o mesmo valor', () => {
      const equalExpenses: Expense[] = [
        {
          id: '1',
          descricao: 'Conta Luz',
          valor: 500,
          categoria: 'Utilidades',
          quinzena: 1,
          status_pagamento: true,
          codigo_comprovante: 'user-owner'
        },
        {
          id: '2',
          descricao: 'Conta Internet',
          valor: 500,
          categoria: 'Utilidades',
          quinzena: 1,
          status_pagamento: true,
          codigo_comprovante: 'user-partner'
        }
      ];

      const summary = service.calculateSettlement(
        equalExpenses,
        'user-owner',
        'Philipe',
        'user-partner',
        'Mariana'
      );

      expect(summary.debtor).toBe('even');
      expect(summary.settlementAmount).toBe(0);
      expect(summary.message).toContain('Tudo equilibrado!');
    });
  });

  describe('getSharedExpensesStream', () => {
    it('deve retornar observable vazio se groupId for inválido ou e2e', async () => {
      const { firstValueFrom } = await import('rxjs');
      const items = await firstValueFrom(service.getSharedExpensesStream('e2e-user', '2026-09'));
      expect(items).toEqual([]);
    });

    it('deve retornar observable vazio se groupId for vazio', async () => {
      const { firstValueFrom } = await import('rxjs');
      const items = await firstValueFrom(service.getSharedExpensesStream('', '2026-09'));
      expect(items).toEqual([]);
    });
  });

  describe('calculateSettlementFromShared', () => {
    it('Cenário BDD: deve calcular acerto com precisão com base em despesas compartilhadas', () => {
      const sharedList = [
        {
          id: 's1',
          descricao: 'Geladeira',
          valorTotal: 2000,
          valorOwner: 1000,
          valorPartner: 1000,
          pagoPorId: 'user-owner',
          pagoPorNome: 'Philipe',
          quinzena: 1 as const,
          mesAno: '2026-09',
          tipoDivisao: '50_50' as const,
          members: ['user-owner', 'user-partner']
        },
        {
          id: 's2',
          descricao: 'Fogão',
          valorTotal: 800,
          valorOwner: 400,
          valorPartner: 400,
          pagoPorId: 'user-partner',
          pagoPorNome: 'Mariana',
          quinzena: 1 as const,
          mesAno: '2026-09',
          tipoDivisao: '50_50' as const,
          members: ['user-owner', 'user-partner']
        }
      ];

      const settlement = service.calculateSettlementFromShared(
        sharedList,
        'user-owner',
        'Philipe',
        'user-partner',
        'Mariana'
      );

      // Philipe pagou 2000 (cota 1400) -> pagou 600 a mais
      // Mariana pagou 800 (cota 1400) -> pagou 600 a menos
      expect(settlement.ownerTotalPaid).toBe(2000);
      expect(settlement.partnerTotalPaid).toBe(800);
      expect(settlement.totalShared).toBe(2800);
      expect(settlement.debtor).toBe('partner');
      expect(settlement.settlementAmount).toBe(600);
      expect(settlement.message).toContain('Mariana deve transferir R$ 600,00 para Philipe');
    });

    it('Cenário BDD: deve identificar equilíbrio exato de despesas compartilhadas', () => {
      const sharedList = [
        {
          id: 's1',
          descricao: 'Mercado',
          valorTotal: 1000,
          valorOwner: 500,
          valorPartner: 500,
          pagoPorId: 'user-owner',
          pagoPorNome: 'Philipe',
          quinzena: 1 as const,
          mesAno: '2026-09',
          tipoDivisao: '50_50' as const,
          members: ['user-owner', 'user-partner']
        },
        {
          id: 's2',
          descricao: 'Farmácia',
          valorTotal: 1000,
          valorOwner: 500,
          valorPartner: 500,
          pagoPorId: 'user-partner',
          pagoPorNome: 'Mariana',
          quinzena: 2 as const,
          mesAno: '2026-09',
          tipoDivisao: '50_50' as const,
          members: ['user-owner', 'user-partner']
        }
      ];

      const settlement = service.calculateSettlementFromShared(
        sharedList,
        'user-owner',
        'Philipe',
        'user-partner',
        'Mariana'
      );

      expect(settlement.debtor).toBe('even');
      expect(settlement.settlementAmount).toBe(0);
      expect(settlement.message).toContain('Tudo equilibrado!');
    });
  });
});
