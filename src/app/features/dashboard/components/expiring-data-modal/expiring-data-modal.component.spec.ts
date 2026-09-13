import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpiringDataModalComponent } from './expiring-data-modal.component';
import { ExpiringCycleInfo } from '../../../../core/services/plan-limits.service';

describe('ExpiringDataModalComponent', () => {
  let component: ExpiringDataModalComponent;
  let fixture: ComponentFixture<ExpiringDataModalComponent>;

  const mockInfo: ExpiringCycleInfo = {
    mesAno: '2026-06',
    label: 'Junho de 2026',
    daysRemainingInMonth: 18,
    plan: 'free'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpiringDataModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpiringDataModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('info', mockInfo);
    fixture.detectChanges();
  });

  it('deve ser instanciado corretamente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o título e a contagem de dias quando aberto', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Seu histórico de Junho de 2026 vai expirar');
    expect(el.textContent).toContain('Restam 18 dias de carência');
  });

  it('não deve renderizar o modal quando isOpen for false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    expect(backdrop).toBeNull();
  });

  it('deve emitir downloadPdf com o mesAno correto ao clicar no botão de download', () => {
    let emitted = '';
    component.downloadPdf.subscribe((val) => (emitted = val));

    const btn = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    btn.click();

    expect(emitted).toBe('2026-06');
  });

  it('não deve emitir downloadPdf quando isDownloading for true', () => {
    fixture.componentRef.setInput('isDownloading', true);
    fixture.detectChanges();

    let emitted = false;
    component.downloadPdf.subscribe(() => (emitted = true));

    component.onDownload();
    expect(emitted).toBe(false);
  });

  it('deve emitir upgrade quando botão de upgrade for clicado no Free', () => {
    let upgraded = false;
    component.upgrade.subscribe(() => (upgraded = true));

    const upgradeBtn = fixture.nativeElement.querySelector('.btn-upgrade') as HTMLButtonElement;
    upgradeBtn.click();

    expect(upgraded).toBe(true);
  });

  it('deve emitir close ao clicar no botão fechar ou botão secundário', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    const closeBtn = fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement;
    closeBtn.click();

    expect(closed).toBe(true);
  });

  it('deve emitir close ao pressionar Escape', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.onEscape();
    expect(closed).toBe(true);
  });
});
