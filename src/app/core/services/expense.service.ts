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
import { Expense, RecurringExpense, FortnightNumber } from '../models/finance.model';
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
   * Cadastra uma despesa recorrente mestre (evita duplicatas se já existir mestre com mesma descrição e quinzena)
   */
  async addRecurringExpense(userId: string, recurring: RecurringExpense): Promise<string> {
    if (userId.startsWith('e2e-')) {
      return `rec_${Date.now()}`;
    }

    const recurringColRef = collection(
      this.firestore,
      `users/${userId}/despesas_recorrentes`
    );

    // Evita duplicidade de mestres: se já existir mestre ativo com a mesma descrição e quinzena, reutiliza e atualiza
    const targetDesc = recurring.descricao?.trim().toLowerCase();
    if (targetDesc) {
      try {
        const existingList = await this.getRecurringExpenses(userId);
        const existingMaster = existingList.find(
          r => r.ativo !== false && r.descricao?.trim().toLowerCase() === targetDesc && r.quinzena === recurring.quinzena
        );

        if (existingMaster && existingMaster.id) {
          await this.updateRecurringExpense(userId, existingMaster.id, {
            valor: roundBRL(recurring.valor),
            categoria: recurring.categoria || existingMaster.categoria,
            data_vencimento: recurring.data_vencimento || existingMaster.data_vencimento,
            mes_inicio: recurring.mes_inicio || existingMaster.mes_inicio,
            ativo: true
          });
          return existingMaster.id;
        }
      } catch (err) {
        console.warn('[ExpenseService] Falha não impeditiva ao checar mestres existentes:', err);
      }
    }

    const recurringData = this.sanitizeData({
      ...recurring,
      valor: roundBRL(recurring.valor),
      ativo: recurring.ativo ?? true,
      mes_inicio: recurring.mes_inicio || new Date().toISOString().substring(0, 7),
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
   * Atualiza dados de uma despesa recorrente mestre
   */
  async updateRecurringExpense(
    userId: string,
    recurringId: string,
    data: Partial<RecurringExpense>
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      return;
    }

    const recurringDocRef = doc(
      this.firestore,
      `users/${userId}/despesas_recorrentes/${recurringId}`
    );
    const updatePayload = this.sanitizeData({
      ...data,
      updatedAt: new Date().toISOString()
    });
    if (updatePayload.valor !== undefined) {
      updatePayload.valor = roundBRL(updatePayload.valor);
    }
    await updateDoc(recurringDocRef, updatePayload);
  }

  /**
   * Exclui uma despesa recorrente mestre
   */
  async deleteRecurringExpense(
    userId: string,
    recurringId: string
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      return;
    }

    const recurringDocRef = doc(
      this.firestore,
      `users/${userId}/despesas_recorrentes/${recurringId}`
    );
    await deleteDoc(recurringDocRef);
  }

  /**
   * Exclui uma despesa recorrente mestre e todas as suas ocorrências já salvas
   * a partir do mês especificado (startMesAno) em diante.
   * Meses anteriores (< startMesAno) são estritamente preservados como histórico financeiro.
   */
  async deleteRecurringExpenseAndFutureInstances(
    userId: string,
    startMesAno: string,
    recurringId?: string,
    targetDescription?: string,
    targetQuinzena?: FortnightNumber
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      return;
    }

    // 1. Remove o registro mestre de despesas_recorrentes
    if (recurringId) {
      await this.deleteRecurringExpense(userId, recurringId).catch(() => {});
    }
    if (targetDescription && targetQuinzena) {
      const normalizedDesc = targetDescription.trim().toLowerCase();
      try {
        const masters = await this.getRecurringExpenses(userId);
        const matches = masters.filter(
          m => m.id && m.descricao?.trim().toLowerCase() === normalizedDesc && m.quinzena === targetQuinzena
        );
        for (const m of matches) {
          if (m.id && m.id !== recurringId) {
            await this.deleteRecurringExpense(userId, m.id).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[ExpenseService] Falha ao verificar mestres para exclusão:', err);
      }
    }

    // 2. Mapeia todos os ciclos mensais salvos >= startMesAno
    const futureMonths = new Set<string>();
    try {
      const ciclosColRef = collection(this.firestore, `users/${userId}/ciclos_mensais`);
      const snap = await getDocs(ciclosColRef);
      snap.docs.forEach(d => {
        if (d.id >= startMesAno) {
          futureMonths.add(d.id);
        }
      });
    } catch (err) {
      console.warn('[ExpenseService] Falha ao listar ciclos para exclusão recorrente:', err);
    }

    // Garante cobertura para o mês de exclusão e até 12 meses futuros
    for (let i = 0; i <= 12; i++) {
      futureMonths.add(addMonthsToYearMonth(startMesAno, i));
    }

    const normalizedDesc = targetDescription?.trim().toLowerCase();

    // 3. Deleta as despesas correspondentes em lote nos meses futuros
    for (const month of futureMonths) {
      try {
        const expensesColRef = collection(
          this.firestore,
          `users/${userId}/ciclos_mensais/${month}/despesas`
        );
        const expSnap = await getDocs(expensesColRef);
        if (expSnap.empty) continue;

        const toDelete = expSnap.docs.filter(d => {
          const data = d.data() as Expense;
          if (recurringId && data.recorrente_id === recurringId) {
            return true;
          }
          if (
            normalizedDesc &&
            targetQuinzena &&
            data.recorrente &&
            data.descricao?.trim().toLowerCase() === normalizedDesc &&
            data.quinzena === targetQuinzena
          ) {
            return true;
          }
          return false;
        });

        if (toDelete.length > 0) {
          const batch = writeBatch(this.firestore);
          toDelete.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn(`[ExpenseService] Falha ao deletar despesa recorrente no mês ${month}:`, err);
      }
    }
  }

  /**
   * Sincroniza despesas recorrentes ativas para um mês específico se ainda não existirem.
   * Inclui auto-cura protegida para despesas normais, prevenção contra cache vazio e deduplicação estrita.
   */
  async syncRecurringExpensesForMonth(
    userId: string,
    mesAno: string,
    existingExpenses: Expense[]
  ): Promise<void> {
    if (userId.startsWith('e2e-')) {
      return;
    }

    let actualExpenses = [...existingExpenses];

    // Proteção contra cache vazio / primeira emissão rápida do onSnapshot:
    // Se o array recebido estiver vazio, faz uma leitura pontual autoritativa do Firestore
    // para confirmar se o mês realmente não possui despesas cadastradas antes de gerar o lote.
    if (actualExpenses.length === 0) {
      try {
        const expensesColRef = collection(
          this.firestore,
          `users/${userId}/ciclos_mensais/${mesAno}/despesas`
        );
        const snap = await getDocs(expensesColRef);
        if (!snap.empty) {
          actualExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
        }
      } catch (err) {
        console.warn('[ExpenseService] Falha ao verificar despesas existentes no mês:', err);
      }
    }

    const recurringList = await this.getRecurringExpenses(userId);
    const activeRecurring = recurringList.filter(r => r.ativo !== false);

    if (activeRecurring.length === 0) {
      return;
    }

    // Deduplica mestres ativos por (descrição normalizada + quinzena) para prevenir que mestres duplicados
    // gerem múltiplos lançamentos no mesmo mês
    const uniqueMasters = new Map<string, RecurringExpense>();
    for (const rec of activeRecurring) {
      const key = `${(rec.descricao || '').trim().toLowerCase()}_Q${rec.quinzena}`;
      if (!uniqueMasters.has(key)) {
        uniqueMasters.set(key, rec);
      }
    }

    const missingRecurring = Array.from(uniqueMasters.values()).filter(rec => {
      // Regra fundamental: despesas recorrentes só existem a partir do seu mês de início (mes_inicio <= mesAno).
      // Meses passados (< startMonth) são estritamente protegidos.
      const startMonth = rec.mes_inicio || (rec.createdAt ? rec.createdAt.substring(0, 7) : '');
      if (startMonth && mesAno < startMonth) {
        return false;
      }

      const recDesc = (rec.descricao || '').trim().toLowerCase();
      return !actualExpenses.some(exp => {
        if (exp.recorrente_id && exp.recorrente_id === rec.id) {
          return true;
        }
        const expDesc = (exp.descricao || '').trim().toLowerCase();
        // Se já existe qualquer despesa (mesmo nome e quinzena)
        if (expDesc === recDesc && exp.quinzena === rec.quinzena) {
          return true;
        }
        return false;
      });
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
        mes_inicio: rec.mes_inicio,
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
        recorrente: false,
        recorrente_id: undefined,
        status_pagamento: false,
        createdAt: new Date().toISOString()
      });

      batch.set(expenseRef, installmentData);
    }

    await batch.commit();
    return grupoParcelaId;
  }
}
