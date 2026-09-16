import { Injectable, inject } from '@angular/core';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  updateDoc,
  collection,
  writeBatch
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { MonthlyCycle, ActiveIncomeConfig } from '../models/finance.model';
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

  getLocalActiveIncome(userId: string): ActiveIncomeConfig | null {
    try {
      const stored = localStorage.getItem(`quinzena_active_income_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  saveLocalActiveIncome(userId: string, config: ActiveIncomeConfig): void {
    try {
      localStorage.setItem(`quinzena_active_income_${userId}`, JSON.stringify(config));
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
        async snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.data() as MonthlyCycle;
            const meta = this.getLocalCycleMetadata(userId, mesAno);

            // Se o ciclo já existe mas está sem renda preenchida, tenta herdar a renda ativa vigente
            if (
              (data.total_renda || 0) === 0 &&
              (data.renda_quinzena_1 || 0) === 0 &&
              (data.renda_quinzena_2 || 0) === 0
            ) {
              const inherited = await this.resolveInheritedCycle(userId, mesAno);
              if (inherited) {
                data.renda_quinzena_1 = inherited.renda_quinzena_1;
                data.renda_quinzena_2 = inherited.renda_quinzena_2;
                data.total_renda = inherited.total_renda;
                data.saldo_final = roundBRL(inherited.total_renda - (data.total_gastos || 0));
                if (inherited.regime_salarial) data.regime_salarial = inherited.regime_salarial;
                if (inherited.dia_pagamento !== undefined) data.dia_pagamento = inherited.dia_pagamento;
                if (inherited.descricao_dia_pagamento !== undefined) data.descricao_dia_pagamento = inherited.descricao_dia_pagamento;
              }
            }

            subscriber.next({
              id: snapshot.id,
              ...meta,
              ...data,
              dia_pagamento: data.dia_pagamento ?? meta.dia_pagamento,
              descricao_dia_pagamento: data.descricao_dia_pagamento ?? meta.descricao_dia_pagamento,
              regime_salarial: data.regime_salarial ?? meta.regime_salarial
            });
          } else {
            // Se o documento não existe ainda, resolve a renda herdada de ciclos anteriores
            const inherited = await this.resolveInheritedCycle(userId, mesAno);
            subscriber.next(inherited);
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
      return await this.resolveInheritedCycle(userId, mesAno);
    }
    const data = snapshot.data() as MonthlyCycle;
    const meta = this.getLocalCycleMetadata(userId, mesAno);

    if (
      (data.total_renda || 0) === 0 &&
      (data.renda_quinzena_1 || 0) === 0 &&
      (data.renda_quinzena_2 || 0) === 0
    ) {
      const inherited = await this.resolveInheritedCycle(userId, mesAno);
      if (inherited) {
        data.renda_quinzena_1 = inherited.renda_quinzena_1;
        data.renda_quinzena_2 = inherited.renda_quinzena_2;
        data.total_renda = inherited.total_renda;
        data.saldo_final = roundBRL(inherited.total_renda - (data.total_gastos || 0));
        if (inherited.regime_salarial) data.regime_salarial = inherited.regime_salarial;
        if (inherited.dia_pagamento !== undefined) data.dia_pagamento = inherited.dia_pagamento;
        if (inherited.descricao_dia_pagamento !== undefined) data.descricao_dia_pagamento = inherited.descricao_dia_pagamento;
      }
    }

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
   * Resolve e herda a renda do ciclo anterior mais recente para meses futuros sem renda cadastrada (CARD-088)
   */
  async resolveInheritedCycle(userId: string, mesAno: string): Promise<MonthlyCycle | null> {
    if (!userId || userId.startsWith('e2e-')) {
      return null;
    }

    let config = this.getLocalActiveIncome(userId);

    // Se não encontrou no cache local, tenta ler activeIncomeConfig do perfil do usuário
    if (!config) {
      try {
        const userDocRef = doc(this.firestore, `users/${userId}`);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData?.['activeIncomeConfig']) {
            config = userData['activeIncomeConfig'] as ActiveIncomeConfig;
            this.saveLocalActiveIncome(userId, config);
          }
        }
      } catch (err) {
        console.warn('[MonthlyCycleService] Erro ao buscar activeIncomeConfig no perfil:', err);
      }
    }

    // Se ainda não encontrou, busca nos ciclos existentes do usuário o ciclo anterior com renda mais recente
    if (!config) {
      try {
        const ciclosColRef = collection(this.firestore, `users/${userId}/ciclos_mensais`);
        const snap = await getDocs(ciclosColRef);
        if (!snap.empty) {
          const validPastCycles = snap.docs
            .map(d => d.data() as MonthlyCycle)
            .filter(c => c.mesAno && c.mesAno <= mesAno && ((c.total_renda || 0) > 0 || (c.renda_quinzena_1 || 0) > 0 || (c.renda_quinzena_2 || 0) > 0))
            .sort((a, b) => b.mesAno.localeCompare(a.mesAno));

          if (validPastCycles.length > 0) {
            const latest = validPastCycles[0];
            config = {
              renda_quinzena_1: latest.renda_quinzena_1 || 0,
              renda_quinzena_2: latest.renda_quinzena_2 || 0,
              total_renda: latest.total_renda || ((latest.renda_quinzena_1 || 0) + (latest.renda_quinzena_2 || 0)),
              regime_salarial: latest.regime_salarial,
              dia_pagamento: latest.dia_pagamento,
              descricao_dia_pagamento: latest.descricao_dia_pagamento,
              effectiveFrom: latest.mesAno,
              updatedAt: new Date().toISOString()
            };
            this.saveLocalActiveIncome(userId, config);
          }
        }
      } catch (err) {
        console.warn('[MonthlyCycleService] Erro ao buscar ciclos passados para herança:', err);
      }
    }

    if (!config || ((config.total_renda || 0) <= 0 && (config.renda_quinzena_1 || 0) <= 0 && (config.renda_quinzena_2 || 0) <= 0)) {
      return null;
    }

    // Apenas herda se o mês for maior ou igual ao início da vigência da renda
    if (config.effectiveFrom && mesAno < config.effectiveFrom) {
      return null;
    }

    const inheritedCycle: MonthlyCycle = {
      id: mesAno,
      mesAno,
      renda_quinzena_1: config.renda_quinzena_1,
      renda_quinzena_2: config.renda_quinzena_2,
      total_renda: config.total_renda,
      total_gastos: 0,
      saldo_final: config.total_renda,
      regime_salarial: config.regime_salarial,
      dia_pagamento: config.dia_pagamento,
      descricao_dia_pagamento: config.descricao_dia_pagamento,
      updatedAt: new Date().toISOString()
    };

    // Auto-persiste no Firestore de forma assíncrona para que o ciclo já exista
    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);
    setDoc(cycleDocRef, inheritedCycle, { merge: true }).catch(err => {
      console.warn('[MonthlyCycleService] Erro ao persistir ciclo herdado:', err);
    });

    return inheritedCycle;
  }

  /**
   * Propaga a nova renda para todos os ciclos futuros já existentes no Firestore (> fromMesAno) (CARD-088).
   * Ciclos passados (< fromMesAno) NUNCA são alterados, preservando o histórico financeiro.
   */
  async propagateIncomeToFutureCycles(
    userId: string,
    fromMesAno: string,
    incomeConfig: ActiveIncomeConfig
  ): Promise<void> {
    if (!userId || userId.startsWith('e2e-')) {
      return;
    }

    try {
      const ciclosColRef = collection(this.firestore, `users/${userId}/ciclos_mensais`);
      const snap = await getDocs(ciclosColRef);
      if (snap.empty) {
        return;
      }

      const futureDocs = snap.docs.filter(d => {
        const m = d.id; // mesAno é o id do documento (ex: "2026-04")
        return m > fromMesAno;
      });

      if (futureDocs.length === 0) {
        return;
      }

      const batch = writeBatch(this.firestore);
      for (const docSnap of futureDocs) {
        const data = docSnap.data() as MonthlyCycle;
        const totalGastos = data.total_gastos || 0;
        const saldoFinal = roundBRL(incomeConfig.total_renda - totalGastos);

        const updatePayload: any = {
          renda_quinzena_1: incomeConfig.renda_quinzena_1,
          renda_quinzena_2: incomeConfig.renda_quinzena_2,
          total_renda: incomeConfig.total_renda,
          saldo_final: saldoFinal,
          updatedAt: new Date().toISOString()
        };

        if (incomeConfig.regime_salarial) {
          updatePayload.regime_salarial = incomeConfig.regime_salarial;
        }
        if (incomeConfig.dia_pagamento !== undefined && incomeConfig.dia_pagamento !== null) {
          updatePayload.dia_pagamento = incomeConfig.dia_pagamento;
        }
        if (incomeConfig.descricao_dia_pagamento !== undefined && incomeConfig.descricao_dia_pagamento !== null) {
          updatePayload.descricao_dia_pagamento = incomeConfig.descricao_dia_pagamento;
        }

        batch.update(docSnap.ref, updatePayload);
      }

      await batch.commit();
    } catch (err) {
      console.warn('[MonthlyCycleService] Erro ao propagar renda para ciclos futuros:', err);
    }
  }

  /**
   * Salva ou atualiza a renda de Q1 e Q2 do ciclo e propaga para o futuro (CARD-088)
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
    const safeQ1 = roundBRL(rendaQ1 || 0);
    const safeQ2 = roundBRL(rendaQ2 || 0);
    const totalRenda = roundBRL(safeQ1 + safeQ2);

    if (userId.startsWith('e2e-')) {
      const activeConfig: ActiveIncomeConfig = {
        renda_quinzena_1: safeQ1,
        renda_quinzena_2: safeQ2,
        total_renda: totalRenda,
        regime_salarial: regime as any,
        dia_pagamento: diaPagamento,
        descricao_dia_pagamento: descricaoDiaPagamento,
        effectiveFrom: mesAno,
        updatedAt: new Date().toISOString()
      };
      this.saveLocalActiveIncome(userId, activeConfig);
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

    const cycleDocRef = doc(this.firestore, `users/${userId}/ciclos_mensais/${mesAno}`);

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

    // 4. Salva a configuração ativa de renda para herança futura (CARD-088)
    const activeConfig: ActiveIncomeConfig = {
      renda_quinzena_1: safeQ1,
      renda_quinzena_2: safeQ2,
      total_renda: totalRenda,
      effectiveFrom: mesAno,
      updatedAt: new Date().toISOString()
    };
    if (regime) activeConfig.regime_salarial = regime as any;
    if (diaPagamento !== undefined && diaPagamento !== null) activeConfig.dia_pagamento = diaPagamento;
    if (descricaoDiaPagamento !== undefined && descricaoDiaPagamento !== null) activeConfig.descricao_dia_pagamento = descricaoDiaPagamento;

    this.saveLocalActiveIncome(userId, activeConfig);

    if (!userId.startsWith('e2e-')) {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      setDoc(userDocRef, { activeIncomeConfig: activeConfig }, { merge: true }).catch(err => {
        console.warn('[MonthlyCycleService] Erro ao sincronizar activeIncomeConfig no perfil do usuário:', err);
      });
    }

    // 5. Propaga a renda para ciclos futuros já existentes (> mesAno)
    // Meses anteriores (< mesAno) permanecem intactos com o histórico inalterado
    await this.propagateIncomeToFutureCycles(userId, mesAno, activeConfig);

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
