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

  it('Cenário BDD 2: NÃO deve renderizar o banner para assinantes com Plano PRO ou DUO ativo', () => {
    mockIsProOrDuo.set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.ad-banner-wrapper');
    expect(banner).toBeNull();
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

  describe('Cenários BDD (CARD-054): Publicação de Anúncios Reais & ads.txt', () => {
    it('Cenário BDD 4: deve configurar atributos data-ad-client e data-ad-slot no elemento ins.adsbygoogle', () => {
      fixture.componentRef.setInput('adClient', 'ca-pub-1234567890123456');
      fixture.componentRef.setInput('slotId', '9876543210');
      fixture.detectChanges();

      const insElement = fixture.nativeElement.querySelector('ins.adsbygoogle');
      expect(insElement).toBeTruthy();
      expect(insElement.getAttribute('data-ad-client')).toBe('ca-pub-1234567890123456');
      expect(insElement.getAttribute('data-ad-slot')).toBe('9876543210');
      expect(insElement.getAttribute('data-ad-format')).toBe('auto');
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

    it('Cenário BDD 6: deve chamar pushAd() sem lançar erros e atualizar fila do window.adsbygoogle', () => {
      (window as any).adsbygoogle = [];
      component.pushAd();
      expect((window as any).adsbygoogle.length).toBeGreaterThan(0);
    });

    it('Cenário BDD 7: deve resolver ensureAdSenseScript se script já existir no DOM', async () => {
      const dummyScript = document.createElement('script');
      dummyScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test';
      document.head.appendChild(dummyScript);

      await expect(component.ensureAdSenseScript('ca-pub-test')).resolves.toBeUndefined();

      dummyScript.remove();
    });
  });
});
