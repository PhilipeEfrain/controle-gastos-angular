---
name: angular-firebase-firestore
description: Práticas para integração do Angular com Firebase Modular SDK e AngularFire (Auth, Firestore streams, batch writes e regras de segurança).
---

# Skill: AngularFire & Firestore Reactive Integration

## 1. Inicialização Modular do Firebase no Angular

Configuração nos providers da aplicação (`app.config.ts`):

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ]
};
```

## 2. Padrão de Serviço Reativo com Firestore Modular

```typescript
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Expense } from '../models/finance.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);

  getExpenses(userId: string, mesAno: string): Observable<Expense[]> {
    const expensesRef = collection(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}/despesas`);
    return collectionData(expensesRef, { idField: 'id' }) as Observable<Expense[]>;
  }

  async togglePaymentStatus(userId: string, mesAno: string, expenseId: string, currentStatus: boolean): Promise<void> {
    const expenseDoc = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}/despesas/${expenseId}`);
    await updateDoc(expenseDoc, { status_pagamento: !currentStatus });
  }

  async createInstallments(userId: string, startMesAno: string, baseExpense: Expense, installmentsCount: number): Promise<void> {
    const batch = writeBatch(this.firestore);
    const grupoParcelaId = crypto.randomUUID();

    for (let i = 0; i < installmentsCount; i++) {
      const targetMonth = this.addMonths(startMesAno, i);
      const expenseRef = doc(collection(this.firestore, `users/${userId}/ciclos_mensais/${targetMonth}/despesas`));
      
      const installmentData: Expense = {
        ...baseExpense,
        descricao: `${baseExpense.descricao} (${i + 1}/${installmentsCount})`,
        parcela_atual: i + 1,
        total_parcelas: installmentsCount,
        grupo_parcela_id: grupoParcelaId,
        status_pagamento: false
      };

      batch.set(expenseRef, installmentData);
    }

    await batch.commit();
  }

  private addMonths(yearMonth: string, count: number): string {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + count, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
```

## 3. Segurança Firestore (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /ciclos_mensais/{mesAno} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        match /despesas/{despesaId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      
      match /tributos_e_parcelas/{tributoId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```
