import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EarlyAccessService } from './early-access.service';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';

describe('EarlyAccessService', () => {
  let service: EarlyAccessService;
  let mockFirebaseService: any;
  let mockLoggerService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        EarlyAccessService,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: LoggerService, useValue: mockLoggerService }
      ]
    });

    service = TestBed.inject(EarlyAccessService);
  });

  it('deve instanciar o serviço com defaults seguros', () => {
    expect(service).toBeTruthy();
    expect(service.config().registrationsOpen).toBe(true);
    expect(service.config().maxBetaUsers).toBe(100);
    expect(service.isRegistrationsOpen()).toBe(true);
  });

  it('deve retornar false em joinWaitlist com e-mail inválido', async () => {
    const result = await service.joinWaitlist('email-invalido');
    expect(result).toBe(false);
  });

  it('deve retornar false em isRegistrationsOpen se registrationsOpen for false', () => {
    (service as any)._config.set({
      registrationsOpen: false,
      maxBetaUsers: 100
    });
    expect(service.isRegistrationsOpen()).toBe(false);
  });

  it('deve retornar false em isRegistrationsOpen se total de usuários atingir o teto', () => {
    (service as any)._config.set({
      registrationsOpen: true,
      maxBetaUsers: 50,
      totalRegisteredUsers: 50
    });
    expect(service.isRegistrationsOpen()).toBe(false);
  });

  it('deve retornar true em isRegistrationsOpen se total de usuários for menor que o teto', () => {
    (service as any)._config.set({
      registrationsOpen: true,
      maxBetaUsers: 50,
      totalRegisteredUsers: 49
    });
    expect(service.isRegistrationsOpen()).toBe(true);
  });
});
