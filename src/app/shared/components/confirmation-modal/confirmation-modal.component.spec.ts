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

  it('deve emitir close ao clicar no botão de fechar ou cancelar', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    const closeBtn = fixture.nativeElement.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(closed).toBe(true);
  });

  it('deve vir com isOpen = true por padrão e renderizar o modal', () => {
    const defaultFixture = TestBed.createComponent(ConfirmationModalComponent);
    defaultFixture.detectChanges();

    const modalContainer = defaultFixture.nativeElement.querySelector('.modal-container');
    expect(defaultFixture.componentInstance.isOpen()).toBe(true);
    expect(modalContainer).toBeTruthy();
  });

  it('deve respeitar confirmText e cancelText como aliases', () => {
    fixture.componentRef.setInput('confirmText', 'Sim, Excluir');
    fixture.componentRef.setInput('cancelText', 'Não, Voltar');
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('.btn-confirm') as HTMLButtonElement;
    const cancelBtn = fixture.nativeElement.querySelector('.btn-cancel') as HTMLButtonElement;

    expect(confirmBtn.textContent?.trim()).toBe('Sim, Excluir');
    expect(cancelBtn.textContent?.trim()).toBe('Não, Voltar');
  });

  it('não deve renderizar conteúdo se isOpen for explicitamente false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const modalContainer = fixture.nativeElement.querySelector('.modal-container');
    expect(modalContainer).toBeNull();
  });
});
