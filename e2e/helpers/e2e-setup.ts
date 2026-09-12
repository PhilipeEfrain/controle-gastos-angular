import { Page } from '@playwright/test';

export interface MockUserOptions {
  uid?: string;
  email?: string;
  displayName?: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'pro' | 'duo';
  planStatus?: 'active' | 'canceled' | 'past_due';
}

/**
 * Intercepta e bloqueia chamadas de rede para APIs externas do Google, Firebase, AdSense e Analytics.
 * Isso garante custo R$ 0,00 e zero consumo de quotas em nuvem durante a execução dos testes E2E (CARD-055).
 */
export async function setupZeroCostNetworkInterception(page: Page): Promise<void> {
  await page.route('**/*identitytoolkit.googleapis.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*securetoken.googleapis.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*firestore.googleapis.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*pagead2.googlesyndication.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*google-analytics.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*analytics.google.com/**', route => route.abort('blockedbyclient'));
  await page.route('**/*doubleclick.net/**', route => route.abort('blockedbyclient'));
}

/**
 * Configura uma sessão autenticada mockada no localStorage antes da carga da página.
 * Não realiza nenhuma chamada ao Firebase Auth em nuvem.
 */
export async function setupAuthenticatedSession(page: Page, options: MockUserOptions = {}): Promise<void> {
  const user = {
    uid: options.uid || 'e2e-test-user',
    email: options.email || 'e2e@quinzena.app',
    displayName: options.displayName || 'Usuário E2E',
    photoURL: null,
    role: options.role || 'user',
    plan: options.plan || 'free',
    planStatus: options.planStatus || 'active',
    preferences: { theme: 'dark', currency: 'BRL' },
    createdAt: new Date().toISOString()
  };

  await page.addInitScript((mockUser) => {
    try {
      localStorage.setItem('__E2E_AUTH_USER__', JSON.stringify(mockUser));
      localStorage.setItem('cookie_consent_accepted', 'true');
      localStorage.setItem(`onboarding_dismissed_${mockUser.uid}`, 'true');
    } catch {}
  }, user);
}
