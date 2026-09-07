import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandLogoComponent } from './brand-logo.component';
import { ThemeService } from '../../../core/services/theme.service';
import { signal, WritableSignal } from '@angular/core';

describe('BrandLogoComponent', () => {
  let component: BrandLogoComponent;
  let fixture: ComponentFixture<BrandLogoComponent>;
  let mockThemeSignal: WritableSignal<'dark' | 'light'>;
  let mockThemeService: {
    currentTheme: WritableSignal<'dark' | 'light'>;
    isDark: () => boolean;
  };

  beforeEach(async () => {
    mockThemeSignal = signal<'dark' | 'light'>('dark');
    mockThemeService = {
      currentTheme: mockThemeSignal,
      isDark: () => mockThemeSignal() === 'dark'
    };

    await TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [
        { provide: ThemeService, useValue: mockThemeService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BrandLogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente BrandLogoComponent', () => {
    expect(component).toBeTruthy();
  });

  it('deve exibir o símbolo de tema escuro por padrão no Dark Mode', () => {
    mockThemeSignal.set('dark');
    fixture.detectChanges();
    expect(component.isDark).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#clip_symbol_white')).toBeTruthy();
  });

  it('deve alternar para o símbolo escuro quando o tema for alterado para Light Mode', () => {
    mockThemeSignal.set('light');
    fixture.detectChanges();
    expect(component.isDark).toBe(false);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#clip_symbol_dark')).toBeTruthy();
  });

  it('deve renderizar o texto Quinzena quando showText for true', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toBe('Quinzena');
  });
});
