import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfflineBannerComponent } from './offline-banner.component';
import { PwaService } from '../../../core/services/pwa.service';
import { signal } from '@angular/core';

describe('OfflineBannerComponent', () => {
  let component: OfflineBannerComponent;
  let fixture: ComponentFixture<OfflineBannerComponent>;
  let mockPwaService: {
    isOnline: ReturnType<typeof signal<boolean>>;
    updateAvailable: ReturnType<typeof signal<boolean>>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPwaService = {
      isOnline: signal(true),
      updateAvailable: signal(false),
      activateUpdate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [OfflineBannerComponent],
      providers: [
        { provide: PwaService, useValue: mockPwaService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('não deve exibir banner quando online', () => {
    mockPwaService.isOnline.set(true);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.offline-banner');
    expect(banner).toBeNull();
  });

  it('deve exibir banner quando offline', () => {
    mockPwaService.isOnline.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.offline-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Modo Offline Ativo');
  });

  it('deve chamar activateUpdate ao clicar em atualizar app', () => {
    mockPwaService.updateAvailable.set(true);
    fixture.detectChanges();
    const updateBtn = fixture.nativeElement.querySelector('.btn-update');
    expect(updateBtn).toBeTruthy();
    updateBtn.click();
    expect(mockPwaService.activateUpdate).toHaveBeenCalled();
  });
});
