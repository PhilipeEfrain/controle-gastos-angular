import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TermsComponent } from './terms.component';

describe('TermsComponent (Página Pública de Termos de Uso)', () => {
  let component: TermsComponent;
  let fixture: ComponentFixture<TermsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TermsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve instanciar o componente TermsComponent', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 1: deve renderizar título, versão vigente e aviso de isenção financeira', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.legal-title')?.textContent).toContain('Termos de Uso');
    expect(compiled.querySelector('.legal-metadata')?.textContent).toContain('Março de 2026');
    expect(compiled.querySelector('.legal-metadata')?.textContent).toContain('Versão: 1.2');

    // Isenção de consultoria financeira
    expect(compiled.querySelector('.legal-callout')?.textContent).toContain('Aviso de Isenção Financeira');
  });

  it('deve conter cláusulas essenciais sobre planos, cancelamento e direito ao esquecimento', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Plano Free');
    expect(text).toContain('Plano PRO');
    expect(text).toContain('Plano DUO');
    expect(text).toContain('Grace Period');
    expect(text).toContain('Direito ao Esquecimento');
  });

  it('deve conter botão para retornar ao início ("/") e link para política de privacidade', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backBtn = compiled.querySelector('.btn-back-home');
    expect(backBtn).toBeTruthy();
    expect(backBtn?.getAttribute('routerLink') || backBtn?.getAttribute('href')).toBe('/');

    const privacyLink = compiled.querySelector('.meta-link');
    expect(privacyLink?.getAttribute('routerLink') || privacyLink?.getAttribute('href')).toBe('/privacidade');
  });
});
