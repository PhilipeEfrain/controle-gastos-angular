import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TaxService } from './tax.service';
import { FirebaseService } from './firebase.service';

describe('TaxService', () => {
  let service: TaxService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    TestBed.configureTestingModule({
      providers: [
        TaxService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(TaxService);
  });

  it('deve instanciar o serviço de tributos com sucesso', () => {
    expect(service).toBeTruthy();
  });
});
