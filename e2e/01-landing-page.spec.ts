import { test, expect } from '@playwright/test';
import { setupZeroCostNetworkInterception } from './helpers/e2e-setup';

test.describe('Cenário E2E 1: Descoberta & Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupZeroCostNetworkInterception(page);
    await page.goto('/');
  });

  test('deve renderizar a estrutura completa da Landing Page com proposta de valor', async ({ page }) => {
    // Valida logotipo e cabeçalho
    const header = page.locator('header.landing-header');
    await expect(header).toBeVisible();

    // Valida título do Hero com foco na gestão quinzenal
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('quanto sobra em cada quinzena');

    // Valida mockup visual da quinzena
    const mockupCard = page.locator('.hero-mockup-card');
    await expect(mockupCard).toBeVisible();
    await expect(mockupCard).toContainText('Quinzena 1 (Dia 31)');
    await expect(mockupCard).toContainText('Quinzena 2 (Dia 15)');
  });

  test('deve alternar e abrir itens do FAQ (Perguntas Frequentes)', async ({ page }) => {
    const faqSection = page.locator('#faq');
    await faqSection.scrollIntoViewIfNeeded();
    await expect(faqSection).toBeVisible();

    // Primeiro item de FAQ
    const firstFaqBtn = page.locator('.faq-question-btn').first();
    await expect(firstFaqBtn).toBeVisible();

    // Clica para expandir
    await firstFaqBtn.click();
    const firstFaqAnswer = page.locator('.faq-answer').first();
    await expect(firstFaqAnswer).toBeVisible();
  });

  test('deve exibir banner de cookies LGPD e permitir consentimento', async ({ page }) => {
    const cookieBanner = page.locator('.cookie-banner');
    if (await cookieBanner.isVisible()) {
      const agreeBtn = page.locator('.btn-cookie-agree');
      await expect(agreeBtn).toBeVisible();
      await agreeBtn.click();
      await expect(cookieBanner).not.toBeVisible();
    }
  });

  test('deve redirecionar para /auth ao clicar nos CTAs do Hero', async ({ page }) => {
    // CTA Primário (Começar Grátis)
    const btnHeroCta = page.locator('#btn-hero-cta');
    await expect(btnHeroCta).toBeVisible();
    await btnHeroCta.click();
    await expect(page).toHaveURL(/\/auth\?tab=register/);

    // Volta para home
    await page.goto('/');

    // CTA Secundário (Já tenho uma conta)
    const btnHeroLogin = page.locator('#btn-hero-login');
    await expect(btnHeroLogin).toBeVisible();
    await btnHeroLogin.click();
    await expect(page).toHaveURL(/\/auth\?tab=login/);
  });

  test('deve navegar até os Termos de Uso e Política de Privacidade e permitir voltar', async ({ page }) => {
    // Rola até o rodapé
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();

    // Acessa Termos
    await page.click('a[href="/termos"]');
    await expect(page).toHaveURL('/termos');
    await expect(page.locator('h1.legal-title')).toContainText('Termos de Uso');

    // Clica em voltar para o início
    await page.click('.btn-back-home');
    await expect(page).toHaveURL('/');

    // Acessa Privacidade
    await footer.scrollIntoViewIfNeeded();
    await page.click('a[href="/privacidade"]');
    await expect(page).toHaveURL('/privacidade');
    await expect(page.locator('h1.legal-title')).toContainText('Política de Privacidade');
  });

  test('deve direcionar cards de preços para cadastro com query params do plano selecionado', async ({ page }) => {
    const planosSection = page.locator('#planos');
    await planosSection.scrollIntoViewIfNeeded();

    // Plano PRO
    const btnPlanPro = page.locator('.btn-plan-pro');
    await expect(btnPlanPro).toBeVisible();
    await btnPlanPro.click();
    await expect(page).toHaveURL(/\/auth\?tab=register&plan=pro/);
  });
});
