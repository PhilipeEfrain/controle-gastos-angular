import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { TravelTrip, TravelExpenseItem } from '../models/finance.model';
import { roundBRL } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class TravelService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  /**
   * Stream em tempo real das viagens do usuário
   */
  getTripsStream(userId: string): Observable<TravelTrip[]> {
    return new Observable(subscriber => {
      const tripsCol = collection(this.firestore, `users/${userId}/viagens`);

      const unsubscribe = onSnapshot(
        tripsCol,
        snapshot => {
          const trips: TravelTrip[] = snapshot.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<TravelTrip, 'id'>)
          })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          subscriber.next(trips);
        },
        error => {
          console.error('[TravelService] Erro no onSnapshot de viagens:', error);
          subscriber.error(error);
        }
      );

      return { unsubscribe };
    });
  }

  /**
   * Cria uma nova viagem
   */
  async addTrip(userId: string, trip: Omit<TravelTrip, 'id'>): Promise<string> {
    const tripsCol = collection(this.firestore, `users/${userId}/viagens`);
    const count = Math.max(1, trip.quantidade_participantes || 1);
    const total = roundBRL(trip.total_gastos || 0);
    const perPerson = roundBRL(total / count);

    const docRef = await addDoc(tripsCol, {
      ...trip,
      quantidade_participantes: count,
      despesas: trip.despesas || [],
      total_gastos: total,
      valor_por_pessoa: perPerson,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return docRef.id;
  }

  /**
   * Atualiza dados de uma viagem
   */
  async updateTrip(userId: string, tripId: string, trip: Partial<TravelTrip>): Promise<void> {
    const tripDocRef = doc(this.firestore, `users/${userId}/viagens/${tripId}`);
    const updateData: any = {
      ...trip,
      updatedAt: new Date().toISOString()
    };

    if (trip.despesas || trip.quantidade_participantes) {
      const despesas = trip.despesas || [];
      const count = Math.max(1, trip.quantidade_participantes || 1);
      const total = roundBRL(despesas.reduce((acc, curr) => acc + (curr.valor || 0), 0));
      updateData.total_gastos = total;
      updateData.valor_por_pessoa = roundBRL(total / count);
    }

    await updateDoc(tripDocRef, updateData);
  }

  /**
   * Exclui uma viagem
   */
  async deleteTrip(userId: string, tripId: string): Promise<void> {
    const tripDocRef = doc(this.firestore, `users/${userId}/viagens/${tripId}`);
    await deleteDoc(tripDocRef);
  }

  /**
   * Adiciona um item de despesa à viagem e recalcula os totais
   */
  async addExpenseToTrip(
    userId: string,
    tripId: string,
    expense: TravelExpenseItem,
    currentTrip: TravelTrip
  ): Promise<void> {
    const newExpense: TravelExpenseItem = {
      ...expense,
      id: expense.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      valor: roundBRL(expense.valor),
      createdAt: new Date().toISOString()
    };

    const updatedDespesas = [...(currentTrip.despesas || []), newExpense];
    const count = Math.max(1, currentTrip.quantidade_participantes || 1);
    const total = roundBRL(updatedDespesas.reduce((acc, curr) => acc + (curr.valor || 0), 0));
    const perPerson = roundBRL(total / count);

    const tripDocRef = doc(this.firestore, `users/${userId}/viagens/${tripId}`);
    await updateDoc(tripDocRef, {
      despesas: updatedDespesas,
      total_gastos: total,
      valor_por_pessoa: perPerson,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Atualiza um item de despesa existente na viagem e recalcula os totais
   */
  async updateExpenseInTrip(
    userId: string,
    tripId: string,
    updatedExpense: TravelExpenseItem,
    currentTrip: TravelTrip
  ): Promise<void> {
    const updatedDespesas = (currentTrip.despesas || []).map(e =>
      e.id === updatedExpense.id
        ? { ...e, ...updatedExpense, valor: roundBRL(updatedExpense.valor) }
        : e
    );
    const count = Math.max(1, currentTrip.quantidade_participantes || 1);
    const total = roundBRL(updatedDespesas.reduce((acc, curr) => acc + (curr.valor || 0), 0));
    const perPerson = roundBRL(total / count);

    const tripDocRef = doc(this.firestore, `users/${userId}/viagens/${tripId}`);
    await updateDoc(tripDocRef, {
      despesas: updatedDespesas,
      total_gastos: total,
      valor_por_pessoa: perPerson,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Remove um item de despesa da viagem e recalcula os totais
   */
  async removeExpenseFromTrip(
    userId: string,
    tripId: string,
    expenseId: string,
    currentTrip: TravelTrip
  ): Promise<void> {
    const updatedDespesas = (currentTrip.despesas || []).filter(e => e.id !== expenseId);
    const count = Math.max(1, currentTrip.quantidade_participantes || 1);
    const total = roundBRL(updatedDespesas.reduce((acc, curr) => acc + (curr.valor || 0), 0));
    const perPerson = roundBRL(total / count);

    const tripDocRef = doc(this.firestore, `users/${userId}/viagens/${tripId}`);
    await updateDoc(tripDocRef, {
      despesas: updatedDespesas,
      total_gastos: total,
      valor_por_pessoa: perPerson,
      updatedAt: new Date().toISOString()
    });
  }
}
