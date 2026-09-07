import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal.component';

describe('ConfirmationModalComponent', () => {
  let component: ConfirmationModalComponent;
  let fixture: ComponentFixture<ConfirmationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('deve criar o componente ConfirmationModalComponent', () => {
    expect(component).toBeTruthy();
  });

  it('deve emitir confirm ao clicar no botão de confirmação', () => {
    let confirmed = false;
    component.confirm.subscribe(() => (confirmed = true));

    const confirmBtn = fixture.nativeElement.querySelector('.btn-confirm') as HTMLButtonElement;
    confirmBtn.click();

    expect(confirmed).toBe(true);
  });

  it('deve emitir cancel ao clicar no botão de cancelar', () => {
    let canceled = false;
    component.cancel.subscribe(() => (canceled = true));

    const cancelBtn = fixture.nativeElement.querySelector('.btn-cancel') as HTMLButtonElement;
    cancelBtn.click();

    expect(canceled).toBe(true);
  });
});
