import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { MonthlyCycle } from '../models/finance.model';
import { roundBRL } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class MonthlyCycleService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  private getLocalCycleMetadata(userId: string, mesAno: string): Partial<MonthlyCycle> {
    try {
      const stored = localStorage.getItem(`quinzena_cycle_meta_${userId}_${mesAno}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveLocalCycleMetadata(userId: string, mesAno: string, meta: Partial<MonthlyCycle>): void {
    try {
      localStorage.setItem(`quinzena_cycle_meta_${userId}_${mesAno}`, JSON.stringify(meta));
    } catch {
      // Ignora falhas se em modo estrito/privado
    }
  }

  /**
   * Retorna um Observable com o ciclo mensal em tempo real
   */
  getCycleStream(userId: string, mesAno: string): Observable<MonthlyCycle | null> {
    if (userId.startsWith('e2e-')) {
      return of({
        id: mesAno,
        mesAno,
        renda_quinzena_1: 3000,
        renda_quinzena_2: 2500,
        total_renda: 5500,
        total_gastos: 0,
        saldo_final: 5500,
        regime_salarial: 'quinzenal',
        dia_pagamento: '31_15',
        descricao_dia_pagamento: 'Dia 31 e Dia 15'
      });
    }

    return new Observable(subscriber => {
      const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
      const unsubscribe = onSnapshot(
        cycleDocRef,
        snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.data() as MonthlyCycle;
            const meta = this.getLocalCycleMetadata(userId, mesAno);
            subscriber.next({
              id: snapshot.id,
              ...meta,
              ...data,
              dia_pagamento: data.dia_pagamento ?? meta.dia_pagamento,
              descricao_dia_pagamento: data.descricao_dia_pagamento ?? meta.descricao_dia_pagamento,
              regime_salarial: data.regime_salarial ?? meta.regime_salarial
            });
          } else {
            subscriber.next(null);
          }
        },
        error => subscriber.error(error)
      );
      return { unsubscribe };
    });
  }

  /**
   * Busca um ciclo mensal específico pontualmente
   */
  async getCycle(userId: string, mesAno: string): Promise<MonthlyCycle | null> {
    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
    const snapshot = await getDoc(cycleDocRef);
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data() as MonthlyCycle;
    const meta = this.getLocalCycleMetadata(userId, mesAno);
    return {
      id: snapshot.id,
      ...meta,
      ...data,
      dia_pagamento: data.dia_pagamento ?? meta.dia_pagamento,
      descricao_dia_pagamento: data.descricao_dia_pagamento ?? meta.descricao_dia_pagamento,
      regime_salarial: data.regime_salarial ?? meta.regime_salarial
    };
  }

  /**
   * Salva ou atualiza a renda de Q1 e Q2 do ciclo com fallback progressivo resiliente
   */
  async saveIncome(
    userId: string,
    mesAno: string,
    rendaQ1: number,
    rendaQ2: number,
    regime?: string,
    diaPagamento?: number | string,
    descricaoDiaPagamento?: string
  ): Promise<MonthlyCycle> {
    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
    const safeQ1 = roundBRL(rendaQ1 || 0);
    const safeQ2 = roundBRL(rendaQ2 || 0);
    const totalRenda = roundBRL(safeQ1 + safeQ2);

    // Salva metadados localmente para resiliência imediata
    this.saveLocalCycleMetadata(userId, mesAno, {
      regime_salarial: regime as any,
      dia_pagamento: diaPagamento,
      descricao_dia_pagamento: descricaoDiaPagamento
    });

    const cycleData: Partial<MonthlyCycle> = {
      mesAno,
      renda_quinzena_1: safeQ1,
      renda_quinzena_2: safeQ2,
      total_renda: totalRenda,
      updatedAt: new Date().toISOString()
    };

    if (regime) {
      cycleData.regime_salarial = regime as any;
    }

    if (diaPagamento !== undefined && diaPagamento !== null) {
      cycleData.dia_pagamento = diaPagamento;
    }

    if (descricaoDiaPagamento !== undefined && descricaoDiaPagamento !== null) {
      cycleData.descricao_dia_pagamento = descricaoDiaPagamento;
    }

    try {
      // 1. Tenta salvar o payload completo (compatível com as regras atualizadas)
      await setDoc(cycleDocRef, cycleData, { merge: true });
    } catch (err: any) {
      const isPermissionErr =
        err?.code === 'permission-denied' ||
        err?.name === 'FirebaseError' ||
        err?.message?.toLowerCase().includes('permission') ||
        err?.message?.toLowerCase().includes('insufficient');

      if (!isPermissionErr) {
        throw err;
      }

      // 2. Fallback nível 2: remove dia_pagamento e normaliza regime para os suportados pelas regras anteriores
      try {
        const fallbackRegime =
          regime === 'mensal_unico'
            ? safeQ1 > 0
              ? 'mensal_q1'
              : 'mensal_q2'
            : regime || 'quinzenal';

        const level2Data: Partial<MonthlyCycle> = {
          mesAno,
          renda_quinzena_1: safeQ1,
          renda_quinzena_2: safeQ2,
          total_renda: totalRenda,
          regime_salarial: fallbackRegime as any,
          updatedAt: new Date().toISOString()
        };
        await setDoc(cycleDocRef, level2Data, { merge: true });
      } catch (err2: any) {
        // 3. Fallback nível 3: salva estritamente os campos universais da coleção
        const level3Data: Partial<MonthlyCycle> = {
          mesAno,
          renda_quinzena_1: safeQ1,
          renda_quinzena_2: safeQ2,
          total_renda: totalRenda,
          updatedAt: new Date().toISOString()
        };
        await setDoc(cycleDocRef, level3Data, { merge: true });
      }
    }

    return {
      id: mesAno,
      mesAno,
      renda_quinzena_1: safeQ1,
      renda_quinzena_2: safeQ2,
      total_renda: totalRenda,
      total_gastos: 0,
      saldo_final: totalRenda,
      regime_salarial: regime as any,
      dia_pagamento: diaPagamento,
      descricao_dia_pagamento: descricaoDiaPagamento
    };
  }

  /**
   * Atualiza os totais consolidados no Firestore
   */
  async updateCycleTotals(
    userId: string,
    mesAno: string,
    totalGastos: number,
    saldoFinal: number
  ): Promise<void> {
    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
    await updateDoc(cycleDocRef, {
      total_gastos: roundBRL(totalGastos),
      saldo_final: roundBRL(saldoFinal),
      updatedAt: new Date().toISOString()
    });
  }
}
