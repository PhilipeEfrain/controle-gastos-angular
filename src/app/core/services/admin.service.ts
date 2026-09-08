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
  orderBy
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { UserProfile, PlanType, PlanStatus, UserRole } from '../models/user.model';
import { AsaasConfig, AsaasEnvironment } from '../models/payment.model';

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

  /**
   * Obtém as configurações ativas do gateway Asaas salvas no Firestore
   */
  async getAsaasConfig(): Promise<AsaasConfig | null> {
    try {
      const configDocRef = doc(this.firestore, 'system_config', 'asaas');
      const snap = await getDoc(configDocRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
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
        } as AsaasConfig;
      }
      return {
        environment: 'sandbox',
        apiKey: '',
        webhookSecret: '',
        walletId: '',
        notificationEmail: '',
        isActive: false
      };
    } catch (err) {
      this.logger.error('Erro ao carregar configurações do Asaas:', err);
      return null;
    }
  }

  /**
   * Salva com segurança as configurações do Asaas na coleção administrativa do Firestore
   */
  async saveAsaasConfig(config: AsaasConfig): Promise<void> {
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
    } catch (err) {
      this.logger.error('Erro ao salvar configurações do Asaas:', err);
      throw err;
    }
  }

  /**
   * Testa a conectividade com a API Asaas v3 utilizando a chave e ambiente informados
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

    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const envLabel = environment === 'production' ? 'PRODUÇÃO' : 'SANDBOX';
    const proxyBase = environment === 'production' ? '/api/asaas/production' : '/api/asaas/sandbox';
    const directBase = environment === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';

    // Se estiver em localhost, tenta a rota proxy do dev server; caso contrário, a rota direta
    const targetUrls = isLocalhost ? [proxyBase, directBase] : [directBase];

    if (this.http) {
      const headers = new HttpHeaders({
        'access_token': cleanKey,
        'Content-Type': 'application/json'
      });

      let lastError: any = null;

      for (const baseUrl of targetUrls) {
        try {
          // GET /v3/finance/balance - endpoint oficial do Asaas v3 para validação de credenciais
          const response: any = await firstValueFrom(
            this.http.get<any>(`${baseUrl}/finance/balance`, { headers })
          );

          const balance = response?.balance ?? 0;
          const msg = `Conexão bem-sucedida com o Asaas (${envLabel})! Saldo consultado: R$ ${balance.toFixed(2)}`;

          await this.updateAsaasTestStatus('success', msg);
          return { success: true, message: msg, balance };
        } catch (err: any) {
          lastError = err;
          // Se foi 404 na rota proxy (dev-server rodando sem o proxy ativado), tenta o fallback direto
          if (err.status === 404 && baseUrl === proxyBase) {
            continue;
          }
          break;
        }
      }

      // Trata o erro retornado
      let errorMsg = 'Falha ao conectar com o Asaas.';
      if (lastError?.status === 401 || lastError?.status === 403) {
        errorMsg = 'Falha de Autenticação (401/403): O Access Token informado é inválido ou foi revogado no painel do Asaas.';
      } else if (lastError?.status === 0) {
        const isKeyFormatValid = cleanKey.startsWith('$aact_') && cleanKey.length >= 25;
        if (isKeyFormatValid) {
          errorMsg = 'Bloqueio de CORS no navegador: A API do Asaas não permite chamadas diretas de browsers. Reinicie o servidor com "npm start" para utilizar o proxy local configurado (proxy.conf.json).';
        } else {
          errorMsg = 'Aviso de Conectividade: Requisição bloqueada por CORS no navegador. No ambiente real, a chamada é processada pelo backend/Cloud Function.';
        }
      } else if (lastError?.error?.errors?.length > 0) {
        errorMsg = `Erro Asaas: ${lastError.error.errors[0].description || lastError.message}`;
      } else if (lastError?.message) {
        errorMsg = `Erro na requisição: ${lastError.message}`;
      }

      await this.updateAsaasTestStatus('error', errorMsg);
      return { success: false, message: errorMsg };
    }

    // Modo Mock/Teste seguro sem HttpClient
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

