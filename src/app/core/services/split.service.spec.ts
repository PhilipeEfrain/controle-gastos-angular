import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SplitService } from './split.service';
import { FirebaseService } from './firebase.service';

describe('SplitService', () => {
  let service: SplitService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {},
      auth: {}
    };

    TestBed.configureTestingModule({
      providers: [
        SplitService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(SplitService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeTruthy();
  });

  describe('generateViewToken', () => {
    it('deve gerar um token alfanumérico com 20 caracteres', () => {
      const token = service.generateViewToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(20);
      expect(token).toMatch(/^[a-zA-Z0-9]{20}$/);
    });

    it('tokens consecutivos devem ser únicos', () => {
      const token1 = service.generateViewToken();
      const token2 = service.generateViewToken();
      expect(token1).not.toBe(token2);
    });
  });
});
