import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { signal, WritableSignal } from '@angular/core';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let router: Router;
  let mockAuthStore: {
    isAuthenticated: WritableSignal<boolean>;
    currentUser: WritableSignal<any>;
  };

  beforeEach(async () => {
    mockAuthStore = {
      isAuthenticated: signal(false),
      currentUser: signal(null)
    };

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('deve criar o componente LandingComponent', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o título da marca Quinzena e o slogan oficial no Hero', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-title')?.textContent).toContain('Saiba quanto entra, quanto sai e');
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Quinzena');
  });

  it('deve navegar para /auth com queryParams ao clicar no botão de CTA para cadastro', () => {
    component.navigateToAuth('register');
    expect(router.navigate).toHaveBeenCalledWith(['/auth'], { queryParams: { tab: 'register' } });
  });

  it('deve navegar para /auth ao clicar no botão de login', () => {
    component.navigateToAuth('login');
    expect(router.navigate).toHaveBeenCalledWith(['/auth'], { queryParams: { tab: 'login' } });
  });

  it('deve navegar para /dashboard se o usuário autenticado clicar em ir para o dashboard', () => {
    mockAuthStore.isAuthenticated.set(true);
    fixture.detectChanges();
    component.navigateToDashboard();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('deve alternar a abertura e fechamento de itens do FAQ', () => {
    expect(component.faqs()[0].isOpen).toBe(false);
    component.toggleFaq(0);
    expect(component.faqs()[0].isOpen).toBe(true);
    component.toggleFaq(0);
    expect(component.faqs()[0].isOpen).toBe(false);
  });
});
