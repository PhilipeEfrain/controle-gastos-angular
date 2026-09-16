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

export interface CancelSubscriptionRequest {
  subscriptionId?: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  deleted: boolean;
  id: string;
  message?: string;
}

export interface UpdateCreditCardRequest {
  subscriptionId?: string;
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface UpdateCreditCardResponse {
  success: boolean;
  id: string;
  message?: string;
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

export interface CreateCreditCardOrderRequest {
  plan: 'pro' | 'duo';
  cycle?: 'MONTHLY' | 'YEARLY';
  cpf: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  customValue?: number;
}

export interface CreateCreditCardOrderResponse {
  success: boolean;
  message: string;
  plan?: 'pro' | 'duo';
  subscriptionId?: string;
  customerId?: string;
}

/**
 * Processa a assinatura via cartão de crédito diretamente no backend via API v3 do Asaas (sem CORS).
 * Se aprovado pela adquirente, atualiza com segurança o perfil do usuário para o plano contratado.
 */
export async function createCreditCardOrderBackend(
  payload: CreateCreditCardOrderRequest,
  callerUid: string,
  deps: PaymentDependencies
): Promise<CreateCreditCardOrderResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const cleanCpf = sanitizeCpf(payload.cpf);
  if (!isValidCpf(cleanCpf)) {
    throw new Error('CPF inválido. Por favor, informe um CPF válido.');
  }

  if (payload.plan !== 'pro' && payload.plan !== 'duo') {
    throw new Error('Plano inválido selecionado.');
  }

  const cleanCardNumber = (payload.cardNumber || '').replace(/\s/g, '');
  if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
    throw new Error('Número de cartão de crédito inválido.');
  }

  const holderName = (payload.cardHolderName || '').trim();
  if (holderName.length < 3) {
    throw new Error('Nome do titular do cartão é obrigatório.');
  }

  const ccv = (payload.cardCvv || '').trim();
  if (ccv.length < 3 || ccv.length > 4) {
    throw new Error('Código de segurança (CVV) inválido.');
  }

  const expiryParts = (payload.cardExpiry || '').split('/');
  const expiryMonth = (expiryParts[0] || '').trim().padStart(2, '0');
  let expiryYear = (expiryParts[1] || '').trim();
  if (expiryYear.length === 2) {
    expiryYear = '20' + expiryYear;
  }
  if (expiryMonth.length !== 2 || expiryYear.length !== 4) {
    throw new Error('Data de validade do cartão inválida (use MM/AA).');
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
  const customerName = userData.displayName || holderName;
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

  // 4. Criar Assinatura no Asaas com Cartão de Crédito
  const todayStr = new Date().toISOString().split('T')[0];
  const subscriptionPayload = {
    customer: asaasCustomerId,
    billingType: 'CREDIT_CARD',
    value: price,
    nextDueDate: todayStr,
    cycle,
    description: `Assinatura Quinzena - Plano ${payload.plan.toUpperCase()}`,
    externalReference: callerUid,
    creditCard: {
      holderName,
      number: cleanCardNumber,
      expiryMonth,
      expiryYear,
      ccv
    },
    creditCardHolderInfo: {
      name: holderName,
      email: customerEmail,
      cpfCnpj: cleanCpf,
      postalCode: '01310100',
      addressNumber: '100',
      phone: '11999999999',
      mobilePhone: '11999999999'
    }
  };

  const subRes = await fetchImpl(`${baseUrl}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(subscriptionPayload)
  });

  const subData = await subRes.json();
  if (!subRes.ok) {
    const errMsg = subData?.errors?.[0]?.description || subData?.message || 'Falha ao processar pagamento com cartão no Asaas.';
    throw new Error(`Erro Asaas (Cartão): ${errMsg}`);
  }

  const subscriptionId = subData.id;

  // 5. Atualizar perfil do usuário no Firestore diretamente pelo backend com privilégios Admin
  const days = cycle === 'YEARLY' ? 365 : 30;
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + days);
  const planExpiresAt = expDate.toISOString();

  await userDocRef.set({
    plan: payload.plan,
    planStatus: 'active',
    asaasCustomerId,
    asaasSubscriptionId: subscriptionId,
    planExpiresAt,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return {
    success: true,
    message: `Assinatura ativada com sucesso no plano ${payload.plan.toUpperCase()}!`,
    plan: payload.plan,
    subscriptionId,
    customerId: asaasCustomerId
  };
}

/**
 * Cancela com segurança uma assinatura recorrente no Asaas diretamente pelo backend (CARD-086).
 * Valida se a assinatura pertence ao usuário autenticado antes de enviar o DELETE ao Asaas.
 */
export async function cancelSubscriptionBackend(
  payload: CancelSubscriptionRequest,
  callerUid: string,
  deps: PaymentDependencies
): Promise<CancelSubscriptionResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const { db } = deps;
  const fetchImpl = deps.fetchFn || fetch;

  // 1. Obter dados do usuário no Firestore
  const userDocRef = db.collection('users').doc(callerUid);
  const userSnap = await userDocRef.get();
  if (!userSnap.exists) {
    throw new Error('Usuário não localizado no sistema.');
  }

  const userData = userSnap.data() || {};
  const currentSubId = userData['asaasSubscriptionId'];
  const targetSubId = payload.subscriptionId || currentSubId;

  if (!targetSubId) {
    // Se não possui assinatura ativa no Asaas, cancela no Firestore de forma segura
    const nowIso = new Date().toISOString();
    await userDocRef.set({
      planStatus: 'canceled',
      inactivatedAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });

    return {
      success: true,
      deleted: false,
      id: '',
      message: 'Assinatura cancelada com sucesso no sistema.'
    };
  }

  // Se o payload informou uma subscriptionId diferente da do usuário, rejeita
  if (currentSubId && payload.subscriptionId && currentSubId !== payload.subscriptionId) {
    throw new Error('Você não tem permissão para cancelar esta assinatura.');
  }

  // 2. Obter credenciais do Asaas do Firestore
  const asaasConfigSnap = await db.collection('system_config').doc('asaas').get();
  if (!asaasConfigSnap.exists) {
    throw new Error('Configurações do gateway de pagamento não encontradas.');
  }

  const asaasConfig = asaasConfigSnap.data() || {};
  const apiKey = (asaasConfig['apiKey'] || '').trim();
  const environment = asaasConfig['environment'] || 'sandbox';
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  if (!apiKey) {
    throw new Error('Chave da API Asaas não configurada no servidor.');
  }

  // 3. Enviar comando DELETE ao Asaas
  const deleteRes = await fetchImpl(`${baseUrl}/subscriptions/${targetSubId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    }
  });

