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

  it('Cenário BDD (Planos Landing): deve exibir preços mensais oficiais dos planos Pro e Duo', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.plan-pro .price-val')?.textContent?.trim()).toBe('9,90');
    expect(compiled.querySelector('.plan-duo .price-val')?.textContent?.trim()).toBe('19,90');
  });

  it('Cenário BDD (Checkout): deve navegar para /auth com queryParams de plano', () => {
    component.navigateToAuth('register', 'pro');
    expect(router.navigate).toHaveBeenCalledWith(['/auth'], {
      queryParams: { tab: 'register', plan: 'pro' }
    });
  });

  describe('Cenário BDD 2: Banner de Consentimento de Cookies e Termos na Landing Page', () => {
    it('deve exibir o banner de cookies caso não haja consentimento prévio', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.showCookieConsent()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.cookie-banner')).toBeTruthy();
      expect(compiled.querySelector('.cookie-banner')?.textContent).toContain('Termos de Uso');
      expect(compiled.querySelector('.cookie-banner')?.textContent).toContain('Política de Privacidade');
    });

    it('deve gravar consentimento no localStorage e ocultar o banner ao aceitar', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      component.showCookieConsent.set(true);
      fixture.detectChanges();

      component.acceptCookieConsent();
      fixture.detectChanges();

      expect(setItemSpy).toHaveBeenCalledWith('cookie_consent_accepted', 'true');
      expect(component.showCookieConsent()).toBe(false);
    });

    it('deve renderizar links para /termos e /privacidade no rodapé', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const links = Array.from(compiled.querySelectorAll('.footer-col a')).map(a => a.textContent?.trim());
      expect(links).toContain('Termos de Uso');
      expect(links).toContain('Privacidade & LGPD');
    });
  });
});
