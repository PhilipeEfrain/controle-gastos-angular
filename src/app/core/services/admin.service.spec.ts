import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AdminService } from './admin.service';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { UserProfile } from '../models/user.model';

describe('AdminService', () => {
  let service: AdminService;
  let mockFirebaseService: any;
  let mockLoggerService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    mockLoggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: LoggerService, useValue: mockLoggerService }
      ]
    });

    service = TestBed.inject(AdminService);
  });

  it('deve ser criado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  describe('Cálculo de Métricas SaaS (MRR & Conversão)', () => {
    it('Cenário BDD: deve calcular corretamente MRR e distribuição para lista vazia', () => {
      const metrics = service.calculateSaaSMetrics([]);
      expect(metrics.totalUsers).toBe(0);
      expect(metrics.freeUsers).toBe(0);
      expect(metrics.proUsers).toBe(0);
      expect(metrics.duoUsers).toBe(0);
      expect(metrics.paidUsers).toBe(0);
      expect(metrics.estimatedMRR).toBe(0);
      expect(metrics.conversionRate).toBe(0);
    });

    it('Cenário BDD: deve calcular MRR de R$ 9,90 por Pro e R$ 19,90 por Duo', () => {
      const mockUsers: UserProfile[] = [
        { uid: 'u1', email: 'u1@test.com', displayName: 'User 1', photoURL: null, plan: 'free' },
        { uid: 'u2', email: 'u2@test.com', displayName: 'User 2', photoURL: null, plan: 'free' },
        { uid: 'u3', email: 'u3@test.com', displayName: 'User 3', photoURL: null, plan: 'pro' },
        { uid: 'u4', email: 'u4@test.com', displayName: 'User 4', photoURL: null, plan: 'pro' },
        { uid: 'u5', email: 'u5@test.com', displayName: 'User 5', photoURL: null, plan: 'duo' }
      ];

      const metrics = service.calculateSaaSMetrics(mockUsers);

      expect(metrics.totalUsers).toBe(5);
      expect(metrics.freeUsers).toBe(2);
      expect(metrics.proUsers).toBe(2);
      expect(metrics.duoUsers).toBe(1);
      expect(metrics.paidUsers).toBe(3);
      // MRR: (2 * 9.90) + (1 * 19.90) = 19.80 + 19.90 = 39.70
      expect(metrics.estimatedMRR).toBe(39.7);
      // Conversão: (3 / 5) * 100 = 60.0%
      expect(metrics.conversionRate).toBe(60);
    });
  });
});
