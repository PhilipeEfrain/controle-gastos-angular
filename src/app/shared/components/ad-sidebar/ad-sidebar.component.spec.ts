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

  it('NÃO deve renderizar sidebar para usuários PRO ou DUO quando alwaysShow for false', () => {
    mockIsProOrDuo.set(true);
    forceVisible();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar');
    expect(sidebar).toBeNull();
  });

  it('DEVE renderizar sidebar para usuários PRO ou DUO quando alwaysShow for true (módulo Dividir 100% free)', () => {
    mockIsProOrDuo.set(true);
    fixture.componentRef.setInput('alwaysShow', true);
    forceVisible();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar');
    expect(sidebar).toBeTruthy();
    expect(sidebar.textContent).toContain('Publicidade');
  });

  it('deve renderizar iframe do anúncio Adsterra com a chave configurada no sidebar', () => {
    fixture.componentRef.setInput('adKey', 'test-adsterra-sidebar-300');
    forceVisible();
    component.renderAdsterraBanner();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('data-ad-key')).toBe('test-adsterra-sidebar-300');
    expect(iframe.getAttribute('width')).toBe('300');
    expect(iframe.getAttribute('height')).toBe('250');
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

  it('NÃO deve renderizar sidebar quando isVisible é false (tela pequena)', () => {
    component.isVisible.set(false);
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('.ad-sidebar');
    expect(sidebar).toBeNull();
  });
});
