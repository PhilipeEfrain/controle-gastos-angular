import { test, expect } from '@playwright/test';
import { setupZeroCostNetworkInterception, setupAuthenticatedSession } from './helpers/e2e-setup';

test.describe('Cenário E2E 3: Operação Quinzenal no Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupZeroCostNetworkInterception(page);
    await setupAuthenticatedSession(page, {
      uid: 'e2e-test-user',
      displayName: 'Usuário Quinzenal E2E',
      email: 'e2e@quinzena.app',
      plan: 'free'
    });
    await page.goto('/dashboard');
  });

  test('deve carregar o painel com visão quinzenal e métricas consolidadas', async ({ page }) => {
    await expect(page.locator('.dashboard-wrapper')).toBeVisible();

    // Valida título da aplicação e seletor de mês
    await expect(page.locator('h1.page-title')).toContainText('Quinzena');
    await expect(page.locator('.current-month-display')).toBeVisible();

    // Valida os summary cards
    const summaryCards = page.locator('.summary-cards-grid app-card');
    await expect(summaryCards).toHaveCount(4);

    // Valida presença das 2 quinzenas
    const fortnightCards = page.locator('.fortnights-grid app-fortnight-card');
    await expect(fortnightCards).toHaveCount(2);
  });

  test('deve lançar nova despesa via modal, atualizar tabela e recalcular resumo', async ({ page }) => {
    // Localiza o card da Quinzena 1
    const q1Card = page.locator('.fortnights-grid app-fortnight-card').first();
    await expect(q1Card).toBeVisible();

    // Clica no botão de novo lançamento da Quinzena 1
    const addBtn = q1Card.locator('.add-expense-btn, .empty-add-btn').first();
    await addBtn.click();

    // Modal de lançamento aberto
    const modal = page.locator('app-expense-form-modal [role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toContainText('Nova Despesa');

    // Preenche o formulário
    await modal.locator('#descricao').fill('Internet Fibra');
    await modal.locator('#valor').fill('15000'); // preenche 150,00 via máscara de moeda
    await modal.locator('#categoria').selectOption('Serviços & Assinaturas');

    // Submete o formulário
    const submitBtn = modal.locator('button.btn-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Modal deve ser fechado
    await expect(modal).not.toBeVisible();

    // Despesa deve aparecer no card da Quinzena 1
    const expenseRow = q1Card.locator('[data-testid="expense-row"]').first();
    await expect(expenseRow).toBeVisible();
    await expect(expenseRow.locator('.expense-desc')).toContainText('Internet Fibra');

    // Resumo do topo deve recalcular reativamente
    const totalGastosCard = page.locator('.summary-cards-grid app-card').nth(1);
    await expect(totalGastosCard).toContainText('150,00');

    // Alterna a quitação da despesa (marca como paga)
    const payCheckbox = expenseRow.locator('.pay-checkbox');
    await payCheckbox.click();

    // Linha ganha o estado quitado
    await expect(expenseRow).toHaveClass(/is-paid/);
  });
});
