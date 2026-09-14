import type { Firestore } from 'firebase-admin/firestore';

export interface CreatePixOrderRequest {
  plan: 'pro' | 'duo';
  cycle?: 'MONTHLY' | 'YEARLY';
  cpf: string;
  customValue?: number;
}

export interface CreatePixOrderResponse {
  success: boolean;
  message?: string;
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
  subscriptionId?: string;
  paymentId?: string;
  customerId?: string;
}

export interface PaymentDependencies {
  db: Firestore;
  fetchFn?: typeof fetch;
}

/**
 * Higieniza CPF removendo caracteres não numéricos
 */
function sanitizeCpf(cpf: string): string {
  return (cpf || '').replace(/\D/g, '');
}

/**
 * Validação básica de CPF
 */
function isValidCpf(cpf: string): boolean {
  const clean = sanitizeCpf(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10), 10);
}

/**
 * Retorna preço padrão do plano
 */
function getPlanDefaultPrice(plan: 'pro' | 'duo', cycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'): number {
  if (plan === 'pro') return 9.90;
  if (plan === 'duo') return 19.90;
  return 9.90;
}

/**
 * Processa a criação de assinatura e geração de QR Code PIX diretamente no backend via API v3 do Asaas (sem CORS).
 */
export async function createPixOrderBackend(
  payload: CreatePixOrderRequest,
  callerUid: string,
  deps: PaymentDependencies
): Promise<CreatePixOrderResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const cleanCpf = sanitizeCpf(payload.cpf);
  if (!isValidCpf(cleanCpf)) {
    throw new Error('CPF inválido. Por favor, informe um CPF válido para emissão do PIX.');
  }

  if (payload.plan !== 'pro' && payload.plan !== 'duo') {
    throw new Error('Plano inválido selecionado.');
  }

  const cycle = payload.cycle || 'MONTHLY';
  const price = payload.customValue !== undefined && payload.customValue > 0
    ? payload.customValue
    : getPlanDefaultPrice(payload.plan, cycle);

  const { db } = deps;
  const fetchImpl = deps.fetchFn || fetch;

  // 1. Obter credenciais do Asaas
  const asaasConfigSnap = await db.collection('system_config').doc('asaas').get();
  if (!asaasConfigSnap.exists) {
    throw new Error('Configuração do gateway de pagamentos não encontrada.');
  }

  const asaasConfig = asaasConfigSnap.data();
  const apiKey = (asaasConfig?.apiKey || '').trim();
  const environment = asaasConfig?.environment || 'sandbox';

  if (!apiKey) {
    throw new Error('Chave de API do Asaas não configurada no painel de administração.');
  }

  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  // 2. Obter dados do usuário no Firestore
  const userDocRef = db.collection('users').doc(callerUid);
  const userSnap = await userDocRef.get();
  const userData = userSnap.data() || {};
  const customerName = userData.displayName || 'Usuário Quinzena';
  const customerEmail = userData.email || 'contato@quinzena.com.br';
  let asaasCustomerId = userData.asaasCustomerId;

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };

  // 3. Criar ou validar cliente no Asaas se não existir
  if (!asaasCustomerId) {
    const customerRes = await fetchImpl(`${baseUrl}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: customerName,
        email: customerEmail,
        cpfCnpj: cleanCpf,
        externalReference: callerUid
      })
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok) {
      const errMsg = customerData?.errors?.[0]?.description || customerData?.message || 'Falha ao cadastrar cliente no Asaas.';
      throw new Error(`Erro Asaas (Cliente): ${errMsg}`);
    }

    asaasCustomerId = customerData.id;
    await userDocRef.set({ asaasCustomerId }, { merge: true });
  }

  // 4. Criar Assinatura no Asaas com PIX
  const todayStr = new Date().toISOString().split('T')[0];
  const subscriptionPayload = {
    customer: asaasCustomerId,
    billingType: 'PIX',
    value: price,
    nextDueDate: todayStr,
    cycle,
    description: `Assinatura Quinzena - Plano ${payload.plan.toUpperCase()}`,
    externalReference: callerUid
  };

  const subRes = await fetchImpl(`${baseUrl}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(subscriptionPayload)
  });

  const subData = await subRes.json();
  if (!subRes.ok) {
    const errMsg = subData?.errors?.[0]?.description || subData?.message || 'Falha ao criar assinatura no Asaas.';
    throw new Error(`Erro Asaas (Assinatura): ${errMsg}`);
  }

  const subscriptionId = subData.id;
  await userDocRef.set({ asaasSubscriptionId: subscriptionId }, { merge: true });

  // 5. Obter cobrança gerada para a assinatura
  let paymentId = '';
  // Aguarda até 3 tentativas caso a cobrança esteja sendo gerada assincronamente pelo Asaas
  for (let attempt = 0; attempt < 3; attempt++) {
    const paymentsRes = await fetchImpl(`${baseUrl}/subscriptions/${subscriptionId}/payments`, {
      method: 'GET',
      headers
    });
    if (paymentsRes.ok) {
      const paymentsData = await paymentsRes.json();
      const list = paymentsData?.data || [];
      if (list.length > 0 && list[0].id) {
        paymentId = list[0].id;
        break;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  if (!paymentId) {
    throw new Error('Assinatura criada, mas a cobrança PIX ainda está sendo gerada pelo Asaas. Tente novamente em instantes.');
  }

  // 6. Obter QR Code e chave Copia e Cola do PIX
  const qrRes = await fetchImpl(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
    method: 'GET',
    headers
  });

  const qrData = await qrRes.json();
  if (!qrRes.ok) {
    const errMsg = qrData?.errors?.[0]?.description || qrData?.message || 'Falha ao gerar QR Code PIX.';
    throw new Error(`Erro Asaas (PIX): ${errMsg}. Verifique se você possui uma chave PIX cadastrada na conta do Asaas.`);
  }

  const rawImage = qrData.encodedImage || '';
  const formattedImage = rawImage && !rawImage.startsWith('data:')
    ? `data:image/png;base64,${rawImage}`
    : rawImage;

  return {
    success: true,
    message: 'QR Code PIX gerado com sucesso.',
    encodedImage: formattedImage,
    payload: qrData.payload,
    expirationDate: qrData.expirationDate,
    subscriptionId,
    paymentId,
    customerId: asaasCustomerId
  };
}
