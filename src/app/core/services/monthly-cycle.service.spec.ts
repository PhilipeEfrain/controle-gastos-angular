import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MonthlyCycleService } from './monthly-cycle.service';
import { FirebaseService } from './firebase.service';

describe('MonthlyCycleService', () => {
  let service: MonthlyCycleService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    TestBed.configureTestingModule({
      providers: [
        MonthlyCycleService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(MonthlyCycleService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });
});
