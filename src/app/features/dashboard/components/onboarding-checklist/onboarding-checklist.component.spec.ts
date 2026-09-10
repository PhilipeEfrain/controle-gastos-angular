import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { OnboardingChecklistComponent } from './onboarding-checklist.component';

describe('OnboardingChecklistComponent', () => {
  let component: OnboardingChecklistComponent;
  let componentRef: ComponentRef<OnboardingChecklistComponent>;
  let fixture: ComponentFixture<OnboardingChecklistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingChecklistComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingChecklistComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('userId', 'user-test-123');
    fixture.detectChanges();
  });

  it('deve instanciar o componente OnboardingChecklistComponent', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 1: deve iniciar com 0/3 passos concluídos e barra em 0%', () => {
    expect(component.completedCount()).toBe(0);
    expect(component.progressPercentage()).toBe(0);
    expect(component.isAllCompleted()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.step-badge')?.textContent).toContain('0/3 concluídos');
    expect(compiled.querySelector('.progress-percentage')?.textContent).toContain('0%');
  });

  it('Cenário BDD 2: deve atualizar reativamente o progresso conforme o usuário realiza as ações', () => {
    // Passo 1: Definir rendas -> 33%
    componentRef.setInput('hasIncomes', true);
    fixture.detectChanges();

    expect(component.step1Done()).toBe(true);
    expect(component.completedCount()).toBe(1);
    expect(component.progressPercentage()).toBe(33);

    // Passo 2: Cadastrar 1ª despesa -> 66%
    componentRef.setInput('hasExpenses', true);
    fixture.detectChanges();

    expect(component.step2Done()).toBe(true);
    expect(component.completedCount()).toBe(2);
    expect(component.progressPercentage()).toBe(67);

    // Passo 3: Explorar parcelas/tributos -> 100%
    componentRef.setInput('hasExploredFeatures', true);
    fixture.detectChanges();

    expect(component.step3Done()).toBe(true);
    expect(component.completedCount()).toBe(3);
    expect(component.progressPercentage()).toBe(100);
    expect(component.isAllCompleted()).toBe(true);
  });

  it('Cenário BDD 3: deve exibir mensagem de celebração ao atingir 100% de conclusão', () => {
    componentRef.setInput('hasIncomes', true);
    componentRef.setInput('hasExpenses', true);
    componentRef.setInput('hasExploredFeatures', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.celebration-banner')).toBeTruthy();
    expect(compiled.querySelector('.celebration-banner')?.textContent).toContain('Parabéns! Seu orçamento quinzenal está configurado.');
  });

  it('Cenário BDD 4: deve dispensar o guia, persistir no localStorage e emitir evento', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    let emitted = false;
    component.dismissed.subscribe(() => {
      emitted = true;
    });

    component.dismiss();
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith('onboarding_dismissed_user-test-123', 'true');
    expect(component.isDismissedLocally()).toBe(true);
    expect(emitted).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.onboarding-card')).toBeNull();
  });

  it('deve emitir eventos de ação ao clicar em cada um dos passos', () => {
    let incomeEmitted = false;
    let expenseEmitted = false;
    let exploreEmitted = false;

    component.defineIncomes.subscribe(() => incomeEmitted = true);
    component.addExpense.subscribe(() => expenseEmitted = true);
    component.exploreFeatures.subscribe(() => exploreEmitted = true);

    component.onStep1Click();
    expect(incomeEmitted).toBe(true);

    component.onStep2Click();
    expect(expenseEmitted).toBe(true);

    component.onStep3Click();
    expect(exploreEmitted).toBe(true);
  });

  it('deve possuir a estrutura de classes semânticas para adaptação aos temas do Design System', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const card = compiled.querySelector('.onboarding-card');
    const header = compiled.querySelector('.onboarding-header');
    const badge = compiled.querySelector('.step-badge');
    const track = compiled.querySelector('.progress-track');
    const stepCards = compiled.querySelectorAll('.step-card');

    expect(card).toBeTruthy();
    expect(header).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(track).toBeTruthy();
    expect(stepCards.length).toBe(3);
  });
});

