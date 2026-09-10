import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DunningBannerComponent } from './dunning-banner.component';

describe('DunningBannerComponent', () => {
  let component: DunningBannerComponent;
  let fixture: ComponentFixture<DunningBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DunningBannerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DunningBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('não deve renderizar o banner se não houver inadimplência nem suspensão', () => {
    fixture.componentRef.setInput('isGracePeriodActive', false);
    fixture.componentRef.setInput('isPlanSuspended', false);
    fixture.detectChanges();

    const bannerEl = fixture.nativeElement.querySelector('.dunning-banner');
    expect(bannerEl).toBeNull();
  });

  it('deve renderizar o Estado 1 (Grace Period ativo com tom de aviso) quando isGracePeriodActive for true', () => {
    fixture.componentRef.setInput('isGracePeriodActive', true);
    fixture.componentRef.setInput('isPlanSuspended', false);
    fixture.componentRef.setInput('deadlineFormatted', '15/10');
    fixture.detectChanges();

    const bannerEl = fixture.nativeElement.querySelector('.dunning-banner');
    expect(bannerEl).toBeTruthy();
    expect(bannerEl.classList).toContain('dunning-banner--warning');

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Aviso de Pagamento Pendente');
    expect(content).toContain('15/10');
    expect(content).toContain('Regularizar Assinatura');
  });

  it('deve renderizar o Estado 2 (Assinatura suspensa com destaque crítico) quando isPlanSuspended for true', () => {
    fixture.componentRef.setInput('isGracePeriodActive', false);
    fixture.componentRef.setInput('isPlanSuspended', true);
    fixture.detectChanges();

    const bannerEl = fixture.nativeElement.querySelector('.dunning-banner');
    expect(bannerEl).toBeTruthy();
    expect(bannerEl.classList).toContain('dunning-banner--critical');

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Assinatura Suspensa');
    expect(content).toContain('100% preservados');
  });

  it('deve emitir o evento regularize ao clicar no botão', () => {
    fixture.componentRef.setInput('isGracePeriodActive', true);
    fixture.detectChanges();

    let emitted = false;
    component.regularize.subscribe(() => {
      emitted = true;
    });

    const btn = fixture.nativeElement.querySelector('#btn-regularize-subscription');
    expect(btn).toBeTruthy();
    btn.click();

    expect(emitted).toBe(true);
  });
});
