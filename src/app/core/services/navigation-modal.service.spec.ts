import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavigationModalService } from './navigation-modal.service';

describe('NavigationModalService', () => {
  let service: NavigationModalService;
  let mockRouter: {
    url: string;
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRouter = {
      url: '/dashboard',
      navigate: vi.fn().mockResolvedValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        NavigationModalService,
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(NavigationModalService);
  });

  it('deve inicializar com todos os modais fechados', () => {
    expect(service.activeModal()).toBeNull();
    expect(service.isCaixinhaOpen()).toBe(false);
    expect(service.isExportOpen()).toBe(false);
    expect(service.isNewExpenseOpen()).toBe(false);
  });

  it('deve abrir a caixinha diretamente quando estiver no dashboard', async () => {
    mockRouter.url = '/dashboard';
    await service.openCaixinha();

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(service.activeModal()).toBe('caixinha');
    expect(service.isCaixinhaOpen()).toBe(true);
  });

  it('deve redirecionar para dashboard com queryParams se estiver fora do dashboard ao abrir caixinha', async () => {
    mockRouter.url = '/parcelamentos';
    await service.openCaixinha();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: { action: 'caixinha' } });
    expect(service.isCaixinhaOpen()).toBe(true);
  });

  it('deve fechar a caixinha corretamente', () => {
    service.isCaixinhaOpen.set(true);
    service.activeModal.set('caixinha');

    service.closeCaixinha();

    expect(service.isCaixinhaOpen()).toBe(false);
    expect(service.activeModal()).toBeNull();
  });

  it('deve abrir e fechar o modal de exportação', async () => {
    mockRouter.url = '/viagens';
    await service.openExport();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: { action: 'export' } });
    expect(service.isExportOpen()).toBe(true);

    service.closeExport();
    expect(service.isExportOpen()).toBe(false);
  });

  it('deve abrir modal de nova despesa com a quinzena selecionada', async () => {
    mockRouter.url = '/dashboard';
    await service.openNewExpense(2);

    expect(service.newExpenseQuinzena()).toBe(2);
    expect(service.isNewExpenseOpen()).toBe(true);
    expect(service.activeModal()).toBe('newExpense');

    service.closeNewExpense();
    expect(service.isNewExpenseOpen()).toBe(false);
  });
});
