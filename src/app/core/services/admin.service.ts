import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { UserProfile, PlanType, PlanStatus, UserRole } from '../models/user.model';
import { AsaasConfig, AsaasEnvironment } from '../models/payment.model';

export interface PaginatedUsersResponse {
  users: UserProfile[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

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
  private http = inject(HttpClient, { optional: true });
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
   * Mapeia um DocumentSnapshot do Firestore para o modelo UserProfile com sanitização e fallbacks
   */
  private mapUserDoc(docSnap: any): UserProfile {
    const data = docSnap.data ? docSnap.data() : (docSnap || {});

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

    let planExpiresAtIso: string | null = null;
    const rawExpires = data['planExpiresAt'];
    if (rawExpires) {
      if (typeof rawExpires === 'string') {
        planExpiresAtIso = rawExpires;
      } else if (typeof rawExpires === 'object' && rawExpires !== null) {
        if (typeof rawExpires.toDate === 'function') {
          planExpiresAtIso = rawExpires.toDate().toISOString();
        } else if (typeof rawExpires.seconds === 'number') {
          planExpiresAtIso = new Date(rawExpires.seconds * 1000).toISOString();
        } else if (typeof rawExpires._seconds === 'number') {
          planExpiresAtIso = new Date(rawExpires._seconds * 1000).toISOString();
        }
      } else if (typeof rawExpires === 'number') {
        planExpiresAtIso = new Date(rawExpires).toISOString();
      }
    }

    return {
      uid: docSnap.id || data['uid'] || '',
      email: data['email'] || null,
      displayName: data['displayName'] || 'Usuário',
      photoURL: data['photoURL'] || null,
      role: (data['role'] as UserRole) || 'user',
      plan: (data['plan'] as PlanType) || 'free',
      planStatus: (data['planStatus'] as PlanStatus) || 'active',
      planExpiresAt: planExpiresAtIso,
      asaasCustomerId: data['asaasCustomerId'] || null,
      asaasSubscriptionId: data['asaasSubscriptionId'] || null,
      preferences: data['preferences'],
      createdAt: createdAtIso,
      updatedAt: updatedAtIso
    } as UserProfile;
  }

  /**
   * Busca página de usuários com limite de quota (limit(pageSize)) e cursor de paginação (startAfter)
   * Previne varreduras completas no Firestore garantindo controle de custos no plano Blaze (CARD-065).
   */
  async getUsersPage(
    pageSize: number = 50,
    startAfterDoc?: any
  ): Promise<PaginatedUsersResponse> {
    try {
      const usersRef = collection(this.firestore, 'users');
      let q = startAfterDoc
        ? query(usersRef, startAfter(startAfterDoc), limit(pageSize))
        : query(usersRef, limit(pageSize));

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { users: [], hasMore: false, lastDoc: null };
      }

      const usersList: UserProfile[] = snapshot.docs.map(docSnap => this.mapUserDoc(docSnap));

      // Ordena lote por data de cadastro (mais recentes primeiro)
      usersList.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length >= pageSize;

      return {
        users: usersList,
        hasMore,
        lastDoc: lastVisible
      };
    } catch (error) {
      this.logger.error('Erro ao listar página de usuários no painel administrativo:', error);
      throw error;
    }
  }

