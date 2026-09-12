import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { AnnualTax } from '../models/finance.model';
import { roundBRL } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class TaxService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  /**
   * Retorna um Observable em tempo real com todos os tributos anuais do usuário
   */
  getTaxesStream(userId: string): Observable<AnnualTax[]> {
    if (userId.startsWith('e2e-')) {
      return of([]);
    }

    return new Observable(subscriber => {
      const taxesColRef = collection(this.firestore, `users/${userId}/tributos_e_parcelas`);
      const unsubscribe = onSnapshot(
        taxesColRef,
        snapshot => {
          const taxes = snapshot.docs.map(
            d => ({ id: d.id, ...d.data() } as AnnualTax)
          );
          subscriber.next(taxes);
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
   * Cadastra um novo tributo anual
   */
  async addTax(userId: string, tax: AnnualTax): Promise<string> {
    const taxesColRef = collection(this.firestore, `users/${userId}/tributos_e_parcelas`);
    const taxData = this.sanitizeData({
      ...tax,
      valor_orcado: roundBRL(tax.valor_orcado),
      valor_pago: roundBRL(tax.valor_pago || 0)
    });
    const docRef = await addDoc(taxesColRef, taxData);
    return docRef.id;
  }

  /**
   * Atualiza dados de um tributo
   */
  async updateTax(userId: string, taxId: string, data: Partial<AnnualTax>): Promise<void> {
    const taxDocRef = doc(this.firestore, `users/${userId}/tributos_e_parcelas/${taxId}`);
    const updatePayload = this.sanitizeData({ ...data });
    if (updatePayload.valor_orcado !== undefined) {
      updatePayload.valor_orcado = roundBRL(updatePayload.valor_orcado);
    }
    if (updatePayload.valor_pago !== undefined) {
      updatePayload.valor_pago = roundBRL(updatePayload.valor_pago);
    }
    await updateDoc(taxDocRef, updatePayload);
  }

  /**
   * Exclui um tributo
   */
  async deleteTax(userId: string, taxId: string): Promise<void> {
    const taxDocRef = doc(this.firestore, `users/${userId}/tributos_e_parcelas/${taxId}`);
    await deleteDoc(taxDocRef);
  }

  /**
   * Marca o tributo como pago e registra o valor efetivamente liquidado
   */
  async markAsPaid(userId: string, taxId: string, valorPago: number): Promise<void> {
    const taxDocRef = doc(this.firestore, `users/${userId}/tributos_e_parcelas/${taxId}`);
    await updateDoc(taxDocRef, {
      status: 'Pago',
      valor_pago: roundBRL(valorPago),
      data_pagamento: new Date().toISOString()
    });
  }
}
