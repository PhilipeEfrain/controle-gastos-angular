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
});
