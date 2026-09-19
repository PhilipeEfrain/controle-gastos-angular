import { formatBRL } from './formatters';

export interface RestaurantParticipant {
  id: string;
  name: string;
  pixKey?: string;
}

export interface RestaurantItem {
  id: string;
  description: string;
  price: number;
  participantIds: string[];
}

export interface PersonDirectConsumption {
  participantId: string;
  amount: number;
}

export interface RestaurantBillConfig {
  method: 'by_item' | 'by_person';
  serviceFeePercentage: number; // ex: 10 para 10%
  serviceFeeMode: 'proportional' | 'equal' | 'none';
  couvertPerPerson: number; // valor por cabeça
  couvertMode: 'per_person' | 'none';
  placeName: string; // Ex: "Outback", "Bar do Zé"
  paidByParticipantId: string;
  payerPixKey?: string;
}

export interface PersonBillSummary {
  participantId: string;
  name: string;
  baseConsumption: number;
  serviceFeeShare: number;
  couvertShare: number;
  totalToPay: number;
}

export interface RestaurantBillResult {
  subtotalItems: number;
  totalServiceFee: number;
  totalCouvert: number;
  grandTotal: number;
  participantsBreakdown: PersonBillSummary[];
  whatsAppSummaryText: string;
}

/**
 * Calcula o fechamento da conta do restaurante com ajuste de centavos e rateio de taxas.
 */
