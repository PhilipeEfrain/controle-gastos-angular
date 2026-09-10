import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent (Página Pública de Política de Privacidade e LGPD)', () => {
  let component: PrivacyComponent;
  let fixture: ComponentFixture<PrivacyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve instanciar o componente PrivacyComponent', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 1: deve exibir badge de conformidade LGPD e menção à Lei 13.709/2018', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.legal-badge--privacy')?.textContent).toContain('LGPD (LEI 13.709/2018)');
    expect(compiled.querySelector('.legal-title')?.textContent).toContain('Política de Privacidade');
  });

  it('deve apresentar as bases legais da LGPD e tabela explicativa de dados tratados', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('.legal-table');
    expect(table).toBeTruthy();
    expect(table?.textContent).toContain('Identificação e Cadastro');
    expect(table?.textContent).toContain('Lançamentos Financeiros');
    expect(table?.textContent).toContain('Faturamento e Assinaturas');
    expect(table?.textContent).toContain('Execução de Contrato');
  });

  it('deve enfatizar o não armazenamento de dados sensíveis de pagamento (PCI-DSS) e direitos do titular', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Cartões de Crédito (PCI-DSS)');
    expect(text).toContain('nunca armazena em seus servidores número completo de cartão');
    expect(text).toContain('Artigo 18 da LGPD');
    expect(text).toContain('Direito ao Esquecimento / Exclusão Permanente');
    expect(text).toContain('privacidade@quinzena.app');
  });

  it('deve conter botão para retornar ao início ("/") e link para termos de uso', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backBtn = compiled.querySelector('.btn-back-home');
    expect(backBtn).toBeTruthy();
    expect(backBtn?.getAttribute('routerLink') || backBtn?.getAttribute('href')).toBe('/');

    const termsLink = compiled.querySelector('.meta-link');
    expect(termsLink?.getAttribute('routerLink') || termsLink?.getAttribute('href')).toBe('/termos');
  });
});
