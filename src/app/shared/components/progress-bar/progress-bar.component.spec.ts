import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressBarComponent } from './progress-bar.component';

describe('ProgressBarComponent', () => {
  let fixture: ComponentFixture<ProgressBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressBarComponent);
  });

  it('Cenário BDD: deve calcular largura e classe de atenção (warning) para 80% gasto', () => {
    fixture.componentRef.setInput('current', 800);
    fixture.componentRef.setInput('max', 1000);
    fixture.detectChanges();

    const fillEl = fixture.nativeElement.querySelector('.progress-fill') as HTMLElement;
    expect(fillEl.style.width).toBe('80%');
    expect(fillEl.classList.contains('progress-fill--warning')).toBe(true);
  });

  it('deve aplicar classe de perigo (danger) quando percentual for >= 90%', () => {
    fixture.componentRef.setInput('current', 950);
    fixture.componentRef.setInput('max', 1000);
    fixture.detectChanges();

    const fillEl = fixture.nativeElement.querySelector('.progress-fill') as HTMLElement;
    expect(fillEl.classList.contains('progress-fill--danger')).toBe(true);
  });

  it('deve aplicar classe de sucesso (success) quando percentual for < 70%', () => {
    fixture.componentRef.setInput('current', 500);
    fixture.componentRef.setInput('max', 1000);
    fixture.detectChanges();

    const fillEl = fixture.nativeElement.querySelector('.progress-fill') as HTMLElement;
    expect(fillEl.classList.contains('progress-fill--success')).toBe(true);
  });
});
