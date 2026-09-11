import {
  Directive,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  OnInit,
  Renderer2
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { maskCurrency, parseCurrency } from '../../core/utils/formatters';

@Directive({
  selector: 'input[currencyMask], input[appCurrencyMask]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyMaskDirective),
      multi: true
    }
  ]
})
export class CurrencyMaskDirective implements ControlValueAccessor, OnInit {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);

  private onChange: (val: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    const input = this.el.nativeElement;
    // Garante que o input seja tratado como texto para impedir setas e aceitar formatação BRL
    this.renderer.setAttribute(input, 'type', 'text');
    this.renderer.setAttribute(input, 'inputmode', 'numeric');
    this.renderer.setAttribute(input, 'autocomplete', 'off');
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = this.el.nativeElement;
    const rawValue = input.value;

    if (!rawValue || rawValue.trim() === '') {
      this.onChange(null);
      return;
    }

    const formatted = maskCurrency(rawValue);
    const numeric = parseCurrency(formatted);

    input.value = formatted;
    this.onChange(numeric);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: number | null | undefined): void {
    const input = this.el.nativeElement;
    if (value === null || value === undefined || value === 0) {
      if (value === 0) {
        this.renderer.setProperty(input, 'value', '0,00');
      } else {
        this.renderer.setProperty(input, 'value', '');
      }
    } else {
      const formatted = maskCurrency(value);
      this.renderer.setProperty(input, 'value', formatted);
    }
  }

  registerOnChange(fn: (val: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }
}
