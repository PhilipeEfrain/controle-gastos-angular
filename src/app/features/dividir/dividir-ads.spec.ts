import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { DividirRestauranteComponent } from './dividir-restaurante.component';
import { DividirHomeComponent } from './dividir-home.component';
import { AuthStore } from '../../core/state/auth.store';
import { NotificationService } from '../../core/services/notification.service';
import { SplitService } from '../../core/services/split.service';
import { ActivatedRoute, Router } from '@angular/router';

describe('Regra de Anúncios no Módulo Dividir (BDD)', () => {
  let mockIsProOrDuo: WritableSignal<boolean>;
  let mockIsAuthenticated: WritableSignal<boolean>;
  let mockAuthStore: Partial<AuthStore>;

  beforeEach(() => {
    mockIsProOrDuo = signal(false);
    mockIsAuthenticated = signal(false);
    mockAuthStore = {
      isProOrDuo: mockIsProOrDuo,
      isAuthenticated: mockIsAuthenticated,
      currentUser: signal(null)
    };
  });

  describe('DividirRestauranteComponent', () => {
    let component: DividirRestauranteComponent;
    let fixture: ComponentFixture<DividirRestauranteComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [DividirRestauranteComponent],
        providers: [
          { provide: AuthStore, useValue: mockAuthStore },
          { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(DividirRestauranteComponent);
      component = fixture.componentInstance;
    });

    it('Cenário 1: Se o usuário estiver logado e for PRO ou DUO, NÃO deve mostrar anúncios', () => {
      mockIsAuthenticated.set(true);
      mockIsProOrDuo.set(true);
      fixture.detectChanges();

      expect(component.showAds()).toBe(false);

      const adBanners = fixture.nativeElement.querySelectorAll('app-ad-banner');
      expect(adBanners.length).toBe(0);
    });

    it('Cenário 2: Se o usuário estiver logado e for Free, DEVE mostrar anúncios', () => {
      mockIsAuthenticated.set(true);
      mockIsProOrDuo.set(false);
      fixture.detectChanges();

      expect(component.showAds()).toBe(true);

      const adBanners = fixture.nativeElement.querySelectorAll('app-ad-banner');
      expect(adBanners.length).toBeGreaterThan(0);
    });

    it('Cenário 3: Se o usuário estiver deslogado, DEVE mostrar anúncios', () => {
      mockIsAuthenticated.set(false);
      mockIsProOrDuo.set(false);
      fixture.detectChanges();

      expect(component.showAds()).toBe(true);

      const adBanners = fixture.nativeElement.querySelectorAll('app-ad-banner');
      expect(adBanners.length).toBeGreaterThan(0);
    });
  });

  describe('DividirHomeComponent', () => {
    let component: DividirHomeComponent;
    let fixture: ComponentFixture<DividirHomeComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [DividirHomeComponent],
        providers: [
          { provide: AuthStore, useValue: mockAuthStore },
          { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
          { provide: SplitService, useValue: { getUserGroups: vi.fn().mockResolvedValue([]) } },
          { provide: Router, useValue: { navigate: vi.fn(), url: '/dividir' } },
          { provide: ActivatedRoute, useValue: {} }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(DividirHomeComponent);
      component = fixture.componentInstance;
    });

    it('Cenário 1: Se o usuário for PRO ou DUO, showAds deve ser false e não renderizar colunas/linhas de anúncios', () => {
      mockIsAuthenticated.set(true);
      mockIsProOrDuo.set(true);
      fixture.detectChanges();

      expect(component.showAds()).toBe(false);

      const sideCols = fixture.nativeElement.querySelectorAll('.dividir-side-ad-col');
      expect(sideCols.length).toBe(0);

      const adRows = fixture.nativeElement.querySelectorAll('.dividir-ad-row');
      expect(adRows.length).toBe(0);
    });

    it('Cenário 2: Se o usuário for Free ou deslogado, showAds deve ser true e renderizar espaços de anúncios', () => {
      mockIsAuthenticated.set(false);
      mockIsProOrDuo.set(false);
      fixture.detectChanges();

      expect(component.showAds()).toBe(true);

      const sideCols = fixture.nativeElement.querySelectorAll('.dividir-side-ad-col');
      expect(sideCols.length).toBe(2);

      const adRows = fixture.nativeElement.querySelectorAll('.dividir-ad-row');
      expect(adRows.length).toBeGreaterThan(0);
    });
  });
});
