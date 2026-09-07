import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  output,
  input,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsaasService } from '../../../core/services/asaas.service';
import { AuthStore } from '../../../core/state/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { BillingCycle, PaymentBillingType } from '../../../core/models/payment.model';
import { PlanType } from '../../../core/models/user.model';
import { formatBRL } from '../../../core/utils/formatters';

@Component({
  selector: 'app-subscription-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-modal.component.html',
  styleUrls: ['./subscription-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionModalComponent implements OnInit {
  private asaasService = inject(AsaasService);
  private authStore = inject(AuthStore);
  private notificationService = inject(NotificationService);

  // Inputs e Outputs
  readonly initialPlan = input<PlanType>('pro');
  readonly close = output<void>();

  // Etapas e Seleções (Signals)
  readonly step = signal<'select-plan' | 'checkout' | 'success'>('select-plan');
  readonly selectedPlan = signal<'pro' | 'duo'>('pro');
  readonly cycle = signal<BillingCycle>('YEARLY');
  readonly paymentMethod = signal<PaymentBillingType>('PIX');

  // Estado do PIX
  readonly customerCpf = signal<string>('');
  readonly pixGenerated = signal<boolean>(false);
  readonly pixPayload = signal<string>('');
  readonly isCopied = signal<boolean>(false);
  readonly isProcessing = signal<boolean>(false);

  // Estado do Cartão de Crédito
  readonly cardHolderName = signal<string>('');
  readonly cardNumber = signal<string>('');
  readonly cardExpiry = signal<string>('');
  readonly cardCvv = signal<string>('');

  // Preço Computado
  readonly currentPrice = computed<number>(() => {
    return this.asaasService.getPlanPrice(this.selectedPlan(), this.cycle());
  });

  readonly isCpfValid = computed<boolean>(() => {
    return this.asaasService.isValidCpfCnpj(this.customerCpf());
  });

  readonly isCardFormValid = computed<boolean>(() => {
    return (
      this.cardHolderName().trim().length >= 3 &&
      this.cardNumber().replace(/\s/g, '').length >= 13 &&
      this.cardExpiry().trim().length >= 4 &&
      this.cardCvv().trim().length >= 3 &&
      this.isCpfValid()
    );
  });

  readonly formatBRL = formatBRL;

  ngOnInit(): void {
    if (this.initialPlan() === 'duo') {
      this.selectedPlan.set('duo');
    } else {
      this.selectedPlan.set('pro');
    }
  }

  setCycle(c: BillingCycle): void {
    this.cycle.set(c);
  }

  selectPlan(plan: 'pro' | 'duo'): void {
    this.selectedPlan.set(plan);
  }

  goToCheckout(): void {
    this.step.set('checkout');
  }

  setPaymentMethod(method: PaymentBillingType): void {
    this.paymentMethod.set(method);
  }

  onCpfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.customerCpf.set(input.value);
  }

  /**
   * Gera a transação PIX com QR Code e Copia-e-Cola
   */
  async generatePixPayment(): Promise<void> {
    if (!this.isCpfValid()) {
      this.notificationService.error('Por favor, informe um CPF ou CNPJ válido.');
      return;
    }

    this.isProcessing.set(true);
    try {
      const user = this.authStore.currentUser();
      const customer = await this.asaasService.createCustomer({
        name: user?.displayName || 'Usuário Quinzena',
        email: user?.email || 'contato@quinzena.app',
        cpfCnpj: this.customerCpf()
      });

      const subscription = await this.asaasService.createSubscription({
        plan: this.selectedPlan(),
        cycle: this.cycle(),
        billingType: 'PIX',
        customerId: customer.id || 'cus_demo'
      });

      const pixResponse = await this.asaasService.getPixQrCodeForPayment(subscription.id);
      this.pixPayload.set(pixResponse.payload);
      this.pixGenerated.set(true);
      this.notificationService.info('QR Code PIX gerado! Realize o pagamento para ativação.');
    } catch (err: any) {
      this.notificationService.error(err?.message || 'Erro ao gerar pagamento PIX.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Copia o código PIX para a área de transferência
   */
  async copyPixPayload(): Promise<void> {
    const payload = this.pixPayload();
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      this.isCopied.set(true);
      this.notificationService.success('Código PIX copiado para a área de transferência!');
      setTimeout(() => this.isCopied.set(false), 3000);
    } catch {
      this.notificationService.info('Copie o código selecionando o texto da caixa.');
    }
  }

  /**
   * Confirmação / Simulação de Pagamento com Ativação Reativa do Plano
   */
  async simulatePaymentConfirmation(): Promise<void> {
    this.isProcessing.set(true);
    try {
      // Simula confirmação do webhook do gateway
      const plan = this.selectedPlan();
      this.authStore.updateCurrentUser({
        plan,
        planStatus: 'active'
      });

      this.step.set('success');
      this.notificationService.success(`Assinatura confirmada! Bem-vindo ao plano ${plan.toUpperCase()}!`);
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Processa pagamento via Cartão de Crédito
   */
  async processCreditCardPayment(): Promise<void> {
    if (!this.isCardFormValid()) {
      this.notificationService.error('Preencha todos os dados do cartão corretamente.');
      return;
    }

    this.isProcessing.set(true);
    try {
      const user = this.authStore.currentUser();
      const customer = await this.asaasService.createCustomer({
        name: user?.displayName || this.cardHolderName(),
        email: user?.email || 'contato@quinzena.app',
        cpfCnpj: this.customerCpf()
      });

      const expiryParts = this.cardExpiry().split('/');
      await this.asaasService.createSubscription({
        plan: this.selectedPlan(),
        cycle: this.cycle(),
        billingType: 'CREDIT_CARD',
        customerId: customer.id || 'cus_demo',
        cardData: {
          holderName: this.cardHolderName(),
          number: this.cardNumber().replace(/\s/g, ''),
          expiryMonth: expiryParts[0] || '12',
          expiryYear: expiryParts[1] ? (expiryParts[1].length === 2 ? '20' + expiryParts[1] : expiryParts[1]) : '2028',
          ccv: this.cardCvv()
        }
      });

      const plan = this.selectedPlan();
      this.authStore.updateCurrentUser({
        plan,
        planStatus: 'active'
      });

      this.step.set('success');
      this.notificationService.success(`Assinatura ativada com sucesso no plano ${plan.toUpperCase()}!`);
    } catch (err: any) {
      this.notificationService.error(err?.message || 'Erro ao processar pagamento com cartão.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}
