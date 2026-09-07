import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LimitReachedModalComponent } from './limit-reached-modal.component';
import { AuthStore } from '../../../core/state/auth.store';
import { signal } from '@angular/core';

describe('LimitReachedModalComponent', () => {
  let component: LimitReachedModalComponent;
  let fixture: ComponentFixture<LimitReachedModalComponent>;

  beforeEach(async () => {
    const mockAuthStore = {
      currentUser: signal(null),
      currentPlan: signal('free'),
      isProOrDuo: signal(false),
      updateCurrentUser: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [LimitReachedModalComponent],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LimitReachedModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD (Feature Gate): DEVE exibir o título e mensagem de limite', () => {
    const titleEl = fixture.nativeElement.querySelector('#limit-title');
    expect(titleEl.textContent).toContain('Limite do Plano Gratuito Atingido');
  });

  it('Cenário BDD (Feature Gate): DEVE emitir evento de fechamento ao clicar no botão fechar', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Cenário BDD (Conversão PRO): DEVE abrir o modal de assinatura ao clicar no botão de upgrade', () => {
    expect(component.isSubscriptionOpen()).toBe(false);
    component.openSubscription();
    expect(component.isSubscriptionOpen()).toBe(true);
  });
});
