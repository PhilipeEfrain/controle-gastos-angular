import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpiringDataBannerComponent } from './expiring-data-banner.component';
import { ExpiringCycleInfo } from '../../../../core/services/plan-limits.service';

describe('ExpiringDataBannerComponent', () => {
  let component: ExpiringDataBannerComponent;
  let fixture: ComponentFixture<ExpiringDataBannerComponent>;

  const mockInfo: ExpiringCycleInfo = {
    mesAno: '2026-06',
    label: 'Junho de 2026',
    daysRemainingInMonth: 18,
    plan: 'free'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpiringDataBannerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpiringDataBannerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('info', mockInfo);
    fixture.detectChanges();
  });

  it('deve ser instanciado corretamente', () => {
    expect(component).toBeTruthy();
  });

  it('deve exibir o título com o mês de carência e os dias restantes', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Histórico de Junho de 2026 vai expirar');
    expect(el.textContent).toContain('Restam 18 dias');
  });

  it('deve emitir downloadPdf com o mesAno correto ao clicar no botão de download', () => {
    let emittedMonth = '';
    component.downloadPdf.subscribe((val) => (emittedMonth = val));

    const downloadBtn = fixture.nativeElement.querySelector('.btn-download') as HTMLButtonElement;
    downloadBtn.click();

    expect(emittedMonth).toBe('2026-06');
  });

  it('não deve emitir downloadPdf quando isDownloading for true', () => {
    fixture.componentRef.setInput('isDownloading', true);
    fixture.detectChanges();

    let emitted = false;
    component.downloadPdf.subscribe(() => (emitted = true));

    component.onDownload();
    expect(emitted).toBe(false);
  });

  it('deve emitir dismiss ao clicar no botão de fechar', () => {
    let dismissed = false;
    component.dismiss.subscribe(() => (dismissed = true));

    const dismissBtn = fixture.nativeElement.querySelector('.btn-dismiss') as HTMLButtonElement;
    dismissBtn.click();

    expect(dismissed).toBe(true);
  });
});