export function calculateRestaurantBill(
  participants: RestaurantParticipant[],
  config: RestaurantBillConfig,
  items: RestaurantItem[] = [],
  directConsumptions: PersonDirectConsumption[] = [],
  sharedTableAmount: number = 0
): RestaurantBillResult {
  if (participants.length === 0) {
    return {
      subtotalItems: 0,
      totalServiceFee: 0,
      totalCouvert: 0,
      grandTotal: 0,
      participantsBreakdown: [],
      whatsAppSummaryText: ''
    };
  }

  const baseConsumptionCentsMap = new Map<string, number>();
  participants.forEach((p) => baseConsumptionCentsMap.set(p.id, 0));

  let subtotalItemsCents = 0;

  if (config.method === 'by_item') {
    // Método Por Itens
    for (const item of items) {
      if (!item.participantIds.length || item.price <= 0) continue;
      const itemCents = Math.round(item.price * 100);
      subtotalItemsCents += itemCents;

      const count = item.participantIds.length;
      const baseShare = Math.floor(itemCents / count);
      let rem = itemCents % count;

      for (const pid of item.participantIds) {
        const share = baseShare + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        const cur = baseConsumptionCentsMap.get(pid) || 0;
        baseConsumptionCentsMap.set(pid, cur + share);
      }
    }
  } else {
    // Método Por Pessoa (Consumo Direto)
    for (const dc of directConsumptions) {
      const cents = Math.round((dc.amount || 0) * 100);
      subtotalItemsCents += cents;
      const cur = baseConsumptionCentsMap.get(dc.participantId) || 0;
      baseConsumptionCentsMap.set(dc.participantId, cur + cents);
    }

    // Itens compartilhados da mesa divididos igualmente
    if (sharedTableAmount > 0) {
      const sharedCents = Math.round(sharedTableAmount * 100);
      subtotalItemsCents += sharedCents;
      const count = participants.length;
      const baseShare = Math.floor(sharedCents / count);
      let rem = sharedCents % count;

      for (const p of participants) {
        const share = baseShare + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        const cur = baseConsumptionCentsMap.get(p.id) || 0;
        baseConsumptionCentsMap.set(p.id, cur + share);
      }
    }
  }

  // 1. Cálculo da Taxa de Serviço
  let totalServiceFeeCents = 0;
  const serviceFeeCentsMap = new Map<string, number>();
  participants.forEach((p) => serviceFeeCentsMap.set(p.id, 0));

  if (config.serviceFeeMode !== 'none' && config.serviceFeePercentage > 0 && subtotalItemsCents > 0) {
    totalServiceFeeCents = Math.round((subtotalItemsCents * config.serviceFeePercentage) / 100);

    if (config.serviceFeeMode === 'proportional') {
      // Rateio proporcional ao consumo base
      let feeDistributed = 0;
      for (const p of participants) {
        const pConsumption = baseConsumptionCentsMap.get(p.id) || 0;
        if (subtotalItemsCents > 0) {
          const pFee = Math.round((pConsumption * config.serviceFeePercentage) / 100);
          serviceFeeCentsMap.set(p.id, pFee);
          feeDistributed += pFee;
        }
      }
      // Ajuste de centavo residual na maior taxa
      const diff = totalServiceFeeCents - feeDistributed;
      if (diff !== 0 && participants.length > 0) {
        const firstPid = participants[0].id;
        serviceFeeCentsMap.set(firstPid, (serviceFeeCentsMap.get(firstPid) || 0) + diff);
      }
    } else {
      // Rateio igualitário da taxa
      const count = participants.length;
      const baseFee = Math.floor(totalServiceFeeCents / count);
      let rem = totalServiceFeeCents % count;

      for (const p of participants) {
        const fee = baseFee + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        serviceFeeCentsMap.set(p.id, fee);
      }
    }
  }

  // 2. Cálculo do Couvert Artístico
  let totalCouvertCents = 0;
  const couvertCentsMap = new Map<string, number>();
  participants.forEach((p) => couvertCentsMap.set(p.id, 0));

  if (config.couvertMode === 'per_person' && config.couvertPerPerson > 0) {
    const couvertPerPersonCents = Math.round(config.couvertPerPerson * 100);
    for (const p of participants) {
      couvertCentsMap.set(p.id, couvertPerPersonCents);
      totalCouvertCents += couvertPerPersonCents;
    }
  }

  // 3. Montagem do Balanço Consolidado por Pessoa
  let grandTotalCents = 0;
  const breakdown: PersonBillSummary[] = participants.map((p) => {
    const baseCents = baseConsumptionCentsMap.get(p.id) || 0;
    const feeCents = serviceFeeCentsMap.get(p.id) || 0;
    const couCents = couvertCentsMap.get(p.id) || 0;
    const totalPersonCents = baseCents + feeCents + couCents;
    grandTotalCents += totalPersonCents;

    return {
      participantId: p.id,
      name: p.name,
      baseConsumption: baseCents / 100,
      serviceFeeShare: feeCents / 100,
      couvertShare: couCents / 100,
      totalToPay: totalPersonCents / 100
    };
  });

  // 4. Geração do Texto de WhatsApp da Mesa
  const payer = participants.find((p) => p.id === config.paidByParticipantId);
  const payerName = payer ? payer.name : 'o pagador';
  const pixInfo = config.payerPixKey ? `👉 Chave PIX (${payerName}): *${config.payerPixKey}*` : '';

  const participantsLines = breakdown
    .map((b) => `👤 *${b.name}*: ${formatBRL(b.totalToPay)}`)
    .join('\n');

  const placeTitle = config.placeName ? `🍽️ *Conta — ${config.placeName}*` : '🍽️ *Conta do Restaurante*';

  const whatsAppSummaryText = [
    placeTitle,
    `Total: *${formatBRL(grandTotalCents / 100)}* (comanda fechada)`,
    '',
    '📋 *Valores individuais:*',
    participantsLines,
    '',
    pixInfo,
    'Fechado pelo Quinzena Dividir ⚡'
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subtotalItems: subtotalItemsCents / 100,
    totalServiceFee: totalServiceFeeCents / 100,
    totalCouvert: totalCouvertCents / 100,
    grandTotal: grandTotalCents / 100,
    participantsBreakdown: breakdown,
    whatsAppSummaryText
  };
}
