import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, SaaSMetrics } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStore } from '../../core/state/auth.store';
import { UserProfile, PlanType, PlanStatus, UserRole } from '../../core/models/user.model';
import { AsaasConfig, AsaasEnvironment } from '../../core/models/payment.model';
import { formatBRL } from '../../core/utils/formatters';
import { parseFirestoreDate } from '../../core/utils/date';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  private notificationService = inject(NotificationService);
  private authStore = inject(AuthStore);

  // Navegação em Abas (Tabs)
  readonly activeTab = signal<'overview' | 'asaas'>('overview');

  // Estados Reativos de Usuários e Métricas (Signals)
  readonly users = signal<UserProfile[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly planFilter = signal<'all' | 'free' | 'pro' | 'duo'>('all');

  // Estados Reativos da Configuração Asaas (CARD-032)
  readonly asaasEnvironment = signal<AsaasEnvironment>('sandbox');
  readonly asaasApiKey = signal<string>('');
  readonly asaasWebhookSecret = signal<string>('');
  readonly asaasWalletId = signal<string>('');
  readonly asaasNotificationEmail = signal<string>('');
  readonly asaasIsActive = signal<boolean>(false);
  readonly asaasLastTestedAt = signal<string | undefined>(undefined);
  readonly asaasLastTestStatus = signal<'success' | 'error' | undefined>(undefined);
  readonly asaasLastTestMessage = signal<string | undefined>(undefined);

  readonly showApiKey = signal<boolean>(false);
  readonly showWebhookSecret = signal<boolean>(false);
  readonly isLoadingAsaas = signal<boolean>(false);
  readonly isSavingAsaas = signal<boolean>(false);
  readonly isTestingConnection = signal<boolean>(false);
  readonly connectionTestResult = signal<{ success: boolean; message: string; balance?: number } | null>(null);

  // Estado do Modal de Edição de Usuário
  readonly selectedUserForEdit = signal<UserProfile | null>(null);
  readonly editPlan = signal<PlanType>('free');
  readonly editStatus = signal<PlanStatus>('active');
  readonly editRole = signal<UserRole>('user');

  // Métricas Globais Computadas do SaaS (MRR, Total, Conversão)
  readonly metrics = computed<SaaSMetrics>(() => {
    return this.adminService.calculateSaaSMetrics(this.users());
  });

  // Lista Filtrada de Usuários Reativa
  readonly filteredUsers = computed<UserProfile[]>(() => {
    const list = this.users();
    const query = this.searchTerm().trim().toLowerCase();
    const plan = this.planFilter();

    return list.filter(user => {
      // Filtro por plano
      if (plan !== 'all') {
        const userPlan = user.plan || 'free';
        if (userPlan !== plan) return false;
      }

      // Filtro por busca de texto (Nome, E-mail, UID)
      if (query) {
        const nameMatch = user.displayName?.toLowerCase().includes(query) ?? false;
        const emailMatch = user.email?.toLowerCase().includes(query) ?? false;
        const uidMatch = user.uid.toLowerCase().includes(query);
        return nameMatch || emailMatch || uidMatch;
      }

      return true;
    });
  });

  readonly formatBRL = formatBRL;

  ngOnInit(): void {
    this.loadUsers();
    this.loadAsaasConfig();
  }

  /**
   * Alterna a aba ativa da área administrativa
   */
  setTab(tab: 'overview' | 'asaas'): void {
    this.activeTab.set(tab);
  }

  /**
   * Carrega as configurações ativas do Asaas
   */
  async loadAsaasConfig(): Promise<void> {
    this.isLoadingAsaas.set(true);
    try {
      const config = await this.adminService.getAsaasConfig();
      if (config) {
        this.asaasEnvironment.set(config.environment || 'sandbox');
        this.asaasApiKey.set(config.apiKey || '');
        this.asaasWebhookSecret.set(config.webhookSecret || '');
        this.asaasWalletId.set(config.walletId || '');
        this.asaasNotificationEmail.set(config.notificationEmail || '');
        this.asaasIsActive.set(config.isActive || false);
        this.asaasLastTestedAt.set(config.lastTestedAt);
        this.asaasLastTestStatus.set(config.lastTestStatus);
        this.asaasLastTestMessage.set(config.lastTestMessage);
      }
    } catch {
      this.notificationService.error('Erro ao carregar configurações do Asaas.');
    } finally {
      this.isLoadingAsaas.set(false);
    }
  }

  /**
   * Altera o ambiente (sandbox vs production)
   */
  setEnvironment(env: AsaasEnvironment): void {
    this.asaasEnvironment.set(env);
    this.connectionTestResult.set(null);
  }

  /**
   * Alterna visibilidade da chave de API
   */
  toggleShowApiKey(): void {
    this.showApiKey.update(v => !v);
  }

  /**
   * Alterna visibilidade do segredo do webhook
   */
  toggleShowWebhookSecret(): void {
    this.showWebhookSecret.update(v => !v);
  }

  /**
   * Copia texto para a área de transferência com feedback
   */
  async copyToClipboard(text: string, label: string): Promise<void> {
    if (!text) {
      this.notificationService.warning(`Nenhum valor para copiar em ${label}.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.success(`${label} copiado para a área de transferência!`);
    } catch {
      this.notificationService.info(`Copie manualmente: ${text}`);
    }
  }

  /**
   * Executa o teste de conectividade com a API Asaas
   */
  async testAsaasConnection(): Promise<void> {
    const key = this.asaasApiKey().trim();
    if (!key) {
      this.notificationService.warning('Informe o Access Token antes de testar a conexão.');
      return;
    }

    this.isTestingConnection.set(true);
    this.connectionTestResult.set(null);

    try {
      const result = await this.adminService.testAsaasConnection(key, this.asaasEnvironment());
      this.connectionTestResult.set(result);

      if (result.success) {
        this.notificationService.success('Conexão com a API Asaas estabelecida com sucesso!');
        this.asaasLastTestedAt.set(new Date().toISOString());
        this.asaasLastTestStatus.set('success');
        this.asaasLastTestMessage.set(result.message);
      } else {
        this.notificationService.error(result.message);
        this.asaasLastTestedAt.set(new Date().toISOString());
        this.asaasLastTestStatus.set('error');
        this.asaasLastTestMessage.set(result.message);
      }
    } catch {
      this.notificationService.error('Erro inesperado ao testar conexão.');
    } finally {
      this.isTestingConnection.set(false);
    }
  }

  /**
   * Salva com segurança as credenciais e ambiente do Asaas
   */
  async saveAsaasConfig(): Promise<void> {
    const apiKey = this.asaasApiKey().trim();
    if (!apiKey) {
      this.notificationService.warning('O Access Token da API é obrigatório.');
      return;
    }

    this.isSavingAsaas.set(true);
    try {
      const configPayload: AsaasConfig = {
        environment: this.asaasEnvironment(),
        apiKey,
        webhookSecret: this.asaasWebhookSecret().trim(),
        walletId: this.asaasWalletId().trim(),
        notificationEmail: this.asaasNotificationEmail().trim(),
        isActive: apiKey.length >= 10,
        lastTestedAt: this.asaasLastTestedAt(),
        lastTestStatus: this.asaasLastTestStatus(),
        lastTestMessage: this.asaasLastTestMessage()
      };

      await this.adminService.saveAsaasConfig(configPayload);
      this.asaasIsActive.set(configPayload.isActive);
      this.notificationService.success('Configurações do Asaas salvas com sucesso no Firebase!');
    } catch {
      this.notificationService.error('Erro ao salvar configurações do Asaas.');
    } finally {
      this.isSavingAsaas.set(false);
    }
  }

  /**
   * Retorna a URL padrão de webhook para orientar o administrador
   */
  getWebhookUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com';
    return `${origin}/api/asaas/webhook`;
  }

  /**
   * Carrega a lista completa de usuários do SaaS
   */
  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.adminService.getAllUsers();
      if (result.length === 0 && this.authStore.currentUser()) {
        const current = this.authStore.currentUser()!;
        this.users.set([current]);
      } else {
        this.users.set(result);
      }
    } catch {
      // Se houver restrição de permissão de listagem, garante o próprio usuário logado
      if (this.authStore.currentUser()) {
        this.users.set([this.authStore.currentUser()!]);
      } else {
        this.notificationService.error('Não foi possível carregar a lista de usuários.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  // Manipulação de Busca e Filtros
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  setPlanFilter(filter: 'all' | 'free' | 'pro' | 'duo'): void {
    this.planFilter.set(filter);
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.planFilter.set('all');
  }

  // Modal de Gestão de Usuário
  openEditModal(user: UserProfile): void {
    this.selectedUserForEdit.set(user);
    this.editPlan.set(user.plan || 'free');
    this.editStatus.set(user.planStatus || 'active');
    this.editRole.set(user.role || 'user');
  }

  closeEditModal(): void {
    this.selectedUserForEdit.set(null);
  }

  onStatusChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.editStatus.set(select.value as PlanStatus);
  }

  onRoleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.editRole.set(select.value as UserRole);
  }

  /**
   * Salva alterações manuais de plano e papel no Firestore
   */
  async saveUserChanges(): Promise<void> {
    const target = this.selectedUserForEdit();
    if (!target) return;

    this.isSaving.set(true);
    try {
      const newPlan = this.editPlan();
      const newStatus = this.editStatus();
      const newRole = this.editRole();

      // Atualiza plano e status
      await this.adminService.updateUserPlan(target.uid, newPlan, newStatus);

      // Atualiza papel RBAC se modificado
      if (newRole !== target.role) {
        await this.adminService.updateUserRole(target.uid, newRole);
      }

      // Atualiza o estado local reativo imediatamente
      this.users.update(currentList =>
        currentList.map(u =>
          u.uid === target.uid
            ? {
                ...u,
                plan: newPlan,
                planStatus: newStatus,
                role: newRole,
                updatedAt: new Date().toISOString()
              }
            : u
        )
      );

      this.notificationService.success(`Usuário ${target.displayName || target.email} atualizado com sucesso!`);
      this.closeEditModal();
    } catch {
      this.notificationService.error('Erro ao atualizar usuário no banco de dados.');
    } finally {
      this.isSaving.set(false);
    }
  }

  // Helpers de Interface
  getUserInitials(user: UserProfile): string {
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  }

  formatUid(uid: string): string {
    if (!uid) return '';
    if (uid.length <= 12) return uid;
    return `${uid.substring(0, 6)}...${uid.substring(uid.length - 4)}`;
  }

  formatDate(dateVal?: any): string {
    const date = parseFirestoreDate(dateVal);
    if (!date) return 'Recente';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch {
      return 'Recente';
    }
  }
}
