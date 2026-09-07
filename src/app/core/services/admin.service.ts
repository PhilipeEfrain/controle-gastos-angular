import { Injectable, inject } from '@angular/core';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { UserProfile, PlanType, PlanStatus, UserRole } from '../models/user.model';

export interface SaaSMetrics {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  duoUsers: number;
  paidUsers: number;
  estimatedMRR: number;
  conversionRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private firebaseService = inject(FirebaseService);
  private logger = inject(LoggerService);
  private firestore = this.firebaseService.firestore;

  /**
   * Preços oficiais dos planos para cálculo de MRR (Receita Recorrente Mensal)
   */
  readonly PLAN_PRICES = {
    free: 0,
    pro: 9.90,
    duo: 19.90
  } as const;

  /**
   * Busca todos os usuários cadastrados na plataforma de forma robusta e resiliente
   */
  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const snapshot = await getDocs(usersRef);

      if (snapshot.empty) {
        return [];
      }

      const usersList: UserProfile[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();

        // Tratamento resiliente de datas (Timestamp do Firestore, ISO string ou fallback)
        let createdAtIso = new Date().toISOString();
        const rawCreated = data['createdAt'];
        if (rawCreated) {
          if (typeof rawCreated === 'string') {
            createdAtIso = rawCreated;
          } else if (typeof rawCreated === 'object' && rawCreated !== null) {
            if (typeof rawCreated.toDate === 'function') {
              createdAtIso = rawCreated.toDate().toISOString();
            } else if (rawCreated.seconds) {
              createdAtIso = new Date(rawCreated.seconds * 1000).toISOString();
            }
          }
        }

        let updatedAtIso: string | undefined = undefined;
        const rawUpdated = data['updatedAt'];
        if (rawUpdated) {
          if (typeof rawUpdated === 'string') {
            updatedAtIso = rawUpdated;
          } else if (typeof rawUpdated === 'object' && rawUpdated !== null) {
            if (typeof rawUpdated.toDate === 'function') {
              updatedAtIso = rawUpdated.toDate().toISOString();
            } else if (rawUpdated.seconds) {
              updatedAtIso = new Date(rawUpdated.seconds * 1000).toISOString();
            }
          }
        }

        return {
          uid: docSnap.id,
          email: data['email'] || null,
          displayName: data['displayName'] || 'Usuário',
          photoURL: data['photoURL'] || null,
          role: (data['role'] as UserRole) || 'user',
          plan: (data['plan'] as PlanType) || 'free',
          planStatus: (data['planStatus'] as PlanStatus) || 'active',
          planExpiresAt: data['planExpiresAt'] || null,
          asaasCustomerId: data['asaasCustomerId'] || null,
          asaasSubscriptionId: data['asaasSubscriptionId'] || null,
          preferences: data['preferences'],
          createdAt: createdAtIso,
          updatedAt: updatedAtIso
        } as UserProfile;
      });

      // Ordena por data de cadastro (mais recentes primeiro)
      return usersList.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    } catch (error) {
      this.logger.error('Erro ao listar usuários no painel administrativo:', error);
      throw error;
    }
  }

  /**
   * Atualiza o plano de assinatura de um usuário (alteração manual de suporte ou cortesia)
   */
  async updateUserPlan(
    userId: string,
    plan: PlanType,
    planStatus: PlanStatus = 'active',
    planExpiresAt: string | null = null
  ): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${userId}`);
      await setDoc(
        userRef,
        {
          plan,
          planStatus,
          planExpiresAt,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (error) {
      this.logger.error(`Erro ao atualizar plano do usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza o papel de permissão (RBAC) do usuário
   */
  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${userId}`);
      await setDoc(
        userRef,
        {
          role,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (error) {
      this.logger.error(`Erro ao atualizar papel do usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calcula métricas agregadas de negócio (MRR, Distribuição de Planos, Conversão)
   */
  calculateSaaSMetrics(users: UserProfile[]): SaaSMetrics {
    const totalUsers = users.length;
    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        freeUsers: 0,
        proUsers: 0,
        duoUsers: 0,
        paidUsers: 0,
        estimatedMRR: 0,
        conversionRate: 0
      };
    }

    let freeUsers = 0;
    let proUsers = 0;
    let duoUsers = 0;

    for (const user of users) {
      const plan = user.plan || 'free';
      const status = user.planStatus || 'active';

      if (plan === 'pro') {
        proUsers++;
      } else if (plan === 'duo') {
        duoUsers++;
      } else {
        freeUsers++;
      }
    }

    const paidUsers = proUsers + duoUsers;
    const estimatedMRR = (proUsers * this.PLAN_PRICES.pro) + (duoUsers * this.PLAN_PRICES.duo);
    const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

    return {
      totalUsers,
      freeUsers,
      proUsers,
      duoUsers,
      paidUsers,
      estimatedMRR: Number(estimatedMRR.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(1))
    };
  }
}
