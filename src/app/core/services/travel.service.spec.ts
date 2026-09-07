import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TravelService } from './travel.service';
import { FirebaseService } from './firebase.service';

describe('TravelService', () => {
  let service: TravelService;
  let mockFirebaseService: any;

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {}
    };

    TestBed.configureTestingModule({
      providers: [
        TravelService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });

    service = TestBed.inject(TravelService);
  });

  it('deve instanciar o serviço de viagens com sucesso', () => {
    expect(service).toBeTruthy();
  });
});
