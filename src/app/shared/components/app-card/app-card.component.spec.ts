import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppCardComponent } from './app-card.component';

describe('AppCardComponent', () => {
  let component: AppCardComponent;
  let fixture: ComponentFixture<AppCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AppCardComponent);
    component = fixture.componentInstance;
  });

  it('deve instanciar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD: deve renderizar título e subtítulo passados por Signal Input', () => {
    fixture.componentRef.setInput('title', 'Resumo da Quinzena 1');
    fixture.componentRef.setInput('subtitle', 'Ciclo de Março');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-card__title')?.textContent).toBe('Resumo da Quinzena 1');
    expect(compiled.querySelector('.app-card__subtitle')?.textContent).toBe('Ciclo de Março');
  });

  it('deve aplicar classe de variante correspondente', () => {
    fixture.componentRef.setInput('variant', 'success');
    fixture.detectChanges();

    const cardEl = fixture.nativeElement.querySelector('.app-card');
    expect(cardEl.classList.contains('app-card--success')).toBe(true);
  });
});
