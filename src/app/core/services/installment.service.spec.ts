import { TestBed } from '@angular/core/testing';
import { InstallmentService } from './installment.service';
import { FirebaseService } from './firebase.service';

describe('InstallmentService', () => {
  let service: InstallmentService;

  const mockFirebaseService = {
    firestore: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstallmentService,
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    });
    service = TestBed.inject(InstallmentService);
  });

  it('deve criar o serviço InstallmentService', () => {
    expect(service).toBeTruthy();
  });

  it('deve agrupar corretamente parcelas pelo grupo_parcela_id e calcular saldos e progresso', () => {
    const rawItems = [
      {
        id: 'exp-1',
        mesAno: '2026-09',
        data: {
          descricao: 'Notebook Gamer (1/3)',
          valor: 1000,
          categoria: 'Tecnologia',
          grupo_parcela_id: 'grupo-note',
          parcela_atual: 1,
          total_parcelas: 3,
          status_pagamento: true,
          quinzena: 1,
        },
      },
      {
        id: 'exp-2',
        mesAno: '2026-10',
        data: {
          descricao: 'Notebook Gamer (2/3)',
          valor: 1000,
          categoria: 'Tecnologia',
          grupo_parcela_id: 'grupo-note',
          parcela_atual: 2,
          total_parcelas: 3,
          status_pagamento: false,
          quinzena: 1,
        },
      },
      {
        id: 'exp-3',
        mesAno: '2026-11',
        data: {
          descricao: 'Notebook Gamer (3/3)',
          valor: 1000,
          categoria: 'Tecnologia',
          grupo_parcela_id: 'grupo-note',
          parcela_atual: 3,
          total_parcelas: 3,
          status_pagamento: false,
          quinzena: 1,
        },
      },
    ];

    const groups = service.groupInstallments(rawItems);
    expect(groups.length).toBe(1);

    const group = groups[0];
    expect(group.descricao).toBe('Notebook Gamer');
    expect(group.total_parcelas).toBe(3);
    expect(group.parcelas_pagas).toBe(1);
    expect(group.total_pago).toBe(1000);
    expect(group.saldo_restante).toBe(2000);
    expect(group.valor_total).toBe(3000);
    expect(group.percentual_concluido).toBeCloseTo(33.33, 1);
    expect(group.proximo_vencimento).toBe('2026-10');
    expect(group.parcelas.length).toBe(3);
  });
});
