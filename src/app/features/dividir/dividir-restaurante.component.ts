import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { NotificationService } from '../../core/services/notification.service';
import { formatBRL } from '../../core/utils/formatters';
import {
  calculateRestaurantBill,
  RestaurantParticipant,
  RestaurantBillConfig,
  RestaurantItem,
  PersonDirectConsumption,
  RestaurantBillResult
} from '../../core/utils/restaurant-calculator';

@Component({
  selector: 'app-dividir-restaurante',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  templateUrl: './dividir-restaurante.component.html',
  styleUrls: ['./dividir-restaurante.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DividirRestauranteComponent {
  private notificationService = inject(NotificationService);

  // Participantes
  readonly participants = signal<RestaurantParticipant[]>([
    { id: '1', name: 'Você' },
    { id: '2', name: 'Amigo 1' }
  ]);
  newParticipantName = '';

  // Configuração da Conta
  placeName = '';
  method = signal<'by_item' | 'by_person'>('by_item');
  
  hasServiceFee = signal<boolean>(true);
  serviceFeePercentage = signal<number>(10);
  serviceFeeMode = signal<'proportional' | 'equal'>('proportional');

  hasCouvert = signal<boolean>(false);
  couvertPerPerson = signal<number>(10);

  paidByParticipantId = signal<string>('1');
  payerPixKey = signal<string>('');

  // Itens (Modo 'by_item')
  readonly items = signal<RestaurantItem[]>([]);
  newItemDescription = '';
  newItemPrice: number | null = null;
  newItemParticipantIds = signal<string[]>(['1', '2']);
  readonly hasCopiedWhatsApp = signal<boolean>(false);

  // Prévia em tempo real de quanto fica para cada um ao adicionar o item
  readonly newItemPerPersonPreview = computed<string>(() => {
    const price = this.newItemPrice;
    const count = this.newItemParticipantIds().length;
    if (!price || price <= 0 || count === 0) return '';
    const perPerson = price / count;
    return `${formatBRL(perPerson)} por pessoa (${count} ${count === 1 ? 'selecionado' : 'selecionados'})`;
  });

  // Consumo direto (Modo 'by_person')
  readonly directConsumptions = signal<Record<string, number>>({});
  sharedTableAmount = signal<number>(0);

  // Cálculo reativo da comanda
  readonly billResult = computed<RestaurantBillResult>(() => {
    const parts = this.participants();
    const config: RestaurantBillConfig = {
      method: this.method(),
      serviceFeePercentage: this.hasServiceFee() ? this.serviceFeePercentage() : 0,
      serviceFeeMode: this.hasServiceFee() ? this.serviceFeeMode() : 'none',
      couvertPerPerson: this.hasCouvert() ? this.couvertPerPerson() : 0,
      couvertMode: this.hasCouvert() ? 'per_person' : 'none',
      placeName: this.placeName.trim(),
      paidByParticipantId: this.paidByParticipantId(),
      payerPixKey: this.payerPixKey().trim()
    };

    const directList: PersonDirectConsumption[] = parts.map((p) => ({
      participantId: p.id,
      amount: this.directConsumptions()[p.id] || 0
    }));

    return calculateRestaurantBill(
      parts,
      config,
      this.items(),
      directList,
      this.sharedTableAmount()
    );
  });

  // Participantes
  addParticipant(): void {
    const name = this.newParticipantName.trim();
    if (!name) return;

    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    this.participants.update((list) => [...list, { id: newId, name }]);
    this.newParticipantName = '';

    // Selecionar novo participante por padrão no próximo item
    this.newItemParticipantIds.update((selected) => [...selected, newId]);
  }

  removeParticipant(id: string): void {
    if (this.participants().length <= 1) {
      this.notificationService.show('Mantenha ao menos 1 participante na mesa.', 'warning');
      return;
    }

    this.participants.update((list) => list.filter((p) => p.id !== id));
    this.items.update((list) =>
      list.map((item) => ({
        ...item,
        participantIds: item.participantIds.filter((pid) => pid !== id)
      }))
    );
    this.newItemParticipantIds.update((selected) => selected.filter((pid) => pid !== id));

    if (this.paidByParticipantId() === id) {
      const remaining = this.participants();
      if (remaining.length > 0) {
        this.paidByParticipantId.set(remaining[0].id);
      }
    }
  }

  // Itens
  toggleNewItemParticipant(id: string): void {
    this.newItemParticipantIds.update((selected) => {
      if (selected.includes(id)) {
        return selected.filter((item) => item !== id);
      } else {
        return [...selected, id];
      }
    });
  }

  selectAllForNewItem(): void {
    this.newItemParticipantIds.set(this.participants().map((p) => p.id));
  }

  addItem(): void {
    const desc = this.newItemDescription.trim();
    const price = this.newItemPrice;

    if (!desc) {
      this.notificationService.show('Informe a descrição do item.', 'warning');
      return;
    }
    if (!price || price <= 0) {
      this.notificationService.show('Informe um valor válido para o item.', 'warning');
      return;
    }
    if (this.newItemParticipantIds().length === 0) {
      this.notificationService.show('Selecione quem consumiu este item.', 'warning');
      return;
    }

    const newItem: RestaurantItem = {
      id: Date.now().toString(),
      description: desc,
      price,
      participantIds: [...this.newItemParticipantIds()]
    };

    this.items.update((list) => [newItem, ...list]);
    this.newItemDescription = '';
    this.newItemPrice = null;
    // Mantém todos selecionados para o próximo item
    this.selectAllForNewItem();
  }

  removeItem(id: string): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }

  getParticipantNamesForItem(participantIds: string[]): string {
    const parts = this.participants();
    if (participantIds.length === parts.length) {
      return 'Todos da mesa';
    }
    return parts
      .filter((p) => participantIds.includes(p.id))
      .map((p) => p.name)
      .join(', ');
  }

  // Consumo direto
  updateDirectConsumption(participantId: string, value: string): void {
    const num = parseFloat(value.replace(',', '.')) || 0;
    this.directConsumptions.update((map) => ({
      ...map,
      [participantId]: num
    }));
  }

  getDirectConsumption(participantId: string): number {
    return this.directConsumptions()[participantId] || 0;
  }

  // Ações de compartilhamento
  async copyWhatsAppSummary(): Promise<void> {
    const summary = this.billResult().whatsAppSummaryText;
    if (!summary) {
      this.notificationService.show('Não há dados suficientes para gerar o resumo.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(summary);
      this.hasCopiedWhatsApp.set(true);
      this.notificationService.success('Resumo da conta copiado para a área de transferência!');
      setTimeout(() => {
        this.hasCopiedWhatsApp.set(false);
      }, 2500);
    } catch {
      this.notificationService.show('Não foi possível copiar automaticamente.', 'error');
    }
  }

  openWhatsAppDirectly(): void {
    const summary = this.billResult().whatsAppSummaryText;
    if (!summary) {
      this.notificationService.show('Não há dados suficientes para enviar a conta.', 'warning');
      return;
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(summary)}`;
    window.open(url, '_blank');
  }

  resetAll(): void {
    this.items.set([]);
    this.directConsumptions.set({});
    this.sharedTableAmount.set(0);
    this.placeName = '';
    this.payerPixKey.set('');
    this.notificationService.show('Comanda redefinida.', 'info');
  }

  formatMoney(val: number): string {
    return formatBRL(val);
  }
}
