import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TravelComponent } from './travel.component';
import { TravelService } from '../../core/services/travel.service';
import { ExpenseService } from '../../core/services/expense.service';
import { PlanLimitsService } from '../../core/services/plan-limits.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStore } from '../../core/state/auth.store';
import { UserProfile } from '../../core/models/user.model';
import { TravelTrip } from '../../core/models/finance.model';

describe('TravelComponent', () => {
  let component: TravelComponent;
  let fixture: ComponentFixture<TravelComponent>;

  let mockTravelService: any;
  let mockExpenseService: any;
  let mockNotificationService: any;
  let mockAuthStore: any;

  const mockUser: UserProfile = {
    uid: 'user-travel-1',
    email: 'traveler@finance.com',
    displayName: 'Viajante Pro',
    photoURL: null
  };

  const mockTrips: TravelTrip[] = [
    {
      id: 'trip-1',
      titulo: 'Viagem Litoral',
      destino: 'Ubatuba',
      quantidade_participantes: 4,
      total_gastos: 1200,
      valor_por_pessoa: 300,
      despesas: [
        { id: 'd1', descricao: 'Airbnb', valor: 800, categoria: 'Hospedagem', dividir: true },
        { id: 'd2', descricao: 'Churrasco', valor: 400, categoria: 'Alimentação & Restaurantes', dividir: true }
      ]
    }
  ];

  beforeEach(async () => {
    mockTravelService = {
      getTripsStream: vi.fn(() => of(mockTrips)),
      addTrip: vi.fn().mockResolvedValue('new-trip-id'),
      updateTrip: vi.fn().mockResolvedValue(undefined),
      deleteTrip: vi.fn().mockResolvedValue(undefined),
      addExpenseToTrip: vi.fn().mockResolvedValue(undefined),
      removeExpenseFromTrip: vi.fn().mockResolvedValue(undefined)
    };

    mockExpenseService = {
      addExpense: vi.fn().mockResolvedValue('new-exp-id')
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      currentPlan: signal('free'),
      isProOrDuo: signal(false)
    };

    const mockPlanLimitsService = {
      checkTripLimit: vi.fn().mockReturnValue({
        allowed: true,
        currentCount: 0,
        maxLimit: 1,
        resourceName: 'Viagens & Rateios',
        limitMessage: ''
      })
    };

    await TestBed.configureTestingModule({
      imports: [TravelComponent],
      providers: [
        { provide: TravelService, useValue: mockTravelService },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TravelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente TravelComponent com stream de viagens', () => {
    expect(component).toBeTruthy();
    expect(component.trips().length).toBe(1);
    expect(component.totalViagens()).toBe(1);
  });

  it('Cenário BDD: deve criar uma nova viagem com cálculo de rateio por pessoa', async () => {
    component.openCreateTripModal();
    expect(component.isTripModalOpen()).toBe(true);

    component.tripForm.patchValue({
      titulo: 'Carnaval Salvador',
      destino: 'Salvador - BA',
      quantidade_participantes: 5
    });

    await component.onSaveTrip();

    expect(mockTravelService.addTrip).toHaveBeenCalledWith(
      'user-travel-1',
      expect.objectContaining({
        titulo: 'Carnaval Salvador',
        destino: 'Salvador - BA',
        quantidade_participantes: 5
      })
    );
    expect(mockNotificationService.success).toHaveBeenCalledWith('Nova viagem criada com sucesso!');
  });

  it('Cenário BDD: deve adicionar gasto à viagem', async () => {
    const trip = mockTrips[0];
    component.openAddExpenseModal(trip);

    component.expenseForm.patchValue({
      descricao: 'Passeio de Barco',
      valor: 500,
      categoria: 'Passeios & Ingressos'
    });

    await component.onSaveExpense();

    expect(mockTravelService.addExpenseToTrip).toHaveBeenCalledWith(
      'user-travel-1',
      'trip-1',
      expect.objectContaining({
        descricao: 'Passeio de Barco',
        valor: 500
      }),
      trip
    );
  });

  it('Cenário BDD: deve abrir modal de edição e atualizar gasto existente da viagem', async () => {
    mockTravelService.updateExpenseInTrip = vi.fn().mockResolvedValue(undefined);
    const trip = mockTrips[0];
    const expense = trip.despesas[0]; // 'Airbnb' - R$ 800

    component.openEditExpenseModal(trip, expense);
    expect(component.isExpenseModalOpen()).toBe(true);
    expect(component.expenseToEdit()).toEqual(expense);
    expect(component.expenseForm.value.descricao).toBe('Airbnb');

    component.expenseForm.patchValue({
      descricao: 'Airbnb Atualizado',
      valor: 850
    });

    await component.onSaveExpense();

    expect(mockTravelService.updateExpenseInTrip).toHaveBeenCalledWith(
      'user-travel-1',
      'trip-1',
      expect.objectContaining({
        id: 'd1',
        descricao: 'Airbnb Atualizado',
        valor: 850,
        dividir: true
      }),
      trip
    );
    expect(mockNotificationService.success).toHaveBeenCalledWith('Gasto atualizado com sucesso!');
  });

  it('Cenário BDD: deve permitir cadastrar gasto como individual (não dividir)', async () => {
    const trip = mockTrips[0];
    component.openAddExpenseModal(trip);

    component.expenseForm.patchValue({
      descricao: 'Presente Pessoal',
      valor: 150,
      categoria: 'Compras & Lembranças',
      dividir: false
    });

    await component.onSaveExpense();

    expect(mockTravelService.addExpenseToTrip).toHaveBeenCalledWith(
      'user-travel-1',
      'trip-1',
      expect.objectContaining({
        descricao: 'Presente Pessoal',
        valor: 150,
        dividir: false
      }),
      trip
    );
  });

  it('Cenário BDD: deve importar cota da viagem para o orçamento mensal na Quinzena 2', async () => {
    const trip = mockTrips[0]; // Cota por pessoa: R$ 300,00
    component.openImportModal(trip);

    component.importForm.patchValue({
      mesAno: '2026-09',
      quinzena: 2
    });

    await component.onConfirmImport();

    expect(mockExpenseService.addExpense).toHaveBeenCalledWith(
      'user-travel-1',
      '2026-09',
      expect.objectContaining({
        descricao: 'Viagem: Viagem Litoral (Minha Cota)',
        valor: 300,
        quinzena: 2,
        categoria: 'Lazer & Viagem'
      })
    );
    expect(mockNotificationService.success).toHaveBeenCalled();
  });

  it('Cenário BDD (Feature Gate): DEVE exibir modal de limite ao tentar cadastrar viagem além do limite Free', () => {
    const planLimitsService = TestBed.inject(PlanLimitsService);
    vi.spyOn(planLimitsService, 'checkTripLimit').mockReturnValue({
      allowed: false,
      currentCount: 1,
      maxLimit: 1,
      resourceName: 'Viagens & Rateios',
      limitMessage: 'Você atingiu o limite de 1 viagem cadastrada.'
    });

    component.openCreateTripModal();

    expect(component.isLimitModalOpen()).toBe(true);
    expect(component.isTripModalOpen()).toBe(false);
    expect(component.limitModalMessage()).toContain('limite de 1 viagem');
  });
});
