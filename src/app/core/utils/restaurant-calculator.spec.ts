import { describe, it, expect } from 'vitest';
import {
  calculateRestaurantBill,
  RestaurantParticipant,
  RestaurantBillConfig,
  RestaurantItem,
  PersonDirectConsumption
} from './restaurant-calculator';

describe('Restaurant Calculator (Dividir Restaurante)', () => {
  const participants: RestaurantParticipant[] = [
    { id: 'p1', name: 'Ana', pixKey: 'ana@pix.com' },
    { id: 'p2', name: 'Bruno' },
    { id: 'p3', name: 'Carlos' }
  ];

  it('deve retornar valores zerados se não houver participantes', () => {
    const config: RestaurantBillConfig = {
      method: 'by_item',
      serviceFeePercentage: 10,
      serviceFeeMode: 'proportional',
      couvertPerPerson: 0,
      couvertMode: 'none',
      placeName: 'Bar Teste',
      paidByParticipantId: 'p1'
    };

    const res = calculateRestaurantBill([], config);
    expect(res.grandTotal).toBe(0);
    expect(res.participantsBreakdown).toHaveLength(0);
  });

  it('deve calcular divisão por itens com taxa proporcional de 10%', () => {
    const items: RestaurantItem[] = [
      { id: 'i1', description: 'Hambúrguer', price: 50.0, participantIds: ['p1'] },
      { id: 'i2', description: 'Porção Batata', price: 30.0, participantIds: ['p1', 'p2'] }, // 15 cada
      { id: 'i3', description: 'Chopp', price: 20.0, participantIds: ['p3'] }
    ];

    const config: RestaurantBillConfig = {
      method: 'by_item',
      serviceFeePercentage: 10,
      serviceFeeMode: 'proportional',
      couvertPerPerson: 0,
      couvertMode: 'none',
      placeName: 'Burger House',
      paidByParticipantId: 'p1',
      payerPixKey: 'ana@pix.com'
    };

    const res = calculateRestaurantBill(participants, config, items);

    // Subtotal: 50 + 30 + 20 = 100
    expect(res.subtotalItems).toBe(100.0);
    // Taxa 10%: 10
    expect(res.totalServiceFee).toBe(10.0);
    expect(res.grandTotal).toBe(110.0);

    // p1: 50 + 15 = 65. 10% = 6.50. Total = 71.50
    const ana = res.participantsBreakdown.find((p) => p.participantId === 'p1');
    expect(ana?.baseConsumption).toBe(65.0);
    expect(ana?.serviceFeeShare).toBe(6.5);
    expect(ana?.totalToPay).toBe(71.5);

    // p2: 15. 10% = 1.50. Total = 16.50
    const bruno = res.participantsBreakdown.find((p) => p.participantId === 'p2');
    expect(bruno?.baseConsumption).toBe(15.0);
    expect(bruno?.serviceFeeShare).toBe(1.5);
    expect(bruno?.totalToPay).toBe(16.5);

    // p3: 20. 10% = 2.00. Total = 22.00
    const carlos = res.participantsBreakdown.find((p) => p.participantId === 'p3');
    expect(carlos?.baseConsumption).toBe(20.0);
    expect(carlos?.serviceFeeShare).toBe(2.0);
    expect(carlos?.totalToPay).toBe(22.0);

    // Soma individual deve bater exatamente com grandTotal
    const sum = res.participantsBreakdown.reduce((acc, p) => acc + p.totalToPay, 0);
    expect(sum).toBeCloseTo(110.0, 2);

    expect(res.whatsAppSummaryText).toContain('Burger House');
    expect(res.whatsAppSummaryText).toContain('ana@pix.com');
  });

  it('deve incluir couvert artístico por pessoa', () => {
    const directConsumptions: PersonDirectConsumption[] = [
      { participantId: 'p1', amount: 40.0 },
      { participantId: 'p2', amount: 60.0 }
    ];

    const twoParticipants = [participants[0], participants[1]];

    const config: RestaurantBillConfig = {
      method: 'by_person',
      serviceFeePercentage: 10,
      serviceFeeMode: 'equal',
      couvertPerPerson: 15.0, // R$ 15 por pessoa
      couvertMode: 'per_person',
      placeName: 'Pub com Música',
      paidByParticipantId: 'p1'
    };

    const res = calculateRestaurantBill(twoParticipants, config, [], directConsumptions, 20.0);

    // Subtotal itens: 40 + 60 + 20 (compartilhado) = 120.00
    expect(res.subtotalItems).toBe(120.0);
    // Taxa 10%: 12.00 (rateado igual: 6.00 para cada)
    expect(res.totalServiceFee).toBe(12.0);
    // Couvert: 15 * 2 = 30.00
    expect(res.totalCouvert).toBe(30.0);
    // Total Geral: 120 + 12 + 30 = 162.00
    expect(res.grandTotal).toBe(162.0);

    const ana = res.participantsBreakdown.find((p) => p.participantId === 'p1');
    expect(ana?.baseConsumption).toBe(50.0);
    expect(ana?.serviceFeeShare).toBe(6.0);
    expect(ana?.couvertShare).toBe(15.0);
    expect(ana?.totalToPay).toBe(71.0);

    const bruno = res.participantsBreakdown.find((p) => p.participantId === 'p2');
    expect(bruno?.baseConsumption).toBe(70.0);
    expect(bruno?.serviceFeeShare).toBe(6.0);
    expect(bruno?.couvertShare).toBe(15.0);
    expect(bruno?.totalToPay).toBe(91.0);

    expect(ana!.totalToPay + bruno!.totalToPay).toBe(162.0);
  });
});
