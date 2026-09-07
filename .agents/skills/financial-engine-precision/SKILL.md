---
name: financial-engine-precision
description: Regras e padrões de precisão numérica, arredondamentos de moeda BRL, cálculos quinzenais e projeções de parcelamento.
---

# Skill: Financial Engine Precision & Currency Calculations

## 1. Tratamento de Ponto Flutuante em JavaScript/TypeScript

Cálculos monetários em JavaScript estão sujeitos a erros de precisão de ponto flutuante (ex: `0.1 + 0.2 = 0.30000000000000004`).
Para evitar inconsistências financeiras:

- Arredonde cada operação para duas casas decimais utilizando `Number(val.toFixed(2))` ou operando em centavos inteiros (`Math.round(val * 100)`).
- Nunca compare floats diretamente com `===` sem tolerância (`EPSILON`) se houver multiplicações/divisões intermediárias.

```typescript
export const roundBRL = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};
```

## 2. Lógica de Balanço Quinzenal e Cobertura de Déficit

```typescript
export function calculateGlobalBalance(
  rendaQ1: number,
  rendaQ2: number,
  expenses: Expense[]
): MonthBalanceSummary {
  const q1Expenses = expenses.filter(e => e.quinzena === 1);
  const q2Expenses = expenses.filter(e => e.quinzena === 2);

  const totalGastosQ1 = roundBRL(q1Expenses.reduce((acc, curr) => acc + (curr.valor || 0), 0));
  const totalGastosQ2 = roundBRL(q2Expenses.reduce((acc, curr) => acc + (curr.valor || 0), 0));

  const saldoQ1 = roundBRL(rendaQ1 - totalGastosQ1);
  const saldoQ2 = roundBRL(rendaQ2 - totalGastosQ2);

  const totalRenda = roundBRL(rendaQ1 + rendaQ2);
  const totalGastos = roundBRL(totalGastosQ1 + totalGastosQ2);
  const saldoFinal = roundBRL(totalRenda - totalGastos);

  const q1CobreQ2 = saldoQ2 < 0 ? roundBRL(saldoQ1 + saldoQ2) >= 0 : true;

  return {
    totalRenda,
    totalGastos,
    saldoFinal,
    temDeficitGlobal: saldoFinal < 0,
    q1: {
      quinzena: 1,
      label: 'Quinzena 1 (Dia 31)',
      renda: rendaQ1,
      totalGastos: totalGastosQ1,
      saldo: saldoQ1,
      isDeficit: saldoQ1 < 0
    },
    q2: {
      quinzena: 2,
      label: 'Quinzena 2 (Dia 15)',
      renda: rendaQ2,
      totalGastos: totalGastosQ2,
      saldo: saldoQ2,
      isDeficit: saldoQ2 < 0
    },
    q1CobreQ2
  };
}
```
