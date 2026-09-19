import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FirebaseService } from './firebase.service';

describe('FirebaseService (Segregação de Ambientes)', () => {
  let service: FirebaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FirebaseService]
    });
    service = TestBed.inject(FirebaseService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('deve expor instâncias válidas de app, auth e firestore', () => {
    expect(service.app).toBeTruthy();
    expect(service.auth).toBeTruthy();
    expect(service.firestore).toBeTruthy();
  });
});
