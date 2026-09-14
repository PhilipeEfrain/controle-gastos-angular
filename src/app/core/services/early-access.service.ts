import { Injectable, signal, computed, inject } from '@angular/core';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { EarlyAccessConfig, WaitlistLead } from '../models/early-access.model';

@Injectable({
  providedIn: 'root'
})
export class EarlyAccessService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly logger = inject(LoggerService);

  private readonly defaultConfig: EarlyAccessConfig = {
    registrationsOpen: true,
    maxBetaUsers: 100,
    message: 'Estamos em Acesso Antecipado com vagas limitadas para garantir a melhor experiência financeira.'
  };

  private readonly _config = signal<EarlyAccessConfig>(this.defaultConfig);
  readonly config = this._config.asReadonly();

  readonly isRegistrationsOpen = computed(() => {
    const cfg = this._config();
    if (!cfg.registrationsOpen) return false;
    if (cfg.totalRegisteredUsers !== undefined && cfg.maxBetaUsers !== undefined) {
      return cfg.totalRegisteredUsers < cfg.maxBetaUsers;
    }
    return true;
  });

  constructor() {
    this.fetchConfig();
  }

  /**
   * Consulta a configuração pública de Acesso Antecipado do Firestore com cache
   */
  async fetchConfig(): Promise<EarlyAccessConfig> {
    try {
      if (!this.firebaseService.firestore) {
        return this.defaultConfig;
      }

      const docRef = doc(this.firebaseService.firestore, 'system_config', 'early_access');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<EarlyAccessConfig>;
        const merged: EarlyAccessConfig = {
          ...this.defaultConfig,
          ...data
        };
        this._config.set(merged);
        return merged;
      }
    } catch (err) {
      this.logger.warn('Não foi possível carregar early_access config do Firestore. Usando defaults.', err);
    }

    return this.defaultConfig;
  }

  /**
   * Registra um e-mail de visitante na fila de espera pública
   */
  async joinWaitlist(email: string, source = 'auth_form'): Promise<boolean> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return false;
    }

    try {
      const waitlistCol = collection(this.firebaseService.firestore, 'waitlist_leads');
      const lead: WaitlistLead = {
        email: trimmedEmail,
        source,
        createdAt: new Date().toISOString()
      };

      await addDoc(waitlistCol, lead);
      return true;
    } catch (err) {
      this.logger.error('Erro ao adicionar e-mail na lista de espera:', err);
      return false;
    }
  }
}
