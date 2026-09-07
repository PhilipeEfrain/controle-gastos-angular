import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { TravelService } from '../../core/services/travel.service';
import { ExpenseService } from '../../core/services/expense.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStore } from '../../core/state/auth.store';
import {
  TravelTrip,
  TravelExpenseItem,
  FortnightNumber,
  Expense
} from '../../core/models/finance.model';
import { formatBRL } from '../../core/utils/formatters';
import { roundBRL } from '../../core/utils/calculations';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-travel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppCardComponent,
    ConfirmationModalComponent
  ],
  templateUrl: './travel.component.html',
  styleUrls: ['./travel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private travelService = inject(TravelService);
  private expenseService = inject(ExpenseService);
  private notificationService = inject(NotificationService);
  readonly authStore = inject(AuthStore);

  readonly trips = signal<TravelTrip[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly selectedTrip = signal<TravelTrip | null>(null);

  // Modais de Controle
  readonly isTripModalOpen = signal<boolean>(false);
  readonly tripToEdit = signal<TravelTrip | null>(null);

  readonly isExpenseModalOpen = signal<boolean>(false);
  readonly targetTripForExpense = signal<TravelTrip | null>(null);

  readonly isImportModalOpen = signal<boolean>(false);
  readonly tripToImport = signal<TravelTrip | null>(null);

  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly tripToDelete = signal<TravelTrip | null>(null);

  private tripsSub?: Subscription;

  // Formulário de Viagem
  tripForm: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(80)]],
    destino: [''],
    data_inicio: [''],
    data_fim: [''],
    quantidade_participantes: [2, [Validators.required, Validators.min(1), Validators.max(50)]]
  });

  // Formulário de Despesa da Viagem
  expenseForm: FormGroup = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(100)]],
    valor: [null, [Validators.required, Validators.min(0.01)]],
    categoria: ['Hospedagem', [Validators.required]]
  });

  // Formulário de Importação para o Orçamento Mensal
  importForm: FormGroup = this.fb.group({
    mesAno: ['', [Validators.required]],
    quinzena: [1, [Validators.required]]
  });

  readonly categories = [
    'Hospedagem',
    'Transporte & Combustível',
    'Alimentação & Restaurantes',
    'Passeios & Ingressos',
    'Compras & Lembranças',
    'Emergências & Outros'
  ];

  // Totais Gerais Computados
  readonly totalViagens = computed(() => this.trips().length);
  readonly totalGastoGeral = computed(() => {
    const sum = this.trips().reduce((acc, t) => acc + (t.total_gastos || 0), 0);
    return formatBRL(roundBRL(sum));
  });

  ngOnInit(): void {
    const user = this.authStore.currentUser();
    if (user) {
      this.initTripsStream(user.uid);
    }
  }

  ngOnDestroy(): void {
    this.tripsSub?.unsubscribe();
  }

  private initTripsStream(userId: string): void {
    this.isLoading.set(true);
    this.tripsSub = this.travelService.getTripsStream(userId).subscribe({
      next: data => {
        this.trips.set(data);
        this.isLoading.set(false);
        // Atualiza a viagem selecionada se existir
        if (this.selectedTrip()) {
          const updated = data.find(t => t.id === this.selectedTrip()?.id);
          this.selectedTrip.set(updated || null);
        }
      },
      error: () => {
        this.notificationService.error('Erro ao carregar lista de viagens.');
        this.isLoading.set(false);
      }
    });
  }

  selectTrip(trip: TravelTrip): void {
    if (this.selectedTrip()?.id === trip.id) {
      this.selectedTrip.set(null);
    } else {
      this.selectedTrip.set(trip);
    }
  }

  // --- Modal Viagem (Criar / Editar) ---
  openCreateTripModal(): void {
    this.tripToEdit.set(null);
    this.tripForm.reset({
      titulo: '',
      destino: '',
      data_inicio: '',
      data_fim: '',
      quantidade_participantes: 2
    });
    this.isTripModalOpen.set(true);
  }

  openEditTripModal(trip: TravelTrip, event?: Event): void {
    if (event) event.stopPropagation();
    this.tripToEdit.set(trip);
    this.tripForm.patchValue({
      titulo: trip.titulo,
      destino: trip.destino || '',
      data_inicio: trip.data_inicio || '',
      data_fim: trip.data_fim || '',
      quantidade_participantes: trip.quantidade_participantes
    });
    this.isTripModalOpen.set(true);
  }

  async onSaveTrip(): Promise<void> {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) return;

    const val = this.tripForm.value;
    const editing = this.tripToEdit();

    try {
      if (editing && editing.id) {
        await this.travelService.updateTrip(user.uid, editing.id, {
          titulo: val.titulo.trim(),
          destino: val.destino?.trim() || '',
          data_inicio: val.data_inicio || '',
          data_fim: val.data_fim || '',
          quantidade_participantes: Number(val.quantidade_participantes)
        });
        this.notificationService.success('Viagem atualizada com sucesso!');
      } else {
        await this.travelService.addTrip(user.uid, {
          titulo: val.titulo.trim(),
          destino: val.destino?.trim() || '',
          data_inicio: val.data_inicio || '',
          data_fim: val.data_fim || '',
          quantidade_participantes: Number(val.quantidade_participantes),
          despesas: [],
          total_gastos: 0,
          valor_por_pessoa: 0
        });
        this.notificationService.success('Nova viagem criada com sucesso!');
      }
      this.isTripModalOpen.set(false);
    } catch (err: any) {
      console.error('[TravelComponent] Erro ao salvar viagem:', err);
      this.notificationService.error('Erro ao salvar informações da viagem: ' + (err.message || 'Tente novamente.'));
    }
  }

  // --- Modal Despesa de Viagem ---
  openAddExpenseModal(trip: TravelTrip, event?: Event): void {
    if (event) event.stopPropagation();
    this.targetTripForExpense.set(trip);
    this.expenseForm.reset({
      descricao: '',
      valor: null,
      categoria: 'Hospedagem'
    });
    this.isExpenseModalOpen.set(true);
  }

  async onSaveExpense(): Promise<void> {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    const trip = this.targetTripForExpense();
    if (!user || !trip || !trip.id) return;

    const val = this.expenseForm.value;
    const item: TravelExpenseItem = {
      descricao: val.descricao.trim(),
      valor: parseFloat(val.valor),
      categoria: val.categoria,
      dividir: true
    };

    try {
      await this.travelService.addExpenseToTrip(user.uid, trip.id, item, trip);
      this.notificationService.success('Gasto adicionado à viagem!');
      this.isExpenseModalOpen.set(false);
    } catch (err: any) {
      console.error('[TravelComponent] Erro ao adicionar gasto:', err);
      this.notificationService.error('Erro ao adicionar gasto: ' + (err.message || 'Tente novamente.'));
    }
  }

  async onDeleteExpense(trip: TravelTrip, expenseId: string, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const user = this.authStore.currentUser();
    if (!user || !trip.id) return;

    try {
      await this.travelService.removeExpenseFromTrip(user.uid, trip.id, expenseId, trip);
      this.notificationService.info('Gasto removido da viagem.');
    } catch (err: any) {
      console.error('[TravelComponent] Erro ao remover gasto:', err);
      this.notificationService.error('Erro ao remover gasto: ' + (err.message || 'Tente novamente.'));
    }
  }

  // --- Modal Importação para o Orçamento Quinzenal ---
  openImportModal(trip: TravelTrip, event?: Event): void {
    if (event) event.stopPropagation();
    this.tripToImport.set(trip);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.importForm.reset({
      mesAno: currentMonth,
      quinzena: 2
    });
    this.isImportModalOpen.set(true);
  }

  async onConfirmImport(): Promise<void> {
    if (this.importForm.invalid) return;
    const user = this.authStore.currentUser();
    const trip = this.tripToImport();
    if (!user || !trip) return;

    const val = this.importForm.value;
    const mesAno = val.mesAno;
    const quinzena = Number(val.quinzena) as FortnightNumber;
    const valorCota = trip.valor_por_pessoa || 0;

    if (valorCota <= 0) {
      this.notificationService.warning('Esta viagem não possui gastos para rateio.');
      return;
    }

    const expensePayload: Expense = {
      descricao: `Viagem: ${trip.titulo} (Minha Cota)`,
      valor: valorCota,
      quinzena,
      categoria: 'Lazer & Viagem',
      status_pagamento: false
    };

    try {
      await this.expenseService.addExpense(user.uid, mesAno, expensePayload);
      this.notificationService.success(
        `Cota individual de ${formatBRL(valorCota)} lançada na ${quinzena}ª Quinzena (${mesAno})!`
      );
      this.isImportModalOpen.set(false);
    } catch {
      this.notificationService.error('Erro ao lançar cota no orçamento mensal.');
    }
  }

  // --- Exclusão de Viagem ---
  openDeleteModal(trip: TravelTrip, event?: Event): void {
    if (event) event.stopPropagation();
    this.tripToDelete.set(trip);
    this.isDeleteModalOpen.set(true);
  }

  async onConfirmDelete(): Promise<void> {
    const user = this.authStore.currentUser();
    const trip = this.tripToDelete();
    if (!user || !trip || !trip.id) return;

    try {
      await this.travelService.deleteTrip(user.uid, trip.id);
      this.notificationService.info(`Viagem "${trip.titulo}" excluída.`);
      if (this.selectedTrip()?.id === trip.id) {
        this.selectedTrip.set(null);
      }
      this.isDeleteModalOpen.set(false);
    } catch {
      this.notificationService.error('Erro ao excluir viagem.');
    }
  }

  formatCurrency(value: number): string {
    return formatBRL(value);
  }
}
