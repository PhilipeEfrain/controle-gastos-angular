import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AdSidebarComponent } from './ad-sidebar.component';
import { AuthStore } from '../../../core/state/auth.store';

describe('AdSidebarComponent (Google AdSense Sidebar)', () => {
  let component: AdSidebarComponent;
  let fixture: ComponentFixture<AdSidebarComponent>;

  const mockIsProOrDuo = signal(false);

  const mockAuthStore = {
    isProOrDuo: mockIsProOrDuo
  };

  beforeEach(async () => {
    mockIsProOrDuo.set(false);

    // Mock matchMedia para o ambiente jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [AdSidebarComponent],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdSidebarComponent);
    component = fixture.componentInstance;
    // Trigger ngAfterViewInit (matchMedia matches=false → isVisible=false)
    fixture.detectChanges();
  });

  /** Helper: força visibilidade do sidebar e re-renderiza */
  function forceVisible(): void {
    component.isVisible.set(true);
    fixture.detectChanges();
  }

  it('deve instanciar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve identificar corretamente usuários Free', () => {
    mockIsProOrDuo.set(false);
    expect(component.isFreeUser()).toBe(true);
  });

  it('NÃO deve renderizar sidebar para usuários PRO ou DUO', () => {
    mockIsProOrDuo.set(true);
    forceVisible();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar');
    expect(sidebar).toBeNull();
  });

  it('deve configurar atributos data-ad-client e data-ad-slot no elemento ins.adsbygoogle', () => {
    fixture.componentRef.setInput('adClient', 'ca-pub-1234567890123456');
    fixture.componentRef.setInput('slotId', '9876543210');
    forceVisible();

    const insElement = fixture.nativeElement.querySelector('ins.adsbygoogle');
    expect(insElement).toBeTruthy();
    expect(insElement.getAttribute('data-ad-client')).toBe('ca-pub-1234567890123456');
    expect(insElement.getAttribute('data-ad-slot')).toBe('9876543210');
    expect(insElement.getAttribute('data-ad-format')).toBe('vertical');
  });

  it('deve aplicar a classe de posição correta (left)', () => {
    fixture.componentRef.setInput('position', 'left');
    forceVisible();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar--left');
    expect(sidebar).toBeTruthy();
  });

  it('deve aplicar a classe de posição correta (right)', () => {
    fixture.componentRef.setInput('position', 'right');
    forceVisible();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar--right');
    expect(sidebar).toBeTruthy();
  });

  it('deve renderizar fallback de bloqueador de anúncios quando isAdBlocked for verdadeiro', () => {
    component.isAdBlocked.set(true);
    forceVisible();

    const fallback = fixture.nativeElement.querySelector('.ad-sidebar-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('Bloqueador ativo');
  });

  it('deve chamar pushAd() sem lançar erros', () => {
    (window as any).adsbygoogle = [];
    component.pushAd();
    expect((window as any).adsbygoogle.length).toBeGreaterThan(0);
  });

  it('deve resolver ensureAdSenseScript se script já existir no DOM', async () => {
    const dummyScript = document.createElement('script');
    dummyScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test';
    document.head.appendChild(dummyScript);

    await expect(component.ensureAdSenseScript('ca-pub-test')).resolves.toBeUndefined();

    dummyScript.remove();
  });

  it('NÃO deve renderizar sidebar quando isVisible é false (tela pequena)', () => {
    component.isVisible.set(false);
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar');
    expect(sidebar).toBeNull();
  });
});
