import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastNotification } from '../../../core/models/notification.model';
import { signal } from '@angular/core';

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let mockNotificationService: {
    notifications: any;
    dismiss: ReturnType<typeof vi.fn>;
  };

  const mockToasts: ToastNotification[] = [
    {
      id: 'toast-1',
      type: 'success',
      message: 'Salvo com sucesso!',
      timestamp: Date.now()
    },
    {
      id: 'toast-2',
      type: 'error',
      message: 'Falha na conexão',
      timestamp: Date.now()
    }
  ];

  beforeEach(async () => {
    mockNotificationService = {
      notifications: signal<ToastNotification[]>(mockToasts),
      dismiss: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente ToastContainer', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar os alertas da lista de notificações', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const toastItems = compiled.querySelectorAll('.toast-item');
    expect(toastItems.length).toBe(2);

    expect(compiled.textContent).toContain('Salvo com sucesso!');
    expect(compiled.textContent).toContain('Falha na conexão');
  });

  it('deve acionar dismiss ao clicar no botão de fechar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const closeBtn = compiled.querySelector('.btn-close') as HTMLButtonElement;
    closeBtn.click();

    expect(mockNotificationService.dismiss).toHaveBeenCalledWith('toast-1');
  });
});
