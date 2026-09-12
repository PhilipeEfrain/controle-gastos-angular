import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { Expense, RecurringExpense } from '../models/finance.model';
import { roundBRL, addMonthsToYearMonth } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  private e2eExpenses = new Map<string, Expense[]>();
  private e2eExpensesSubject = new Map<string, BehaviorSubject<Expense[]>>();

  /**
   * Retorna um Observable com a lista de despesas de um mês em tempo real
   */
  getExpensesStream(userId: string, mesAno: string): Observable<Expense[]> {
    if (userId.startsWith('e2e-')) {
      const key = `${userId}_${mesAno}`;
      if (!this.e2eExpensesSubject.has(key)) {
        const initial = this.e2eExpenses.get(key) || [];
        this.e2eExpensesSubject.set(key, new BehaviorSubject<Expense[]>(initial));
      }
      return this.e2eExpensesSubject.get(key)!.asObservable();
    }

    return new Observable(subscriber => {
      const expensesColRef = collection(
        this.firestore,
        `users/${userId}/ciclos_mensais/${mesAno}/despesas`
      );
      const unsubscribe = onSnapshot(
        expensesColRef,
        snapshot => {
          const expenses = snapshot.docs.map(
            d => ({ id: d.id, ...d.data() } as Expense)
          );
          subscriber.next(expenses);
        },
        error => subscriber.error(error)
      );
      return { unsubscribe };
    });
  }

  /**
   * Retorna um Observable com as despesas recorrentes mestre em tempo real
   */
  getRecurringExpensesStream(userId: string): Observable<RecurringExpense[]> {
    if (userId.startsWith('e2e-')) {
      return of([]);
    }

    return new Observable(subscriber => {
      const recurringColRef = collection(
        this.firestore,
        `users/${userId}/despesas_recorrentes`
      );
      const unsubscribe = onSnapshot(
        recurringColRef,
        snapshot => {
          const recurring = snapshot.docs.map(
            d => ({ id: d.id, ...d.data() } as RecurringExpense)
          );
          subscriber.next(recurring);
        },
        error => subscriber.error(error)
      );
      return { unsubscribe };
    });
  }

  /**
   * Remove chaves com valor undefined para compatibilidade com o Firestore
   */
  private sanitizeData<T extends Record<string, any>>(obj: T): T {
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Cadastra uma nova despesa simples
   */
  async addExpense(userId: string, mesAno: string, expense: Expense): Promise<string> {
    if (userId.startsWith('e2e-')) {
      const key = `${userId}_${mesAno}`;
      const current = this.e2eExpenses.get(key) || [];
      const newExpense: Expense = {
        ...expense,
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        valor: roundBRL(expense.valor)
      };
      const updated = [newExpense, ...current];
      this.e2eExpenses.set(key, updated);
      if (this.e2eExpensesSubject.has(key)) {
        this.e2eExpensesSubject.get(key)!.next(updated);
      }
      return newExpense.id!;
    }

    const expensesColRef = collection(
      this.firestore,
      `users/${userId}/ciclos_mensais/${mesAno}/despesas`
    );

    const expenseData = this.sanitizeData({
      ...expense,
      valor: roundBRL(expense.valor),
      createdAt: expense.createdAt || new Date().toISOString()
    });

    const docRef = await addDoc(expensesColRef, expenseData);
    return docRef.id;
  }

  /**
   * Cadastra uma despesa recorrente mestre
   */
  async addRecurringExpense(userId: string, recurring: RecurringExpense): Promise<string> {
    if (userId.startsWith('e2e-')) {
      return `rec_${Date.now()}`;
    }

    const recurringColRef = collection(
      this.firestore,
      `users/${userId}/despesas_recorrentes`
    );

    const recurringData = this.sanitizeData({
      ...recurring,
      valor: roundBRL(recurring.valor),
      ativo: recurring.ativo ?? true,
      createdAt: recurring.createdAt || new Date().toISOString()
    });

    const docRef = await addDoc(recurringColRef, recurringData);
    return docRef.id;
  }

  /**
   * Busca despesas recorrentes ativas pontualmente
   */
  async getRecurringExpenses(userId: string): Promise<RecurringExpense[]> {
    const recurringColRef = collection(
      this.firestore,
      `users/${userId}/despesas_recorrentes`
    );
    const snapshot = await getDocs(recurringColRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringExpense));
  }

  /**
   * Sincroniza despesas recorrentes ativas para um mês específico se ainda não existirem
   */
  async syncRecurringExpensesForMonth(
    userId: string,
    mesAno: string,
    existingExpenses: Expense[]
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      return;
    }

    const recurringList = await this.getRecurringExpenses(userId);
    const activeRecurring = recurringList.filter(r => r.ativo !== false);

    if (activeRecurring.length === 0) {
      return;
    }

    const missingRecurring = activeRecurring.filter(rec => {
      return !existingExpenses.some(exp =>
        (exp.recorrente_id && exp.recorrente_id === rec.id) ||
        (exp.recorrente && exp.descricao.trim().toLowerCase() === rec.descricao.trim().toLowerCase() && exp.quinzena === rec.quinzena)
      );
    });

    if (missingRecurring.length === 0) {
      return;
    }

    const batch = writeBatch(this.firestore);
    for (const rec of missingRecurring) {
      const expenseRef = doc(
        collection(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}/despesas`)
      );
      const newExpense: Expense = this.sanitizeData({
        descricao: rec.descricao.trim(),
        valor: roundBRL(rec.valor),
        quinzena: rec.quinzena,
        categoria: rec.categoria,
        recorrente: true,
        recorrente_id: rec.id,
        status_pagamento: false,
        data_vencimento: rec.data_vencimento || '',
        createdAt: new Date().toISOString()
      });
      batch.set(expenseRef, newExpense);
    }

    await batch.commit();
  }

  /**
   * Atualiza dados de uma despesa existente
   */
  async updateExpense(
    userId: string,
    mesAno: string,
    expenseId: string,
    data: Partial<Expense>
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      const key = `${userId}_${mesAno}`;
      const current = this.e2eExpenses.get(key) || [];
      const updated = current.map(e => e.id === expenseId ? { ...e, ...data } : e);
      this.e2eExpenses.set(key, updated);
      if (this.e2eExpensesSubject.has(key)) {
        this.e2eExpensesSubject.get(key)!.next(updated);
      }
      return;
    }

    const expenseDocRef = doc(
      this.firestore,
      `users/${userId}/ciclos_mensais/${mesAno}/despesas/${expenseId}`
    );
    const updatePayload = this.sanitizeData({ ...data });
    if (updatePayload.valor !== undefined) {
      updatePayload.valor = roundBRL(updatePayload.valor);
    }
    await updateDoc(expenseDocRef, updatePayload);
  }

  /**
   * Exclui uma despesa
   */
  async deleteExpense(userId: string, mesAno: string, expenseId: string): Promise<void> {
    if (userId.startsWith('e2e-')) {
      const key = `${userId}_${mesAno}`;
      const current = this.e2eExpenses.get(key) || [];
      const updated = current.filter(e => e.id !== expenseId);
      this.e2eExpenses.set(key, updated);
      if (this.e2eExpensesSubject.has(key)) {
        this.e2eExpensesSubject.get(key)!.next(updated);
      }
      return;
    }

    const expenseDocRef = doc(
      this.firestore,
      `users/${userId}/ciclos_mensais/${mesAno}/despesas/${expenseId}`
    );
    await deleteDoc(expenseDocRef);
  }

  /**
   * Alterna expressamente o status de quitação/pagamento da despesa
   */
  async togglePaymentStatus(
    userId: string,
    mesAno: string,
    expenseId: string,
    currentStatus: boolean
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      const key = `${userId}_${mesAno}`;
      const current = this.e2eExpenses.get(key) || [];
      const updated = current.map(e => e.id === expenseId ? { ...e, status_pagamento: !currentStatus } : e);
      this.e2eExpenses.set(key, updated);
      if (this.e2eExpensesSubject.has(key)) {
        this.e2eExpensesSubject.get(key)!.next(updated);
      }
      return;
    }

    const expenseDocRef = doc(
      this.firestore,
      `users/${userId}/ciclos_mensais/${mesAno}/despesas/${expenseId}`
    );
    await updateDoc(expenseDocRef, {
      status_pagamento: !currentStatus
    });
  }

  /**
   * Atualiza expressamente o código do comprovante bancário
   */
  async updateReceiptCode(
    userId: string,
    mesAno: string,
    expenseId: string,
    code: string
  ): Promise<void> {
    const expenseDocRef = doc(
      this.firestore,
      `users/${userId}/ciclos_mensais/${mesAno}/despesas/${expenseId}`
    );
    await updateDoc(expenseDocRef, {
      codigo_comprovante: code.trim()
    });
  }

  /**
   * Criação atômica de compra parcelada em múltiplos meses futuros via writeBatch
   */
  async createInstallments(
    userId: string,
    startMesAno: string,
    baseExpense: Expense,
    installmentsCount: number
  ): Promise<string> {
    const batch = writeBatch(this.firestore);
    const grupoParcelaId = crypto.randomUUID();
    const valorParcela = roundBRL(baseExpense.valor);

    for (let i = 0; i < installmentsCount; i++) {
      const targetMonth = addMonthsToYearMonth(startMesAno, i);
      const expenseRef = doc(
        collection(this.firestore, `users/${userId}/ciclos_mensais/${targetMonth}/despesas`)
      );

      const installmentData: Expense = this.sanitizeData({
        ...baseExpense,
        descricao: `${baseExpense.descricao} (${i + 1}/${installmentsCount})`,
        valor: valorParcela,
        parcela_atual: i + 1,
        total_parcelas: installmentsCount,
        grupo_parcela_id: grupoParcelaId,
        status_pagamento: false,
        createdAt: new Date().toISOString()
      });

      batch.set(expenseRef, installmentData);
    }

    await batch.commit();
    return grupoParcelaId;
  }
}
