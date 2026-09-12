import { test, expect } from '@playwright/test';
import { setupZeroCostNetworkInterception, setupAuthenticatedSession } from './helpers/e2e-setup';

test.describe('Cenário E2E 4: Fluxo de Upgrade PRO e Assinatura', () => {
  test.beforeEach(async ({ page }) => {
    await setupZeroCostNetworkInterception(page);
    await setupAuthenticatedSession(page, {
      uid: 'e2e-test-user',
      displayName: 'Usuário Free E2E',
      email: 'free@quinzena.app',
      plan: 'free'
    });
    await page.goto('/dashboard');
  });

  test('deve abrir modal de assinatura a partir do banner do topo e navegar pelas etapas de contratação', async ({ page }) => {
    // Localiza o banner de anúncio/upgrade do topo
    const adBanner = page.locator('app-ad-banner');
    await expect(adBanner).toBeVisible();

    const btnUpgrade = adBanner.locator('.btn-ad-upgrade, .btn-fallback-upgrade').first();
    await btnUpgrade.click();

    // Modal de assinatura aberto
    const subModal = page.locator('app-subscription-modal [role="dialog"]');
    await expect(subModal).toBeVisible();

    // Valida cards dos planos PRO e DUO
    const cardPro = subModal.locator('#card-plan-pro');
    const cardDuo = subModal.locator('#card-plan-duo');
    await expect(cardPro).toBeVisible();
    await expect(cardDuo).toBeVisible();
    await expect(cardPro).toContainText('9,90');
    await expect(cardDuo).toContainText('19,90');

    // Seleciona o plano PRO e avança para checkout
    const btnSelectPro = cardPro.locator('.btn-select-plan');
    await btnSelectPro.click();

    // Tela de checkout
    await expect(subModal.locator('.dialog-title')).toContainText('Finalizar Assinatura');
    await expect(subModal.locator('#tab-pix')).toBeVisible();
    await expect(subModal.locator('#tab-card')).toBeVisible();

    // Testa geração de PIX com CPF válido formatado
    const inputCpf = subModal.locator('#input-pix-cpf');
    await inputCpf.fill('52998224725');

    const btnGeneratePix = subModal.locator('#btn-generate-pix');
    await expect(btnGeneratePix).toBeEnabled();
    await btnGeneratePix.click();

    // Valida exibição do QR code e dados para cópia
    await expect(subModal.locator('.pix-qr-container')).toBeVisible();
    await expect(subModal.locator('#input-pix-code')).toBeVisible();

    // Simula confirmação de pagamento
    const btnConfirm = subModal.locator('#btn-confirm-pix-paid');
    await expect(btnConfirm).toBeVisible();
    await btnConfirm.click();

    // Valida tela de celebração
    const successView = subModal.locator('.success-view');
    await expect(successView).toBeVisible();
    await expect(successView).toContainText('Parabéns! Você agora é PRO!');

    // Fecha modal
    const btnEnjoy = subModal.locator('#btn-enjoy-pro');
    await btnEnjoy.click();
    await expect(subModal).not.toBeVisible();
  });

  test('deve permitir alternar para método de pagamento Cartão de Crédito e validar campos', async ({ page }) => {
    // Abre modal diretamente via chamada do banner
    const btnUpgrade = page.locator('.btn-ad-upgrade, .btn-fallback-upgrade').first();
    await btnUpgrade.click();

    const subModal = page.locator('app-subscription-modal [role="dialog"]');
    await subModal.locator('#card-plan-pro .btn-select-plan').click();

    // Alterna para aba Cartão de Crédito
    await subModal.locator('#tab-card').click();
    const cardView = subModal.locator('.card-checkout-view');
    await expect(cardView).toBeVisible();

    // Botão de assinar deve iniciar desabilitado
    const btnPayCard = subModal.locator('#btn-submit-card');
    await expect(btnPayCard).toBeDisabled();
  });
});
