import { describe, it, expect } from 'vitest';
import {
  roundBRL,
  sumExpenses,
  filterExpensesByFortnight,
  calculateFortnightBalance,
  calculateGlobalBalance,
  addMonthsToYearMonth
} from './calculations';
import { Expense } from '../models/finance.model';

describe('Calculations Utility (Motor Financeiro)', () => {
  describe('roundBRL', () => {
    it('deve arredondar operações de ponto flutuante evitando dízimas espúrias (0.1 + 0.2)', () => {
      const somaFlutuante = 0.1 + 0.2;
      expect(roundBRL(somaFlutuante)).toBe(0.3);
    });

    it('deve retornar 0 para valores nulos, undefined ou NaN', () => {
      expect(roundBRL(null)).toBe(0);
      expect(roundBRL(undefined)).toBe(0);
      expect(roundBRL(NaN)).toBe(0);
    });

    it('deve arredondar com precisão de 2 casas decimais', () => {
      expect(roundBRL(1234.567)).toBe(1234.57);
      expect(roundBRL(1234.564)).toBe(1234.56);
    });
  });

  describe('sumExpenses', () => {
    it('deve somar valores de despesas com exatidão', () => {
      const expenses: Expense[] = [
        { descricao: 'Aluguel', valor: 1500.55, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
        { descricao: 'Internet', valor: 120.45, quinzena: 1, status_pagamento: false, categoria: 'Serviços' }
      ];

      expect(sumExpenses(expenses)).toBe(1621.0);
    });

    it('deve retornar 0 para lista vazia ou nula', () => {
      expect(sumExpenses([])).toBe(0);
    });
  });

  describe('filterExpensesByFortnight', () => {
    const mockExpenses: Expense[] = [
      { descricao: 'Conta 1', valor: 100, quinzena: 1, status_pagamento: false, categoria: 'Outros' },
      { descricao: 'Conta 2', valor: 200, quinzena: 2, status_pagamento: false, categoria: 'Outros' },
      { descricao: 'Conta 3', valor: 300, quinzena: 1, status_pagamento: true, categoria: 'Outros' }
    ];

    it('deve filtrar despesas apenas da Quinzena 1', () => {
      const q1 = filterExpensesByFortnight(mockExpenses, 1);
      expect(q1.length).toBe(2);
      expect(q1.every(e => e.quinzena === 1)).toBe(true);
    });

    it('deve filtrar despesas apenas da Quinzena 2', () => {
      const q2 = filterExpensesByFortnight(mockExpenses, 2);
      expect(q2.length).toBe(1);
      expect(q2[0].descricao).toBe('Conta 2');
    });
  });

  describe('calculateFortnightBalance', () => {
    it('deve calcular saldo positivo da quinzena', () => {
      const expenses: Expense[] = [
        { descricao: 'Mercado', valor: 600, quinzena: 1, status_pagamento: false, categoria: 'Alimentação' }
      ];
      expect(calculateFortnightBalance(2000, expenses)).toBe(1400);
    });

    it('deve calcular saldo negativo quando despesas superam a renda', () => {
      const expenses: Expense[] = [
        { descricao: 'Cartão', valor: 2500, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
      ];
      expect(calculateFortnightBalance(2000, expenses)).toBe(-500);
    });
  });

  describe('calculateGlobalBalance', () => {
    it('Cenário BDD: Balanço superavitário onde Q1 cobre déficit de Q2', () => {
      const rendaQ1 = 3000;
      const rendaQ2 = 2000;
      const expenses: Expense[] = [
        { descricao: 'Despesa Q1', valor: 2000, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
        { descricao: 'Despesa Q2', valor: 2600, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
      ];

      const balance = calculateGlobalBalance(rendaQ1, rendaQ2, expenses);

      expect(balance.q1.saldo).toBe(1000);
      expect(balance.q1.isDeficit).toBe(false);
      expect(balance.q2.saldo).toBe(-600);
      expect(balance.q2.isDeficit).toBe(true);
      expect(balance.saldoFinal).toBe(400);
      expect(balance.temDeficitGlobal).toBe(false);
      expect(balance.q1CobreQ2).toBe(true);
    });

    it('Cenário BDD: Déficit Global onde a sobra da Q1 NÃO cobre o rombo de Q2', () => {
      const rendaQ1 = 2000;
      const rendaQ2 = 1000;
      const expenses: Expense[] = [
        { descricao: 'Despesa Q1', valor: 1700, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
        { descricao: 'Despesa Q2', valor: 1800, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
      ];

      const balance = calculateGlobalBalance(rendaQ1, rendaQ2, expenses);

      expect(balance.q1.saldo).toBe(300);
      expect(balance.q2.saldo).toBe(-800);
      expect(balance.saldoFinal).toBe(-500);
      expect(balance.temDeficitGlobal).toBe(true);
      expect(balance.q1CobreQ2).toBe(false);
    });

    it('deve calcular percentual de comprometimento da renda por quinzena', () => {
      const rendaQ1 = 2000;
      const rendaQ2 = 2000;
      const expenses: Expense[] = [
        { descricao: 'Despesa Q1', valor: 1000, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
        { descricao: 'Despesa Q2', valor: 1500, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
      ];

      const balance = calculateGlobalBalance(rendaQ1, rendaQ2, expenses);

      expect(balance.q1.percentualGasto).toBe(50);
      expect(balance.q2.percentualGasto).toBe(75);
    });
  });

  describe('addMonthsToYearMonth', () => {
    it('Cenário BDD: Projeção de parcelas com virada de ano', () => {
      expect(addMonthsToYearMonth('2025-11', 0)).toBe('2025-11');
      expect(addMonthsToYearMonth('2025-11', 1)).toBe('2025-12');
      expect(addMonthsToYearMonth('2025-11', 2)).toBe('2026-01');
      expect(addMonthsToYearMonth('2025-11', 3)).toBe('2026-02');
    });

    it('deve retroceder meses quando count for negativo', () => {
      expect(addMonthsToYearMonth('2026-02', -2)).toBe('2025-12');
    });
  });
});
