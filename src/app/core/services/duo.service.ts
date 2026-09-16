import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from './firebase.service';
import { DuoGroup, DuoSettlementSummary, DuoSharedExpense } from '../models/duo.model';
import { Expense } from '../models/finance.model';
import { roundBRL, addMonthsToYearMonth } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class DuoService {
  private firebaseService = inject(FirebaseService, { optional: true });

  /**
   * Mock/override da callable function para testes unitários
   */
  acceptDuoInviteCallableFn: ((data: any) => Promise<{ data: any }>) | null = null;
  disconnectDuoPartnerCallableFn: ((data: any) => Promise<{ data: any }>) | null = null;

  private get db(): Firestore {
    if (!this.firebaseService) {
      throw new Error('FirebaseService não disponível no DuoService.');
    }
    return this.firebaseService.firestore;
  }

  /**
   * Gera um código de convite aleatório amigável (ex: DUO-7842)
   */
  generateInviteCode(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `DUO-${randomDigits}`;
  }

  /**
   * Busca o grupo Duo no qual o usuário é titular (owner) ou parceiro (partner).
   * Se isPaidOwner for true, ignora registros residuais onde o usuário figurava como parceiro.
   */
  async getDuoGroupForUser(userId: string, isPaidOwner?: boolean): Promise<DuoGroup | null> {
    if (!userId || userId.startsWith('e2e-')) return null;

    // 1. Busca se é titular
    const qOwner = query(
      collection(this.db, 'duo_groups'),
      where('ownerId', '==', userId)
    );
    const snapOwner = await getDocs(qOwner);
    if (!snapOwner.empty) {
      const docSnap = snapOwner.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<DuoGroup, 'id'>) };
    }

    if (isPaidOwner) {
      return null;
    }

    // 2. Busca se é parceiro
    const qPartner = query(
      collection(this.db, 'duo_groups'),
      where('partnerId', '==', userId)
    );
    const snapPartner = await getDocs(qPartner);
    if (!snapPartner.empty) {
      const docSnap = snapPartner.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<DuoGroup, 'id'>) };
    }

    return null;
  }

  /**
   * Cria ou recupera o grupo Duo do titular
   */
  async createOrGetDuoGroup(
    ownerId: string,
    ownerEmail: string,
    ownerName: string
  ): Promise<DuoGroup> {
    const existing = await this.getDuoGroupForUser(ownerId, true);
    if (existing) {
      return existing;
    }

    const inviteCode = this.generateInviteCode();
    const groupRef = doc(collection(this.db, 'duo_groups'));
    const newGroup: DuoGroup = {
      id: groupRef.id,
      ownerId,
      ownerEmail,
      ownerName: ownerName || 'Titular',
      partnerId: null,
      partnerEmail: null,
      partnerName: null,
      inviteCode,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(groupRef, newGroup);
    return newGroup;
  }

  /**
   * Aceita um convite de pareamento utilizando o inviteCode via Cloud Function segura (CARD-087).
   */
  async acceptInvite(
    inviteCode: string,
    partnerId: string,
    partnerEmail: string,
    partnerName: string
  ): Promise<DuoGroup> {
    const formattedCode = inviteCode.trim().toUpperCase();

    if (this.acceptDuoInviteCallableFn) {
      const res = await this.acceptDuoInviteCallableFn({
        inviteCode: formattedCode,
        partnerEmail,
        partnerName
      });
      const data = res.data;
      return {
        id: data.groupId,
        ownerId: data.ownerId,
        ownerName: data.ownerName || 'Titular',
        ownerEmail: data.ownerEmail || '',
        partnerId,
        partnerEmail,
        partnerName: partnerName || 'Parceiro(a)',
        inviteCode: formattedCode,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (this.firebaseService?.app) {
      try {
        const callable = httpsCallable<any, any>(
          getFunctions(this.firebaseService.app),
          'acceptDuoInvite'
        );
        const res = await callable({
          inviteCode: formattedCode,
          partnerEmail,
          partnerName
        });
        const data = res.data;
        return {
          id: data.groupId,
          ownerId: data.ownerId,
          ownerName: data.ownerName || 'Titular',
          ownerEmail: data.ownerEmail || '',
          partnerId,
          partnerEmail,
          partnerName: partnerName || 'Parceiro(a)',
          inviteCode: formattedCode,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } catch (err: any) {
        console.error('[DuoService] Erro ao aceitar convite Duo:', err);
        throw new Error(err?.message || 'Código de convite não encontrado ou inválido.');
      }
    }

    // Fallback Mock para testes desconectados
    return {
      id: 'group_mock',
      ownerId: 'owner_mock',
      ownerName: 'Titular',
      ownerEmail: 'titular@exemplo.com',
      partnerId,
      partnerEmail,
      partnerName: partnerName || 'Parceiro(a)',
      inviteCode: formattedCode,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Desconecta o parceiro e reseta o status do grupo para pending via Cloud Function segura
   */
  async disconnectPartner(groupId: string): Promise<void> {
    if (this.disconnectDuoPartnerCallableFn) {
      await this.disconnectDuoPartnerCallableFn({ groupId });
      return;
    }

    if (this.firebaseService?.app) {
      try {
        const callable = httpsCallable<any, any>(
          getFunctions(this.firebaseService.app),
          'disconnectDuoPartner'
        );
        await callable({ groupId });
        return;
      } catch (err: any) {
        console.error('[DuoService] Erro ao desconectar parceiro Duo via Cloud Function:', err);
        throw new Error(err?.message || 'Erro ao desconectar parceiro do Modo Casal.');
      }
    }

    // Fallback Mock para testes unitários ou desconectados
    const groupRef = doc(this.db, 'duo_groups', groupId);
    const newCode = this.generateInviteCode();
    await updateDoc(groupRef, {
      partnerId: null,
      partnerEmail: null,
      partnerName: null,
      status: 'pending',
      inviteCode: newCode,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Atualiza ou pré-cadastra o e-mail do parceiro no grupo Duo
   */
  async updatePartnerEmail(groupId: string, partnerEmail: string): Promise<void> {
    const groupRef = doc(this.db, 'duo_groups', groupId);
    await updateDoc(groupRef, {
      partnerEmail: partnerEmail.trim().toLowerCase(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Stream reativo em tempo real para monitorar o grupo Duo
   */
  listenDuoGroup(groupId: string): Observable<DuoGroup | null> {
    return new Observable<DuoGroup | null>(observer => {
      const groupRef = doc(this.db, 'duo_groups', groupId);
      const unsubscribe = onSnapshot(
        groupRef,
        docSnap => {
          if (docSnap.exists()) {
            observer.next({ id: docSnap.id, ...(docSnap.data() as Omit<DuoGroup, 'id'>) });
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
   * Calcula o acerto de contas quinzenal / mensal entre os dois membros do casal
   */
  calculateSettlement(
    expenses: Expense[],
    ownerId: string,
    ownerName: string,
    partnerId: string,
    partnerName: string
  ): DuoSettlementSummary {
    let ownerTotalPaid = 0;
    let partnerTotalPaid = 0;

    const despesasOnly = expenses.filter(e => e.tipo !== 'renda_extra');

    for (const exp of despesasOnly) {
      const val = exp.valor || 0;
      // Se não houver pagador especificado ou for igual a ownerId
      if (exp.codigo_comprovante?.includes(partnerId) || (exp as any).pago_por === partnerId || (exp as any).pagoPor === partnerId) {
        partnerTotalPaid = roundBRL(partnerTotalPaid + val);
      } else {
        ownerTotalPaid = roundBRL(ownerTotalPaid + val);
      }
    }

    const totalShared = roundBRL(ownerTotalPaid + partnerTotalPaid);
    const targetSharePerPerson = roundBRL(totalShared / 2);

    let debtor: 'owner' | 'partner' | 'even' = 'even';
    let settlementAmount = 0;
    let message = 'Tudo equilibrado! Cada um pagou sua metade exata das despesas.';

    if (ownerTotalPaid > partnerTotalPaid) {
      debtor = 'partner';
      settlementAmount = roundBRL((ownerTotalPaid - partnerTotalPaid) / 2);
      message = `${partnerName} deve transferir R$ ${settlementAmount.toFixed(2).replace('.', ',')} para ${ownerName} para equalizar 50/50.`;
    } else if (partnerTotalPaid > ownerTotalPaid) {
      debtor = 'owner';
      settlementAmount = roundBRL((partnerTotalPaid - ownerTotalPaid) / 2);
      message = `${ownerName} deve transferir R$ ${settlementAmount.toFixed(2).replace('.', ',')} para ${partnerName} para equalizar 50/50.`;
    }

    return {
      ownerId,
      ownerName,
      ownerTotalPaid,
      partnerId,
      partnerName,
      partnerTotalPaid,
      totalShared,
      targetSharePerPerson,
      debtor,
      settlementAmount,
      message
    };
  }

  /**
   * Conecta a stream reativa de despesas compartilhadas do casal para o mês selecionado
   */
  getSharedExpensesStream(groupId: string, mesAno: string, userId?: string): Observable<DuoSharedExpense[]> {
    if (!groupId || !mesAno || groupId.startsWith('e2e-')) {
      return of([]);
    }

    return new Observable<DuoSharedExpense[]>(observer => {
      const colRef = collection(this.db, 'duo_groups', groupId, 'ciclos', mesAno, 'despesas_compartilhadas');
      const filterUid = userId || this.firebaseService?.auth?.currentUser?.uid;
      const q = filterUid
        ? query(colRef, where('members', 'array-contains', filterUid))
        : colRef;

      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          const items = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<DuoSharedExpense, 'id'>)
          }));
          observer.next(items);
        },
        err => {
          console.error('[DuoService] Erro ao carregar despesas compartilhadas:', err);
          observer.error(err);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Calcula o acerto de contas do casal diretamente a partir dos documentos de despesas compartilhadas
   */
  calculateSettlementFromShared(
    sharedExpenses: DuoSharedExpense[],
    ownerId: string,
    ownerName: string,
    partnerId: string,
    partnerName: string
  ): DuoSettlementSummary {
    let ownerTotalPaid = 0;
    let partnerTotalPaid = 0;
    let totalOwnerShare = 0;
    let totalPartnerShare = 0;

    for (const exp of sharedExpenses) {
      const total = exp.valorTotal || 0;
      if (exp.pagoPorId === partnerId) {
        partnerTotalPaid = roundBRL(partnerTotalPaid + total);
      } else {
        ownerTotalPaid = roundBRL(ownerTotalPaid + total);
      }
      totalOwnerShare = roundBRL(totalOwnerShare + (exp.valorOwner || 0));
      totalPartnerShare = roundBRL(totalPartnerShare + (exp.valorPartner || 0));
    }

    const totalShared = roundBRL(ownerTotalPaid + partnerTotalPaid);
    const targetSharePerPerson = roundBRL(totalShared / 2);

    const ownerNetDiff = roundBRL(ownerTotalPaid - totalOwnerShare);
    const partnerNetDiff = roundBRL(partnerTotalPaid - totalPartnerShare);

    let debtor: 'owner' | 'partner' | 'even' = 'even';
    let settlementAmount = 0;
    let message = 'Tudo equilibrado! Cada um pagou sua cota exata das despesas do casal.';

    if (ownerNetDiff > 0) {
      debtor = 'partner';
      settlementAmount = ownerNetDiff;
      message = `${partnerName} deve transferir R$ ${settlementAmount.toFixed(2).replace('.', ',')} para ${ownerName} para equalizar os gastos compartilhados.`;
    } else if (partnerNetDiff > 0) {
      debtor = 'owner';
      settlementAmount = partnerNetDiff;
      message = `${ownerName} deve transferir R$ ${settlementAmount.toFixed(2).replace('.', ',')} para ${partnerName} para equalizar os gastos compartilhados.`;
    }

    return {
      ownerId,
      ownerName,
      ownerTotalPaid,
      partnerId,
      partnerName,
      partnerTotalPaid,
      totalShared,
      targetSharePerPerson,
      debtor,
      settlementAmount,
      message
    };
  }

  /**
   * Salva uma nova despesa compartilhada na subcoleção do casal
   */
  async addSharedExpense(groupId: string, expense: DuoSharedExpense): Promise<string> {
    const colRef = collection(this.db, 'duo_groups', groupId, 'ciclos', expense.mesAno, 'despesas_compartilhadas');
    const docRef = doc(colRef);
    const id = docRef.id;

    const payload: DuoSharedExpense = {
      ...expense,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    ) as DuoSharedExpense;

    await setDoc(docRef, cleanPayload);
    return id;
  }

  /**
   * Cria despesas compartilhadas parceladas (ex: Geladeira em 10x) através de writeBatch atômico
   */
  async createSharedInstallments(
    groupId: string,
    baseExpense: DuoSharedExpense,
    totalParcelas: number
  ): Promise<void> {
    if (totalParcelas <= 1) {
      await this.addSharedExpense(groupId, {
        ...baseExpense,
        isParcelado: false
      });
      return;
    }

    const batch = writeBatch(this.db);
    const grupoParcelamentoId = `duo_inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const valorParcelaTotal = roundBRL(baseExpense.valorTotal / totalParcelas);
    const valorParcelaOwner = roundBRL(baseExpense.valorOwner / totalParcelas);
    const valorParcelaPartner = roundBRL(baseExpense.valorPartner / totalParcelas);

    for (let i = 0; i < totalParcelas; i++) {
      const mesAnoParcela = addMonthsToYearMonth(baseExpense.mesAno, i);
      const colRef = collection(this.db, 'duo_groups', groupId, 'ciclos', mesAnoParcela, 'despesas_compartilhadas');
      const docRef = doc(colRef);

      const parcelaDoc: DuoSharedExpense = {
        ...baseExpense,
        id: docRef.id,
        mesAno: mesAnoParcela,
        valorTotal: valorParcelaTotal,
        valorOwner: valorParcelaOwner,
        valorPartner: valorParcelaPartner,
        isParcelado: true,
        parcelaAtual: i + 1,
        totalParcelas,
        grupoParcelamentoId,
        status_pagamento: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const cleanDoc = Object.fromEntries(
        Object.entries(parcelaDoc).filter(([_, v]) => v !== undefined)
      );

      batch.set(docRef, cleanDoc);
    }

    await batch.commit();
  }

  /**
   * Alterna status de quitação de uma despesa compartilhada
   */
  async toggleSharedExpensePaymentStatus(
    groupId: string,
    mesAno: string,
    expenseId: string,
    status: boolean
  ): Promise<void> {
    const docRef = doc(this.db, 'duo_groups', groupId, 'ciclos', mesAno, 'despesas_compartilhadas', expenseId);
    await updateDoc(docRef, {
      status_pagamento: status,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Exclui uma despesa compartilhada
   */
  async deleteSharedExpense(groupId: string, mesAno: string, expenseId: string): Promise<void> {
    const docRef = doc(this.db, 'duo_groups', groupId, 'ciclos', mesAno, 'despesas_compartilhadas', expenseId);
    await deleteDoc(docRef);
  }
}