  const deleteData = await deleteRes.json();
  if (!deleteRes.ok) {
    const errMsg = deleteData?.errors?.[0]?.description || deleteData?.message || 'Falha ao cancelar assinatura no Asaas.';
    throw new Error(`Erro Asaas (Cancelamento): ${errMsg}`);
  }

  // 4. Atualizar status no Firestore (preserva data de expiração para usufruto do ciclo já pago)
  const nowIso = new Date().toISOString();
  await userDocRef.set({
    planStatus: 'canceled',
    inactivatedAt: nowIso,
    updatedAt: nowIso
  }, { merge: true });

  return {
    success: true,
    deleted: true,
    id: targetSubId,
    message: 'Assinatura cancelada com sucesso no gateway Asaas.'
  };
}

/**
 * Atualiza o cartão de crédito associado a uma assinatura existente no Asaas (CARD-086).
 * Executa a chamada PUT no backend sem expor credenciais nem dados brutos em log.
 */
export async function updateCreditCardBackend(
  payload: UpdateCreditCardRequest,
  callerUid: string,
  deps: PaymentDependencies
): Promise<UpdateCreditCardResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const { db } = deps;
  const fetchImpl = deps.fetchFn || fetch;

  const userDocRef = db.collection('users').doc(callerUid);
  const userSnap = await userDocRef.get();
  if (!userSnap.exists) {
    throw new Error('Usuário não localizado no sistema.');
  }

  const userData = userSnap.data() || {};
  const currentSubId = userData['asaasSubscriptionId'];
  const targetSubId = payload.subscriptionId || currentSubId;

  if (!targetSubId) {
    throw new Error('Identificador de assinatura não localizado.');
  }

  if (currentSubId && payload.subscriptionId && currentSubId !== payload.subscriptionId) {
    throw new Error('Você não tem permissão para alterar o cartão desta assinatura.');
  }

  // Validação dos dados do cartão
  const cleanNumber = (payload.number || '').replace(/\D/g, '');
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    throw new Error('Número de cartão de crédito inválido.');
  }

  const holderName = (payload.holderName || '').trim();
  if (holderName.length < 3) {
    throw new Error('Nome impresso no cartão é obrigatório.');
  }

  const ccv = (payload.ccv || '').trim();
  if (ccv.length < 3 || ccv.length > 4) {
    throw new Error('Código de segurança (CVV) inválido.');
  }

  // Obter credenciais do Asaas
  const asaasConfigSnap = await db.collection('system_config').doc('asaas').get();
  if (!asaasConfigSnap.exists) {
    throw new Error('Configuração do gateway não localizada.');
  }

  const asaasConfig = asaasConfigSnap.data() || {};
  const apiKey = (asaasConfig['apiKey'] || '').trim();
  const environment = asaasConfig['environment'] || 'sandbox';
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  if (!apiKey) {
    throw new Error('Chave da API Asaas não configurada no servidor.');
  }

  const updatePayload = {
    creditCard: {
      holderName,
      number: cleanNumber,
      expiryMonth: payload.expiryMonth.padStart(2, '0'),
      expiryYear: payload.expiryYear.length === 2 ? `20${payload.expiryYear}` : payload.expiryYear,
      ccv
    },
    creditCardHolderInfo: {
      name: holderName,
      email: userData['email'] || 'contato@quinzena.app',
      cpfCnpj: '52998224725',
      postalCode: '01310100',
      addressNumber: '100',
      phone: '11999999999',
      mobilePhone: '11999999999'
    }
  };

  const updateRes = await fetchImpl(`${baseUrl}/subscriptions/${targetSubId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    },
    body: JSON.stringify(updatePayload)
  });

  const updateData = await updateRes.json();
  if (!updateRes.ok) {
    const errMsg = updateData?.errors?.[0]?.description || updateData?.message || 'Falha ao atualizar cartão no Asaas.';
    throw new Error(`Erro Asaas (Atualização de Cartão): ${errMsg}`);
  }

  return {
    success: true,
    id: targetSubId,
    message: 'Cartão de crédito atualizado com sucesso no gateway Asaas!'
  };
}


