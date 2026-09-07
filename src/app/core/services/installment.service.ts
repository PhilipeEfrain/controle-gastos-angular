import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirebaseService } from './firebase.service';
import { InstallmentGroup, InstallmentParcel } from '../models/finance.model';
import { roundBRL, addMonthsToYearMonth } from '../utils/calculations';
import { getCurrentYearMonth } from '../utils/date';

@Injectable({
  providedIn: 'root'
})
export class InstallmentService {
  private firebaseService = inject(FirebaseService);
  private firestore = this.firebaseService.firestore;

  /**
   * Carrega e agrupa todas as compras parceladas a partir dos ciclos mensais do usuário
   * Busca nos 12 meses anteriores e 24 meses futuros para cobertura completa.
   */
  getInstallmentsOverview(userId: string, startMonth?: string): Observable<InstallmentGroup[]> {
    const baseMonth = startMonth || getCurrentYearMonth();
    const monthsToScan: string[] = [];

    // Scan de -6 meses até +18 meses
    for (let i = -6; i <= 18; i++) {
      monthsToScan.push(addMonthsToYearMonth(baseMonth, i));
    }

    return from(this.fetchExpensesAcrossMonths(userId, monthsToScan)).pipe(
      map(expensesWithMonth => this.groupInstallments(expensesWithMonth))
    );
  }

  private async fetchExpensesAcrossMonths(
    userId: string,
    months: string[]
  ): Promise<Array<{ id: string; mesAno: string; data: any }>> {
    const allExpenses: Array<{ id: string; mesAno: string; data: any }> = [];

    const promises = months.map(async mesAno => {
      const colRef = collection(
        this.firestore,
        `users/${userId}/ciclos_mensais/${mesAno}/despesas`
      );
      try {
        const snap = await getDocs(colRef);
        return snap.docs.map(d => ({
          id: d.id,
          mesAno,
          data: d.data()
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const res of results) {
      allExpenses.push(...res);
    }
    return allExpenses;
  }

  /**
   * Agrupa itens pelo grupo_parcela_id e calcula totais, progresso e saldo devedor
   */
  groupInstallments(
    items: Array<{ id: string; mesAno: string; data: any }>
  ): InstallmentGroup[] {
    const groupsMap = new Map<string, InstallmentParcel[]>();
    const metaMap = new Map<string, { descricao: string; categoria: string; totalParcelas: number; valorParcela: number }>();

    for (const item of items) {
      const data = item.data;
      if (!data || !data.grupo_parcela_id) continue;

      const grupoId = data.grupo_parcela_id;
      const parcela: InstallmentParcel = {
        id: item.id,
        mesAno: item.mesAno,
        parcela_atual: data.parcela_atual || 1,
        total_parcelas: data.total_parcelas || 1,
        valor: data.valor || 0,
        status_pagamento: !!data.status_pagamento,
        quinzena: data.quinzena || 1,
        data_vencimento: data.data_vencimento
      };

      const existing = groupsMap.get(grupoId) || [];
      existing.push(parcela);
      groupsMap.set(grupoId, existing);

      if (!metaMap.has(grupoId)) {
        // Limpar sufixo "(1/10)" do título base se presente
        const cleanDesc = (data.descricao || 'Compra Parcelada').replace(/\s*\(\d+\/\d+\)$/, '');
        metaMap.set(grupoId, {
          descricao: cleanDesc,
          categoria: data.categoria || 'Outros',
          totalParcelas: data.total_parcelas || 1,
          valorParcela: data.valor || 0
        });
      }
    }

    const groups: InstallmentGroup[] = [];

    groupsMap.forEach((parcelas, grupoId) => {
      // Ordenar parcelas por número
      parcelas.sort((a, b) => a.parcela_atual - b.parcela_atual);

      const meta = metaMap.get(grupoId)!;
      const totalParcelas = meta.totalParcelas;
      const valorParcela = meta.valorParcela;
      const valorTotal = roundBRL(valorParcela * totalParcelas);

      const pagas = parcelas.filter(p => p.status_pagamento);
      const parcelasPagasCount = pagas.length;
      const totalPago = roundBRL(pagas.reduce((acc, p) => acc + p.valor, 0));
      const saldoRestante = roundBRL(Math.max(0, valorTotal - totalPago));
      const percentualConcluido = totalParcelas > 0 ? (parcelasPagasCount / totalParcelas) * 100 : 0;

      const proximaPendente = parcelas.find(p => !p.status_pagamento);

      groups.push({
        grupo_parcela_id: grupoId,
        descricao: meta.descricao,
        categoria: meta.categoria,
        valor_parcela: valorParcela,
        total_parcelas: totalParcelas,
        parcelas_pagas: parcelasPagasCount,
        total_pago: totalPago,
        saldo_restante: saldoRestante,
        valor_total: valorTotal,
        percentual_concluido: percentualConcluido,
        proximo_vencimento: proximaPendente?.mesAno,
        parcelas
      });
    });

    return groups.sort((a, b) => b.saldo_restante - a.saldo_restante);
  }

  /**
   * Quitação atômica de parcelas selecionadas via writeBatch
   */
  async payAdvanceInstallments(
    userId: string,
    parcelas: Array<{ mesAno: string; expenseId: string }>
  ): Promise<void> {
    if (!parcelas || parcelas.length === 0) return;

    const batch = writeBatch(this.firestore);

    for (const p of parcelas) {
      const docRef = doc(
        this.firestore,
        `users/${userId}/ciclos_mensais/${p.mesAno}/despesas/${p.expenseId}`
      );
      batch.update(docRef, { status_pagamento: true });
    }

    await batch.commit();
  }

  /**
   * Exclusão atômica de parcelas futuras em lote (ex: cancelamento de compra)
   */
  async deleteInstallmentsBatch(
    userId: string,
    parcelas: Array<{ mesAno: string; expenseId: string }>
  ): Promise<void> {
    if (!parcelas || parcelas.length === 0) return;

    const batch = writeBatch(this.firestore);

    for (const p of parcelas) {
      const docRef = doc(
        this.firestore,
        `users/${userId}/ciclos_mensais/${p.mesAno}/despesas/${p.expenseId}`
      );
      batch.delete(docRef);
    }

    await batch.commit();
  }
}
