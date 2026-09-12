import { test, expect } from '@playwright/test';
import { setupZeroCostNetworkInterception } from './helpers/e2e-setup';

test.describe('Cenário E2E 2: Autenticação & Route Guards', () => {
  test.beforeEach(async ({ page }) => {
    await setupZeroCostNetworkInterception(page);
  });

  test('deve bloquear acesso não autenticado a /dashboard e redirecionar para /auth preservando returnUrl', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\?returnUrl=%2Fdashboard/);
    await expect(page.locator('.auth-page')).toBeVisible();
  });

  test('deve bloquear acesso não autenticado a /tributos e redirecionar para /auth', async ({ page }) => {
    await page.goto('/tributos');
    await expect(page).toHaveURL(/\/auth\?returnUrl=%2Ftributos/);
  });

  test('deve alternar entre as abas Entrar e Criar Conta', async ({ page }) => {
    await page.goto('/auth');

    // Aba Entrar ativa por padrão
    const loginEmailInput = page.locator('#login-email');
    await expect(loginEmailInput).toBeVisible();

    // Alterna para Criar Conta
    await page.click('button.auth-tab:has-text("Criar Conta")');
    const registerNameInput = page.locator('#register-name');
    await expect(registerNameInput).toBeVisible();

    // Alterna de volta para Entrar
    await page.click('button.auth-tab:has-text("Entrar")');
    await expect(loginEmailInput).toBeVisible();
  });

  test('deve alternar para recuperação de senha e retornar para login', async ({ page }) => {
    await page.goto('/auth');

    // Clica em esqueci minha senha
    await page.click('.form-forgot-link');
    await expect(page.locator('.auth-form-title')).toContainText('Recuperar Senha');
    await expect(page.locator('#forgot-email')).toBeVisible();

    // Clica em voltar para o login
    await page.click('.back-link');
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('deve exibir validação de campos no formulário de login', async ({ page }) => {
    await page.goto('/auth');

    const emailInput = page.locator('#login-email');
    const passwordInput = page.locator('#login-password');

    // Toca e sai do campo sem preencher para disparar touched
    await emailInput.focus();
    await emailInput.blur();
    await expect(page.locator('.form-error')).toContainText('Informe um e-mail válido');

    // Preenche formato inválido
    await emailInput.fill('email-invalido');
    await emailInput.blur();
    await expect(page.locator('.form-error')).toContainText('Informe um e-mail válido');

    // Senha com menos de 6 caracteres
    await passwordInput.fill('123');
    await passwordInput.blur();
    await expect(page.locator('.form-error').filter({ hasText: 'pelo menos 6 caracteres' })).toBeVisible();
  });

  test('deve exibir alerta de erro ao submeter credenciais incorretas', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('#login-email', 'invalido@quinzena.app');
    await page.fill('#login-password', 'errada123');
    await page.click('button[type="submit"]');

    const alertDanger = page.locator('.auth-alert--danger');
    await expect(alertDanger).toBeVisible();
    await expect(alertDanger).toContainText('E-mail ou senha incorretos');
  });

  test('deve autenticar com sucesso e redirecionar para /dashboard', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('#login-email', 'e2e@quinzena.app');
    await page.fill('#login-password', 'senha123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.dashboard-wrapper')).toBeVisible();
  });
});
