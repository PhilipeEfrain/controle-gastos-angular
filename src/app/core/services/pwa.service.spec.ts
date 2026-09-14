import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PwaService } from './pwa.service';
import { NotificationService } from './notification.service';

describe('PwaService (CARD-075)', () => {
  let service: PwaService;
  let mockNotificationService: {
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockNotificationService = {
      info: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
      error: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        PwaService,
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    });

    service = TestBed.inject(PwaService);
  });

  it('deve instanciar o serviço', () => {
    expect(service).toBeTruthy();
  });

  it('deve inicializar com status de rede', () => {
    expect(typeof service.isOnline()).toBe('boolean');
  });

  it('deve atualizar isOnline para false ao receber evento offline', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
    expect(mockNotificationService.warning).toHaveBeenCalled();
  });

  it('deve atualizar isOnline para true ao receber evento online', () => {
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
    expect(mockNotificationService.info).toHaveBeenCalled();
  });

  it('deve retornar false em installApp se não houver prompt capturado', async () => {
    const installed = await service.installApp();
    expect(installed).toBe(false);
  });

  it('Cenário BDD CARD-075: deve capturar beforeinstallprompt e permitir instalação nativa', async () => {
    const fakePromptEvent = new Event('beforeinstallprompt');
    (fakePromptEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (fakePromptEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    window.dispatchEvent(fakePromptEvent);

    expect(service.canInstall()).toBe(true);

    const installed = await service.installApp();
    expect(installed).toBe(true);
    expect(service.canInstall()).toBe(false);
  });

  it('Cenário BDD CARD-075: deve tratar evento appinstalled com sucesso', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(service.isInstalled()).toBe(true);
    expect(service.canInstall()).toBe(false);
    expect(mockNotificationService.success).toHaveBeenCalledWith(
      expect.stringContaining('instalado com sucesso')
    );
  });
});

