---
name: angular-signals-state
description: Guia de boas práticas e padrões para gerenciamento de estado reativo em Angular moderno utilizando Signals, computed, effect e interoperabilidade com RxJS.
---

# Skill: Angular Signals & Reactive State Management

## 1. Princípios Fundamentais de Signals no Angular

- **State Granular**: Use `signal<T>()` para valores primitivos ou objetos imutáveis que representam estado local ou compartilhado.
- **Valores Derivados**: Sempre use `computed()` para cálculos financeiros, totais e filtros. Nunca calcule valores derivados manualmente em métodos de ciclo de vida.
- **Detecção de Mudanças**: Defina `changeDetection: ChangeDetectionStrategy.OnPush` em todos os componentes Standalone.

## 2. Exemplo de Pattern de State Store com Signals

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { Expense, MonthlyCycle, MonthBalanceSummary } from '../models/finance.model';
import { calculateGlobalBalance } from '../utils/calculations';

@Injectable({ providedIn: 'root' })
export class FinanceStore {
  // Estado privado
  private readonly _selectedMonth = signal<string>(this.getCurrentYearMonth());
  private readonly _currentCycle = signal<MonthlyCycle | null>(null);
  private readonly _expenses = signal<Expense[]>([]);
  private readonly _isLoading = signal<boolean>(false);

  // Seletores públicos (ReadOnly Signals)
  readonly selectedMonth = this._selectedMonth.asReadonly();
  readonly currentCycle = this._currentCycle.asReadonly();
  readonly expenses = this._expenses.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Valores Computados Derivados
  readonly q1Expenses = computed(() =>
    this._expenses().filter(e => e.quinzena === 1)
  );

  readonly q2Expenses = computed(() =>
    this._expenses().filter(e => e.quinzena === 2)
  );

  readonly balanceSummary = computed<MonthBalanceSummary>(() => {
    const cycle = this._currentCycle();
    const rendaQ1 = cycle?.renda_quinzena_1 ?? 0;
    const rendaQ2 = cycle?.renda_quinzena_2 ?? 0;
    return calculateGlobalBalance(rendaQ1, rendaQ2, this._expenses());
  });

  // Métodos de Mutação
  setSelectedMonth(month: string) {
    this._selectedMonth.set(month);
  }

  setExpenses(expenses: Expense[]) {
    this._expenses.set(expenses);
  }

  setCycle(cycle: MonthlyCycle | null) {
    this._currentCycle.set(cycle);
  }

  setLoading(loading: boolean) {
    this._isLoading.set(loading);
  }

  private getCurrentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
```

## 3. Interoperabilidade com RxJS e Firestore

Use `toSignal()` quando for consumir streams assíncronas do Firestore com fallback/initialValue seguro:

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

@Component({ ... })
export class DashboardComponent {
  private monthlyCycleService = inject(MonthlyCycleService);
  
  readonly cycle = toSignal(
    this.monthlyCycleService.getCycleStream('2025-03'),
    { initialValue: null }
  );
}
```
