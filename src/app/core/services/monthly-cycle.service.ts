import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { MonthlyCycle } from '../models/finance.model';
import { roundBRL } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class MonthlyCycleService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  /**
   * Retorna um Observable com o ciclo mensal em tempo real
   */
  getCycleStream(userId: string, mesAno: string): Observable<MonthlyCycle | null> {
    return new Observable(subscriber => {
      const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
      const unsubscribe = onSnapshot(
        cycleDocRef,
        snapshot => {
          if (snapshot.exists()) {
            subscriber.next({ id: snapshot.id, ...snapshot.data() } as MonthlyCycle);
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
    return { id: snapshot.id, ...snapshot.data() } as MonthlyCycle;
  }

  /**
   * Salva ou atualiza a renda de Q1 e Q2 do ciclo
   */
  async saveIncome(
    userId: string,
    mesAno: string,
    rendaQ1: number,
    rendaQ2: number
  ): Promise<MonthlyCycle> {
    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
    const safeQ1 = roundBRL(rendaQ1 || 0);
    const safeQ2 = roundBRL(rendaQ2 || 0);
    const totalRenda = roundBRL(safeQ1 + safeQ2);

    const cycleData: Partial<MonthlyCycle> = {
      mesAno,
      renda_quinzena_1: safeQ1,
      renda_quinzena_2: safeQ2,
      total_renda: totalRenda,
      updatedAt: new Date().toISOString()
    };

    await setDoc(cycleDocRef, cycleData, { merge: true });

    return {
      id: mesAno,
      mesAno,
      renda_quinzena_1: safeQ1,
      renda_quinzena_2: safeQ2,
      total_renda: totalRenda,
      total_gastos: 0,
      saldo_final: totalRenda
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