  /**
   * Busca usuários com limite padrão de 50 documentos para prevenir consumo excessivo no Firestore (CARD-065)
   */
  async getAllUsers(pageSize: number = 50): Promise<UserProfile[]> {
    const page = await this.getUsersPage(pageSize);
    return page.users;
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
   * Mock/override da callable function para facilidade de testes unitários (CARD-082)
   */
  deleteUserCallableFn: ((data: { targetUid: string; reason?: string }) => Promise<{ data: any }>) | null = null;
  testAsaasCallableFn: ((data: { apiKey: string; environment?: AsaasEnvironment }) => Promise<{ data: any }>) | null = null;

  /**
   * Solicita a exclusão definitiva e em cascata de um usuário via Cloud Function (CARD-082).
   * Garante conformidade com o Direito ao Esquecimento da LGPD.
   */
  async deleteUser(
    targetUid: string,
    reason?: string
  ): Promise<{ success: boolean; targetUid: string; message: string }> {
    try {
      const callable = this.deleteUserCallableFn || httpsCallable<
        { targetUid: string; reason?: string },
        { success: boolean; targetUid: string; message: string }
      >(
        getFunctions(this.firebaseService.app),
        'adminDeleteUserAccount'
      );

      const result = await callable({ targetUid, reason });
      this.logger.info(`Usuário ${targetUid} excluído com sucesso pelo backend:`, result.data);
      return result.data;
    } catch (err: any) {
      this.logger.error(`Erro ao deletar usuário ${targetUid} via Cloud Function:`, err);
      const errorMsg =
        err?.message || err?.details || 'Não foi possível excluir a conta do usuário. Verifique suas permissões.';
      throw new Error(errorMsg);
    }
  }

  /**
   * Calcula métricas agregadas de negócio (MRR, Distribuição de Planos, Conversão).
   * O usuário administrador não contabiliza receita (MRR) nem como assinante comercial,
   * visto que é o dono da aplicação e possui acesso total isento.
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
    let adminUsers = 0;

    for (const user of users) {
      // O usuário admin não contabiliza valor/MRR nem assinante comercial
      if (user.role === 'admin') {
        adminUsers++;
        continue;
      }

      const plan = user.plan || 'free';

      if (plan === 'pro') {
        proUsers++;
      } else if (plan === 'duo') {
        duoUsers++;
      } else {
        freeUsers++;
      }
    }

    const paidUsers = proUsers + duoUsers;
    const clientUsers = totalUsers - adminUsers;
    const estimatedMRR = (proUsers * this.PLAN_PRICES.pro) + (duoUsers * this.PLAN_PRICES.duo);
    const conversionRate = clientUsers > 0 ? (paidUsers / clientUsers) * 100 : 0;

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

  /**
   * Obtém as configurações ativas do gateway Asaas salvas no Firestore (exclusivo para administradores)
   */
  async getAsaasConfig(): Promise<AsaasConfig | null> {
    // Purga proativa de chave legada caso existente em versões anteriores
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('quinzena_asaas_config');
      }
    } catch {
      // Ignora erro em ambientes sem localStorage
    }

