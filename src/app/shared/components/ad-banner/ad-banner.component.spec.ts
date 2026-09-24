import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdBannerComponent } from './ad-banner.component';
import { AuthStore } from '../../../core/state/auth.store';

describe('AdBannerComponent (Google AdSense Top Banner)', () => {
  let component: AdBannerComponent;
  let fixture: ComponentFixture<AdBannerComponent>;

  const mockIsProOrDuo = signal(false);

  const mockAuthStore = {
    isProOrDuo: mockIsProOrDuo
  };

  beforeEach(async () => {
    mockIsProOrDuo.set(false);

    await TestBed.configureTestingModule({
      imports: [AdBannerComponent],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve instanciar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 1: deve renderizar o banner de anúncio para usuários do Plano Free', () => {
    mockIsProOrDuo.set(false);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.ad-banner-wrapper');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Publicidade');
    expect(banner.textContent).toContain('Remover anúncios com o PRO');
  });

  it('Cenário BDD 2: NÃO deve renderizar o banner para assinantes com Plano PRO ou DUO ativo quando alwaysShow for false', () => {
    mockIsProOrDuo.set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.ad-banner-wrapper');
    expect(banner).toBeNull();
  });

  it('Cenário BDD 2b: DEVE renderizar o banner para assinantes PRO/DUO quando alwaysShow for true (módulo Dividir 100% free)', () => {
    mockIsProOrDuo.set(true);
    fixture.componentRef.setInput('alwaysShow', true);
    fixture.componentRef.setInput('showUpgradePrompt', false);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.ad-banner-wrapper');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Publicidade');
    expect(banner.querySelector('.btn-ad-upgrade')).toBeNull();
  });

  it('Cenário BDD 3: deve emitir upgradeClick ao clicar no botão de remover anúncios', () => {
    let clicked = false;
    component.upgradeClick.subscribe(() => {
      clicked = true;
    });

    fixture.detectChanges();
    const upgradeBtn = fixture.nativeElement.querySelector('.btn-ad-upgrade') as HTMLButtonElement;
    expect(upgradeBtn).toBeTruthy();
    upgradeBtn.click();

    expect(clicked).toBe(true);
  });

  describe('Cenários BDD (Adsterra & Publicidade Segura)', () => {
    it('Cenário BDD 4: deve renderizar iframe do anúncio Adsterra com a chave configurada e dimensões corretas', () => {
      fixture.componentRef.setInput('adKey', 'test-adsterra-key-728');
      component.renderAdsterraBanner();
      fixture.detectChanges();

      const iframe = fixture.nativeElement.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe.getAttribute('data-ad-key')).toBe('test-adsterra-key-728');
      expect(iframe.getAttribute('width')).toBe('728');
      expect(iframe.getAttribute('height')).toBe('90');
      expect(iframe.getAttribute('title')).toBe('Publicidade Quinzena');
    });

    it('Cenário BDD 4b: deve renderizar banner mobile 300x250 em telas menores que 768px ou formato rectangle', () => {
      fixture.componentRef.setInput('format', 'rectangle');
      fixture.componentRef.setInput('mobileAdKey', 'test-adsterra-mobile-300');
      component.activeFormat.set('rectangle');
      component.renderAdsterraBanner();
      fixture.detectChanges();

      const iframe = fixture.nativeElement.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe.getAttribute('data-ad-key')).toBe('test-adsterra-mobile-300');
      expect(iframe.getAttribute('width')).toBe('300');
      expect(iframe.getAttribute('height')).toBe('250');
    });

    it('Cenário BDD 4c: deve renderizar banner skyscraper 160x300 quando formato for skyscraper', () => {
      fixture.componentRef.setInput('format', 'skyscraper');
      fixture.componentRef.setInput('skyscraperAdKey', 'test-adsterra-skyscraper-160');
      component.activeFormat.set('skyscraper');
      component.renderAdsterraBanner();
      fixture.detectChanges();

      const iframe = fixture.nativeElement.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe.getAttribute('data-ad-key')).toBe('test-adsterra-skyscraper-160');
      expect(iframe.getAttribute('width')).toBe('160');
      expect(iframe.getAttribute('height')).toBe('300');
    });

    it('Cenário BDD 5: deve renderizar fallback de bloqueador de anúncios quando isAdBlocked for verdadeiro', () => {
      component.isAdBlocked.set(true);
      fixture.detectChanges();

      const fallback = fixture.nativeElement.querySelector('.ad-blocked-fallback');
      expect(fallback).toBeTruthy();
      expect(fallback.textContent).toContain('Bloqueador de anúncios ativo');

      const upgradeBtn = fallback.querySelector('.btn-fallback-upgrade') as HTMLButtonElement;
      expect(upgradeBtn).toBeTruthy();

      let clicked = false;
      component.upgradeClick.subscribe(() => {
        clicked = true;
      });
      upgradeBtn.click();
      expect(clicked).toBe(true);
    });

    it('Cenário BDD 6: deve chamar pushAd() retrocompatível sem erros', () => {
      (window as any).adsbygoogle = [];
      component.pushAd();
      expect((window as any).adsbygoogle.length).toBeGreaterThan(0);
    });
  });
});
