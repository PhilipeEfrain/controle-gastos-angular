import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionModalComponent } from './subscription-modal.component';
import { AsaasService } from '../../../core/services/asaas.service';
import { AuthStore } from '../../../core/state/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SubscriptionModalComponent (Checkout de Assinaturas)', () => {
  let component: SubscriptionModalComponent;
  let fixture: ComponentFixture<SubscriptionModalComponent>;
  let mockAsaasService: any;
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
      createCustomer: vi.fn().mockResolvedValue({ id: 'cus_123', name: 'Teste' }),
      createSubscription: vi.fn().mockResolvedValue({ id: 'sub_123', value: 9.90 }),
      getPixQrCodeForPayment: vi.fn().mockResolvedValue({
        encodedImage: 'data:image/png;base64,...',
        payload: '00020126580014br.gov.bcb.pix...',
        expirationDate: '2026-09-08T00:00:00.000Z'
      })
    };

    mockAuthStore = {
      currentUser: signal({
        uid: 'user-123',
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        plan: 'free'
      }),
      updateCurrentUser: vi.fn()
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
    component.customerCpf.set('123.456.789-00');

    await component.generatePixPayment();

    expect(mockAsaasService.createCustomer).toHaveBeenCalled();
    expect(mockAsaasService.createSubscription).toHaveBeenCalled();
    expect(mockAsaasService.getPixQrCodeForPayment).toHaveBeenCalled();
    expect(component.pixGenerated()).toBe(true);
    expect(component.pixPayload()).toContain('br.gov.bcb.pix');
  });

  it('Cenário BDD 4: deve atualizar AuthStore e exibir celebração ao confirmar pagamento', async () => {
    component.goToCheckout();
    component.selectPlan('pro');

    await component.simulatePaymentConfirmation();

    expect(mockAuthStore.updateCurrentUser).toHaveBeenCalledWith({
      plan: 'pro',
      planStatus: 'active'
    });
    expect(component.step()).toBe('success');
    expect(mockNotificationService.success).toHaveBeenCalled();
  });
});
