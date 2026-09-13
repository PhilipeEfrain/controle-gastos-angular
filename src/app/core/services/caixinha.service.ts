import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { Caixinha, CaixinhaMovimentacao } from '../models/caixinha.model';
import { Expense, FortnightNumber } from '../models/finance.model';
import { roundBRL } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class CaixinhaService {
  private readonly firebaseService = inject(FirebaseService);

  private get db() {
    return this.firebaseService.firestore;
  }

  /**
   * Stream reativa do documento da Caixinha de Emergência
   */
  getCaixinhaStream(userId: string): Observable<Caixinha | null> {
    if (!userId) {
      return of(null);
    }

    if (userId.startsWith('e2e-')) {
      return of({
        id: 'principal',
        userId,
        saldo: 1500,
        meta: 5000,
        nome: 'Reserva de Emergência'
      });
    }

    return new Observable<Caixinha | null>(observer => {
      const docRef = doc(this.db, 'users', userId, 'caixinhas', 'principal');
      const unsubscribe = onSnapshot(
        docRef,
        snapshot => {
          if (snapshot.exists()) {
            observer.next({ id: snapshot.id, ...(snapshot.data() as Omit<Caixinha, 'id'>) });
          } else {
            observer.next(null);
          }
        },
        err => observer.error(err)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Busca direta sob demanda da Caixinha
   */
  async getCaixinha(userId: string): Promise<Caixinha | null> {
    if (!userId) return null;
    const docRef = doc(this.db, 'users', userId, 'caixinhas', 'principal');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Caixinha, 'id'>) };
  }

  /**
   * Inicializa ou atualiza os parâmetros da Caixinha
   */
  async initOrUpdateCaixinha(userId: string, saldoInicial: number, meta: number | null = null, nome = 'Reserva de Emergência'): Promise<void> {
    const docRef = doc(this.db, 'users', userId, 'caixinhas', 'principal');
    const existing = await this.getCaixinha(userId);

    const data: Caixinha = {
      userId,
      saldo: roundBRL(saldoInicial),
      meta: meta !== null && meta !== undefined ? roundBRL(meta) : null,
      nome: nome || 'Reserva de Emergência',
      updatedAt: new Date().toISOString()
    };

    if (!existing) {
      data.createdAt = new Date().toISOString();
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    await setDoc(docRef, cleanData, { merge: true });
  }

  /**
   * Stream reativa das últimas movimentações com limit(20) para evitar consumo desnecessário
   */
  getMovimentacoesStream(userId: string, limitCount = 20): Observable<CaixinhaMovimentacao[]> {
    if (!userId || userId.startsWith('e2e-')) {
      return of([]);
    }

    return new Observable<CaixinhaMovimentacao[]>(observer => {
      const colRef = collection(this.db, 'users', userId, 'caixinhas', 'principal', 'movimentacoes');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));

      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          const items = snapshot.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<CaixinhaMovimentacao, 'id'>)
          }));
          observer.next(items);
        },
        err => observer.error(err)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Registra um aporte (guardar dinheiro) na Caixinha através de transação atômica
   */
  async registrarAporte(userId: string, valor: number, observacao?: string): Promise<void> {
    if (valor <= 0) {
      throw new Error('O valor do aporte deve ser maior que zero.');
    }

    const caixinhaDocRef = doc(this.db, 'users', userId, 'caixinhas', 'principal');
    const caixinhaSnap = await getDoc(caixinhaDocRef);

    let currentSaldo = 0;
    let meta: number | null = null;
    let nome = 'Reserva de Emergência';

    if (caixinhaSnap.exists()) {
      const d = caixinhaSnap.data() as Caixinha;
      currentSaldo = d.saldo || 0;
      meta = d.meta ?? null;
      nome = d.nome || 'Reserva de Emergência';
    }

    const novoSaldo = roundBRL(currentSaldo + valor);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const batch = writeBatch(this.db);

    // 1. Atualiza Caixinha
    const updatedCaixinha: Caixinha = {
      userId,
      saldo: novoSaldo,
      meta,
      nome,
      updatedAt: now.toISOString()
    };
    if (!caixinhaSnap.exists()) {
      updatedCaixinha.createdAt = now.toISOString();
    }
    const cleanCaixinha = Object.fromEntries(
      Object.entries(updatedCaixinha).filter(([_, v]) => v !== undefined)
    );
    batch.set(caixinhaDocRef, cleanCaixinha, { merge: true });

    // 2. Registra Movimentação
    const movColRef = collection(this.db, 'users', userId, 'caixinhas', 'principal', 'movimentacoes');
    const movDocRef = doc(movColRef);
    const movPayload: CaixinhaMovimentacao = {
      id: movDocRef.id,
      caixinhaId: 'principal',
      userId,
      tipo: 'aporte',
      valor: roundBRL(valor),
      data: todayStr,
      observacao: observacao?.trim() || 'Aporte na Reserva',
      createdAt: now.toISOString()
    };
    const cleanMov = Object.fromEntries(
      Object.entries(movPayload).filter(([_, v]) => v !== undefined)
    );
    batch.set(movDocRef, cleanMov);

    await batch.commit();
  }

  /**
   * Registra um resgate (retirar dinheiro) da Caixinha.
   * O valor retirado é inserido automaticamente no ciclo quinzenal como Renda Extra para cobrir despesas!
   */
  async registrarResgate(
    userId: string,
    valor: number,
    mesAno: string,
    quinzena: 1 | 2,
    observacao?: string
  ): Promise<void> {
    if (valor <= 0) {
      throw new Error('O valor do resgate deve ser maior que zero.');
    }

    const caixinhaDocRef = doc(this.db, 'users', userId, 'caixinhas', 'principal');
    const caixinhaSnap = await getDoc(caixinhaDocRef);

    if (!caixinhaSnap.exists()) {
      throw new Error('Caixinha de Emergência não encontrada.');
    }

    const caixinhaData = caixinhaSnap.data() as Caixinha;
    const currentSaldo = caixinhaData.saldo || 0;

    if (currentSaldo < valor) {
      throw new Error(`Saldo insuficiente na caixinha (Saldo atual: R$ ${currentSaldo.toFixed(2)}).`);
    }

    const novoSaldo = roundBRL(currentSaldo - valor);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const batch = writeBatch(this.db);

    // 1. Atualiza Caixinha
    batch.update(caixinhaDocRef, {
      saldo: novoSaldo,
      updatedAt: now.toISOString()
    });

    // 2. Registra Movimentação
    const movColRef = collection(this.db, 'users', userId, 'caixinhas', 'principal', 'movimentacoes');
    const movDocRef = doc(movColRef);
    const movPayload: CaixinhaMovimentacao = {
      id: movDocRef.id,
      caixinhaId: 'principal',
      userId,
      tipo: 'resgate',
      valor: roundBRL(valor),
      data: todayStr,
      mesAnoDestino: mesAno,
      quinzenaDestino: quinzena,
      observacao: observacao?.trim() || 'Resgate para cobrir despesas',
      createdAt: now.toISOString()
    };
    const cleanMov = Object.fromEntries(
      Object.entries(movPayload).filter(([_, v]) => v !== undefined)
    );
    batch.set(movDocRef, cleanMov);

    // 3. Insere como Renda Extra no ciclo quinzenal do mês selecionado
    const expenseColRef = collection(this.db, 'users', userId, 'ciclos_mensais', mesAno, 'despesas');
    const expenseDocRef = doc(expenseColRef);
    const expensePayload: Expense = {
      id: expenseDocRef.id,
      tipo: 'renda_extra',
      descricao: observacao?.trim() ? `Resgate Caixinha: ${observacao.trim()}` : 'Resgate da Caixinha de Emergência',
      valor: roundBRL(valor),
      quinzena: quinzena as FortnightNumber,
      categoria: 'Reserva & Investimentos',
      status_pagamento: true
    };
    batch.set(expenseDocRef, expensePayload);

    await batch.commit();
  }
}
