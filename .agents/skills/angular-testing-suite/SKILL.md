---
name: angular-testing-suite
description: Padrões e exemplos para automação de testes unitários e de componentes em Angular com Signals, Component Fixtures e mocks de Firebase.
---

# Skill: Angular Testing Suite (Signals & Firebase Mocks)

## 1. Testes Unitários de Algoritmos Financeiros

Testes puros não necessitam de `TestBed`, rodando em alta velocidade:

```typescript
import { calculateGlobalBalance } from './calculations';
import { Expense } from '../models/finance.model';

describe('calculateGlobalBalance', () => {
  it('deve calcular corretamente o déficit da Q2 coberto pela sobra da Q1', () => {
    const rendaQ1 = 2588.51;
    const rendaQ2 = 2389.28;
    const expenses: Expense[] = [
      { id: '1', descricao: 'Casa', valor: 2059.19, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
      { id: '2', descricao: 'Cartão', valor: 3183.21, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
    ];

    const result = calculateGlobalBalance(rendaQ1, rendaQ2, expenses);

    expect(result.q1.saldo).toBe(529.32);
    expect(result.q2.saldo).toBe(-793.93);
    expect(result.saldoFinal).toBe(-264.61);
    expect(result.temDeficitGlobal).toBeTrue();
    expect(result.q1CobreQ2).toBeFalse();
  });
});
```

## 2. Testes de Componentes Standalone com Signals

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FortnightCardComponent } from './fortnight-card.component';
import { FortnightSummary } from '../../core/models/finance.model';

describe('FortnightCardComponent', () => {
  let component: FortnightCardComponent;
  let fixture: ComponentFixture<FortnightCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FortnightCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FortnightCardComponent);
    component = fixture.componentInstance;
  });

  it('deve renderizar os totais de entrada, saída e saldo', () => {
    const mockSummary: FortnightSummary = {
      quinzena: 1,
      label: 'Quinzena 1 (Dia 31)',
      renda: 2500,
      totalGastos: 1500,
      saldo: 1000,
      isDeficit: false
    };

    fixture.componentRef.setInput('summary', mockSummary);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Quinzena 1 (Dia 31)');
    expect(compiled.textContent).toContain('R$ 1.000,00');
  });
});
```

## 3. Mockando Serviços do Firebase

Utilize Jasmine Spies ou objetos simulados:

```typescript
const mockAuthService = {
  currentUser: signal({ uid: 'user-123', email: 'test@example.com' }),
  loginWithGoogle: jasmine.createSpy('loginWithGoogle').and.resolveTo(),
  logout: jasmine.createSpy('logout').and.resolveTo()
};
```
