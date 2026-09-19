import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import {
  SplitExpense,
  SplitGroup,
  SplitParticipant
} from '../models/split-group.model';

@Injectable({
  providedIn: 'root'
})
export class SplitService {
  private firebaseService = inject(FirebaseService, { optional: true });

  private get db(): Firestore {
    if (!this.firebaseService) {
      throw new Error('FirebaseService não disponível no SplitService.');
    }
    return this.firebaseService.firestore;
  }

  /**
   * Gera um token seguro para compartilhamento de link público
   */
  generateViewToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    const array = new Uint8Array(20);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
      for (let i = 0; i < array.length; i++) {
        token += chars[array[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 20; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return token;
  }

  /**
   * Cria um novo grupo de divisão de despesas
   */
  async createGroup(
    title: string,
    description: string,
    ownerId: string,
    ownerName: string,
    ownerPixKey?: string,
    ownerPixKeyType?: SplitParticipant['pixKeyType'],
    initialParticipants: Array<{ name: string; pixKey?: string; pixKeyType?: SplitParticipant['pixKeyType'] }> = []
  ): Promise<SplitGroup> {
    const groupCol = collection(this.db, 'split_groups');
    const groupDoc = doc(groupCol);
    const viewToken = this.generateViewToken();
    const now = new Date().toISOString();

    const ownerParticipant: SplitParticipant = {
      id: ownerId,
      name: ownerName,
      userId: ownerId,
      isRegistered: true,
      pixKey: ownerPixKey || '',
      pixKeyType: ownerPixKeyType
    };

    const participants: SplitParticipant[] = [
      ownerParticipant,
      ...initialParticipants.map((p, idx) => ({
        id: `guest-${Date.now()}-${idx}`,
        name: p.name,
        userId: null,
        isRegistered: false,
        pixKey: p.pixKey || '',
        pixKeyType: p.pixKeyType
      }))
    ];

    const newGroup: SplitGroup = {
      id: groupDoc.id,
      title: title.trim(),
      description: description?.trim() || '',
      ownerId,
      ownerName,
      viewToken,
      status: 'active',
      participants,
      totalExpenses: 0,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(groupDoc, newGroup);
    return newGroup;
  }

  /**
   * Busca um grupo por ID
   */
  async getGroupById(groupId: string): Promise<SplitGroup | null> {
    const groupRef = doc(this.db, 'split_groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SplitGroup;
  }

  /**
   * Observa mudanças em tempo real de um grupo
   */
  listenToGroup(groupId: string): Observable<SplitGroup | null> {
    return new Observable<SplitGroup | null>((subscriber) => {
      const groupRef = doc(this.db, 'split_groups', groupId);
      const unsubscribe: Unsubscribe = onSnapshot(
        groupRef,
        (snap) => {
          if (snap.exists()) {
            subscriber.next({ id: snap.id, ...snap.data() } as SplitGroup);
          } else {
            subscriber.next(null);
          }
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Lista todos os grupos gerenciados pelo usuário (como anfitrião)
   */
  async getGroupsForUser(userId: string): Promise<SplitGroup[]> {
    const groupCol = collection(this.db, 'split_groups');
    const q = query(groupCol, where('ownerId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SplitGroup));
  }

  /**
   * Adiciona um novo participante ao grupo
   */
  async addParticipant(groupId: string, participant: SplitParticipant): Promise<void> {
    const groupRef = doc(this.db, 'split_groups', groupId);
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error('Grupo não encontrado.');

    const updatedParticipants = [...group.participants, participant];
    await updateDoc(groupRef, {
      participants: updatedParticipants,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Adiciona uma despesa ao grupo
   */
  async addExpense(
    groupId: string,
    expense: Omit<SplitExpense, 'id' | 'groupId' | 'createdAt'>
  ): Promise<SplitExpense> {
    const expensesCol = collection(this.db, 'split_groups', groupId, 'expenses');
    const expDoc = doc(expensesCol);
    const now = new Date().toISOString();

    const newExpense: SplitExpense = {
      ...expense,
      id: expDoc.id,
      groupId,
      createdAt: now
    };

    await setDoc(expDoc, newExpense);

    // Atualiza o updatedAt do grupo
    const groupRef = doc(this.db, 'split_groups', groupId);
    await updateDoc(groupRef, {
      updatedAt: now
    });

    return newExpense;
  }

  /**
   * Observa despesas em tempo real de um grupo
   */
  listenToExpenses(groupId: string): Observable<SplitExpense[]> {
    return new Observable<SplitExpense[]>((subscriber) => {
      const expensesCol = collection(this.db, 'split_groups', groupId, 'expenses');
      const q = query(expensesCol, orderBy('createdAt', 'desc'));

      const unsubscribe: Unsubscribe = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SplitExpense));
          subscriber.next(items);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Remove uma despesa do grupo
   */
  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    const expRef = doc(this.db, 'split_groups', groupId, 'expenses', expenseId);
    await deleteDoc(expRef);

    const groupRef = doc(this.db, 'split_groups', groupId);
    await updateDoc(groupRef, {
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Marca o grupo como liquidado
   */
  async settleGroup(groupId: string): Promise<void> {
    const groupRef = doc(this.db, 'split_groups', groupId);
    await updateDoc(groupRef, {
      status: 'settled',
      settledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Exclui o grupo e todas as suas despesas em batch (higienização total)
   */
  async deleteGroup(groupId: string): Promise<void> {
    const expensesCol = collection(this.db, 'split_groups', groupId, 'expenses');
    const expensesSnap = await getDocs(expensesCol);

    const batch = writeBatch(this.db);
    expensesSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    const groupRef = doc(this.db, 'split_groups', groupId);
    batch.delete(groupRef);

    await batch.commit();
  }
}
