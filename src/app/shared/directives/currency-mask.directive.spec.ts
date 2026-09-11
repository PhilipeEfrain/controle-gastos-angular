import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CurrencyMaskDirective } from './currency-mask.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyMaskDirective],
  template: `
    <form [formGroup]="testForm">
      <input id="valor" currencyMask formControlName="valor" />
    </form>
  `
})
class TestHostComponent {
  testForm = new FormGroup({
    valor: new FormControl<number | null>(null)
  });
}

describe('CurrencyMaskDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let inputEl: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    inputEl = fixture.nativeElement.querySelector('#valor');
  });

  it('deve inicializar o input com type="text" e inputmode="numeric" para impedir setas', () => {
    expect(inputEl.getAttribute('type')).toBe('text');
    expect(inputEl.getAttribute('inputmode')).toBe('numeric');
  });

  it('deve formatar valor digitado com máscara BRL e atualizar formControl com número puro', () => {
    inputEl.value = '150050';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(inputEl.value).toContain('1.500,50');
    expect(component.testForm.get('valor')?.value).toBe(1500.5);
  });

  it('deve formatar valor programático vindo do formControl via writeValue', () => {
    component.testForm.get('valor')?.setValue(2750.9);
    fixture.detectChanges();

    expect(inputEl.value).toContain('2.750,90');
  });

  it('deve limpar o formControl quando o input for esvaziado', () => {
    inputEl.value = '';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.testForm.get('valor')?.value).toBeNull();
  });

  it('deve desabilitar o input quando o formControl for desabilitado', () => {
    component.testForm.get('valor')?.disable();
    fixture.detectChanges();

    expect(inputEl.disabled).toBe(true);
  });
});