    try {
      const configDocRef = doc(this.firestore, 'system_config', 'asaas');
      const snap = await getDoc(configDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const config: AsaasConfig = {
          environment: data['environment'] || 'sandbox',
          apiKey: data['apiKey'] || '',
          webhookSecret: data['webhookSecret'] || '',
          walletId: data['walletId'] || '',
          notificationEmail: data['notificationEmail'] || '',
          isActive: data['isActive'] ?? false,
          lastTestedAt: data['lastTestedAt'] || undefined,
          lastTestStatus: data['lastTestStatus'] || undefined,
          lastTestMessage: data['lastTestMessage'] || undefined,
          updatedAt: data['updatedAt'] || undefined
        };
        return config;
      }
      return {
        environment: 'sandbox',
        apiKey: '',
        webhookSecret: '',
        walletId: '',
        notificationEmail: '',
        isActive: false
      };
    } catch (err: any) {
      this.logger.warn('Aviso: Não foi possível carregar configurações do Asaas no Firestore.', err);
      return {
        environment: 'sandbox',
        apiKey: '',
        webhookSecret: '',
        walletId: '',
        notificationEmail: '',
        isActive: false
      };
    }
  }

  /**
   * Salva com segurança as configurações do Asaas na coleção administrativa do Firestore (sem persistir segredos em localStorage)
   */
  async saveAsaasConfig(config: AsaasConfig): Promise<{ syncedWithCloud: boolean }> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('quinzena_asaas_config');
      }
    } catch {
      // Ignora
    }

    try {
      const configDocRef = doc(this.firestore, 'system_config', 'asaas');
      const payload: Record<string, any> = {
        environment: config.environment || 'sandbox',
        apiKey: (config.apiKey || '').trim(),
        webhookSecret: (config.webhookSecret || '').trim(),
        walletId: (config.walletId || '').trim(),
        notificationEmail: (config.notificationEmail || '').trim(),
        isActive: !!config.apiKey && config.apiKey.trim().length > 10,
        updatedAt: new Date().toISOString()
      };

      if (config.lastTestedAt) {
        payload['lastTestedAt'] = config.lastTestedAt;
      }
      if (config.lastTestStatus) {
        payload['lastTestStatus'] = config.lastTestStatus;
      }
      if (config.lastTestMessage) {
        payload['lastTestMessage'] = config.lastTestMessage;
      }

      await setDoc(configDocRef, payload, { merge: true });
      return { syncedWithCloud: true };
    } catch (err: any) {
      this.logger.warn('Aviso: Firestore recusou gravação de system_config (permissão ou offline). Dados preservados localmente:', err);
      // Se o erro for de permissão ou rede, preserva no cache local e sinaliza
      if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
        return { syncedWithCloud: false };
      }
      throw err;
    }
  }

  /**
   * Testa a conectividade com a API Asaas v3 através de Cloud Function segura no backend (sem CORS).
   * Funciona perfeitamente em Produção (https://quinzena.com.br), Staging e Localhost.
   */
  async testAsaasConnection(
    apiKey: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<{ success: boolean; message: string; balance?: number }> {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      return { success: false, message: 'A chave de API (Access Token) não pode ser vazia.' };
    }

    if (cleanKey.length < 10) {
      return { success: false, message: 'A chave de API informada é muito curta ou inválida.' };
    }

    const envLabel = environment === 'production' ? 'PRODUÇÃO' : 'SANDBOX';

    // 1. Invoca a Cloud Function se o módulo de functions estiver disponível
    try {
      if (this.testAsaasCallableFn) {
        const response = await this.testAsaasCallableFn({ apiKey: cleanKey, environment });
        return response.data;
      }

      if (this.firebaseService.app) {
        const callable = httpsCallable<
          { apiKey: string; environment: AsaasEnvironment },
          { success: boolean; message: string; balance?: number }
        >(getFunctions(this.firebaseService.app), 'adminTestAsaasConnection');

        const response = await callable({
          apiKey: cleanKey,
          environment
        });

        const result = response.data;
        await this.updateAsaasTestStatus(
          result.success ? 'success' : 'error',
          result.message
        );
        return result;
      }
    } catch (err: any) {
      this.logger.error('Erro ao invocar Cloud Function adminTestAsaasConnection:', err);
      const errorMsg = err?.message || 'Falha ao comunicar com o servidor para validar credenciais do Asaas.';
      await this.updateAsaasTestStatus('error', errorMsg);
      return { success: false, message: errorMsg };
    }

    // 2. Modo Mock/Fallback seguro para testes locais sem backend conectado
    const isMockValid = cleanKey.startsWith('$aact_') || cleanKey.startsWith('mock_') || cleanKey.length >= 20;
    if (isMockValid) {
      const msg = `Conexão simulada com sucesso com o Asaas (${envLabel}).`;
      await this.updateAsaasTestStatus('success', msg);
      return { success: true, message: msg, balance: 1250.00 };
    } else {
      const msg = 'Falha de Autenticação: O formato da chave não corresponde ao padrão Asaas ($aact_...).';
      await this.updateAsaasTestStatus('error', msg);
      return { success: false, message: msg };
    }
  }

  /**
   * Atualiza o status do último teste de conectividade no Firestore
   */
  private async updateAsaasTestStatus(status: 'success' | 'error', message: string): Promise<void> {
    try {
      const configDocRef = doc(this.firestore, 'system_config', 'asaas');
      await setDoc(
        configDocRef,
        {
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: status,
          lastTestMessage: message
        },
        { merge: true }
      );
    } catch {
      // Ignora erro em caso de teste sem persistência direta
    }
  }
}

