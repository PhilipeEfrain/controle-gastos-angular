import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionModalComponent } from './subscription-modal.component';
import { AsaasService } from '../../../core/services/asaas.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthStore } from '../../../core/state/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SubscriptionModalComponent (Checkout de Assinaturas)', () => {
  let component: SubscriptionModalComponent;
  let fixture: ComponentFixture<SubscriptionModalComponent>;
  let mockAsaasService: any;
  let mockAdminService: any;
  let mockAuthStore: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockAsaasService = {
      getPlanPrice: vi.fn((plan: string) => {
        if (plan === 'pro') return 9.90;
        if (plan === 'duo') return 19.90;
        return 0;
      }),
      isValidCpfCnpj: vi.fn((cpf: string) => cpf.replace(/\D/g, '').length === 11),
      isValidCpf: vi.fn((cpf: string) => cpf.replace(/\D/g, '').length === 11),
      createCustomer: vi.fn().mockResolvedValue({ id: 'cus_123', name: 'Teste' }),
      createSubscription: vi.fn().mockResolvedValue({ id: 'sub_123', value: 9.90 }),
      getPixQrCodeForPayment: vi.fn().mockResolvedValue({
        encodedImage: 'data:image/png;base64,...',
        payload: '00020126580014br.gov.bcb.pix...',
        expirationDate: '2026-09-08T00:00:00.000Z'
      })
    };

    mockAdminService = {
      getAsaasConfig: vi.fn().mockResolvedValue({
        environment: 'sandbox',
        apiKey: '$aact_test_token_12345',
        isActive: true
      })
    };

    mockAuthStore = {
      currentUser: signal({
        uid: 'user-123',
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        plan: 'free'
      }),
      updateCurrentUser: vi.fn(),
      upgradeSubscription: vi.fn().mockResolvedValue(undefined)
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionModalComponent],
      providers: [
        { provide: AsaasService, useValue: mockAsaasService },
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();


    fixture = TestBed.createComponent(SubscriptionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve inicializar com o plano Pro e ciclo Mensal por padrão', () => {
    expect(component).toBeTruthy();
    expect(component.selectedPlan()).toBe('pro');
    expect(component.cycle()).toBe('MONTHLY');
    expect(component.currentPrice()).toBe(9.90);
  });

  it('Cenário BDD 1: deve atualizar o preço ao alternar entre os planos Pro e Duo', () => {
    expect(component.currentPrice()).toBe(9.90);

    component.selectPlan('duo');
    expect(component.currentPrice()).toBe(19.90);

    component.selectPlan('pro');
    expect(component.currentPrice()).toBe(9.90);
  });

  it('Cenário BDD 2: deve avançar para checkout ao selecionar um plano', () => {
    component.selectPlan('duo');
    component.goToCheckout();

    expect(component.step()).toBe('checkout');
    expect(component.selectedPlan()).toBe('duo');
  });

  it('Cenário BDD 3: deve gerar QR Code PIX quando CPF for válido', async () => {
    component.goToCheckout();
    component.customerCpf.set('529.982.247-25');

    await component.generatePixPayment();

    expect(mockAsaasService.createCustomer).toHaveBeenCalled();
    expect(mockAsaasService.createSubscription).toHaveBeenCalled();
    expect(mockAsaasService.getPixQrCodeForPayment).toHaveBeenCalled();
    expect(component.pixGenerated()).toBe(true);
    expect(component.pixPayload()).toContain('br.gov.bcb.pix');
  });

  it('Cenário BDD 4: deve persistir assinatura via upgradeSubscription e exibir celebração ao confirmar pagamento', async () => {
    component.goToCheckout();
    component.selectPlan('pro');

    await component.simulatePaymentConfirmation();

    expect(mockAuthStore.upgradeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        planStatus: 'active'
      })
    );
    expect(component.step()).toBe('success');
    expect(mockNotificationService.success).toHaveBeenCalled();
  });

  it('Cenário BDD 5: deve aplicar máscaras nos campos do cartão de crédito', () => {
    const inputNumber = { value: '5555555555555555' } as HTMLInputElement;
    component.onCardNumberInput({ target: inputNumber } as any);
    expect(component.cardNumber()).toBe('5555 5555 5555 5555');
    expect(inputNumber.value).toBe('5555 5555 5555 5555');

    const inputExpiry = { value: '1228' } as HTMLInputElement;
    component.onCardExpiryInput({ target: inputExpiry } as any);
    expect(component.cardExpiry()).toBe('12/28');
    expect(inputExpiry.value).toBe('12/28');

    const inputCvv = { value: '12345' } as HTMLInputElement;
    component.onCardCvvInput({ target: inputCvv } as any);
    expect(component.cardCvv()).toBe('1234');
    expect(inputCvv.value).toBe('1234');

    const inputName = { value: 'joão silva 123' } as HTMLInputElement;
    component.onCardHolderNameInput({ target: inputName } as any);
    expect(component.cardHolderName()).toBe('JOÃO SILVA ');
    expect(inputName.value).toBe('JOÃO SILVA ');

    const inputCpf = { value: '52998224725' } as HTMLInputElement;
    component.onCpfInput({ target: inputCpf } as any);
    expect(component.customerCpf()).toBe('529.982.247-25');
    expect(inputCpf.value).toBe('529.982.247-25');
  });

  it('Cenário BDD 6: deve validar o formulário e persistir upgrade com credenciais Asaas', async () => {
    component.goToCheckout();
    component.setPaymentMethod('CREDIT_CARD');

    component.cardHolderName.set('CLIENTE TESTE');
    component.cardNumber.set('5555 5555 5555 5555');
    component.cardExpiry.set('12/28');
    component.cardCvv.set('123');
    component.customerCpf.set('529.982.247-25');

    expect(component.isCardFormValid()).toBe(true);

    await component.processCreditCardPayment();

    expect(mockAdminService.getAsaasConfig).toHaveBeenCalled();
    expect(mockAsaasService.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        cpfCnpj: '529.982.247-25'
      }),
      '$aact_test_token_12345',
      'sandbox'
    );
    expect(mockAsaasService.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: 'CREDIT_CARD',
        cardData: expect.objectContaining({
          holderName: 'CLIENTE TESTE',
          number: '5555555555555555',
          expiryMonth: '12',
          expiryYear: '2028',
          ccv: '123'
        })
      }),
      '$aact_test_token_12345',
      'sandbox'
    );
    expect(mockAuthStore.upgradeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        planStatus: 'active',
        asaasCustomerId: 'cus_123',
        asaasSubscriptionId: 'sub_123'
      })
    );
    expect(component.step()).toBe('success');
    expect(mockNotificationService.success).toHaveBeenCalled();
  });

  it('Cenário BDD 7: deve exibir erro e não alterar o plano quando a API Asaas rejeitar o cartão', async () => {
    component.goToCheckout();
    component.setPaymentMethod('CREDIT_CARD');

    component.cardHolderName.set('CLIENTE RECUSADO');
    component.cardNumber.set('4000 0000 0000 0002');
    component.cardExpiry.set('12/28');
    component.cardCvv.set('123');
    component.customerCpf.set('529.982.247-25');

    mockAsaasService.createSubscription.mockRejectedValueOnce(
      new Error('Cartão recusado pela operadora: saldo insuficiente.')
    );

    await component.processCreditCardPayment();

    expect(mockAuthStore.upgradeSubscription).not.toHaveBeenCalled();
    expect(component.step()).toBe('checkout');
    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Cartão recusado pela operadora: saldo insuficiente.'
    );
  });
});

