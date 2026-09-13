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
import { FirebaseService } from './firebase.service';
import { DuoGroup, DuoSettlementSummary, DuoSharedExpense } from '../models/duo.model';
import { Expense } from '../models/finance.model';
import { roundBRL, addMonthsToYearMonth } from '../utils/calculations';

@Injectable({
  providedIn: 'root'
})
export class DuoService {
  private firebaseService = inject(FirebaseService, { optional: true });

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
   * Busca o grupo Duo no qual o usuário é titular (owner) ou parceiro (partner)
   */
  async getDuoGroupForUser(userId: string): Promise<DuoGroup | null> {
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
    const existing = await this.getDuoGroupForUser(ownerId);
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
   * Aceita um convite de pareamento utilizando o inviteCode
   */
  async acceptInvite(
    inviteCode: string,
    partnerId: string,
    partnerEmail: string,
    partnerName: string
  ): Promise<DuoGroup> {
    const formattedCode = inviteCode.trim().toUpperCase();
    const q = query(
      collection(this.db, 'duo_groups'),
      where('inviteCode', '==', formattedCode),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Código de convite não encontrado ou inválido.');
    }

    const docSnap = snap.docs[0];
    const group = docSnap.data() as DuoGroup;

    if (group.ownerId === partnerId) {
      throw new Error('Você não pode se conectar ao seu próprio convite.');
    }

    if (group.status === 'active' && group.partnerId && group.partnerId !== partnerId) {
      throw new Error('Este convite já foi utilizado por outro parceiro.');
    }

    const updatedData: Partial<DuoGroup> = {
      partnerId,
      partnerEmail,
      partnerName: partnerName || 'Parceiro(a)',
      status: 'active',
      updatedAt: new Date().toISOString()
    };

    await updateDoc(doc(this.db, 'duo_groups', docSnap.id), updatedData);

    // Promove o perfil do parceiro para plano Duo com benefícios liberados
    try {
      const partnerUserRef = doc(this.db, 'users', partnerId);
      await updateDoc(partnerUserRef, {
        plan: 'duo',
        planStatus: 'active',
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Não foi possível sincronizar o plano do parceiro no Firestore:', e);
    }

    return {
      id: docSnap.id,
      ...group,
      ...updatedData
    };
  }

  /**
   * Desconecta o parceiro e reseta o status do grupo para pending
   */
  async disconnectPartner(groupId: string): Promise<void> {
    const groupRef = doc(this.db, 'duo_groups', groupId);
    let previousPartnerId: string | null = null;
    try {
      const snap = await getDoc(groupRef);
      if (snap.exists()) {
        previousPartnerId = snap.data()['partnerId'] || null;
      }
    } catch {
      // Ignora erro de leitura prévia
    }

    const newCode = this.generateInviteCode();
    await updateDoc(groupRef, {
      partnerId: null,
      partnerEmail: null,
      partnerName: null,
      status: 'pending',
      inviteCode: newCode,
      updatedAt: new Date().toISOString()
    });

    if (previousPartnerId) {
      try {
        const partnerUserRef = doc(this.db, 'users', previousPartnerId);
        await updateDoc(partnerUserRef, {
          plan: 'free',
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Erro ao retornar plano do parceiro para free:', e);
      }
    }
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
  getSharedExpensesStream(groupId: string, mesAno: string): Observable<DuoSharedExpense[]> {
    if (!groupId || !mesAno || groupId.startsWith('e2e-')) {
      return of([]);
    }

    return new Observable<DuoSharedExpense[]>(observer => {
      const colRef = collection(this.db, 'duo_groups', groupId, 'ciclos', mesAno, 'despesas_compartilhadas');
      const unsubscribe = onSnapshot(
        colRef,
        snapshot => {
          const items = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<DuoSharedExpense, 'id'>)
          }));
          observer.next(items);
        },
        err => observer.error(err)
      );

      return () => unsubscribe();
    });
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

