import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TravelComponent } from './travel.component';
import { TravelService } from '../../core/services/travel.service';
import { ExpenseService } from '../../core/services/expense.service';
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
      currentUser: signal<UserProfile | null>(mockUser)
    };

    await TestBed.configureTestingModule({
      imports: [TravelComponent],
      providers: [
        { provide: TravelService, useValue: mockTravelService },
        { provide: ExpenseService, useValue: mockExpenseService },
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
});
