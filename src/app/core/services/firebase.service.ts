import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);

    // Habilita persistência offline via IndexedDB com suporte a múltiplas abas (PWA / Offline First)
    let localCacheConfig;
    try {
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        localCacheConfig = persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        });
      } else {
        localCacheConfig = memoryLocalCache();
      }
    } catch {
      localCacheConfig = memoryLocalCache();
    }

    // Inicializa o Firestore com long-polling forçado para compatibilidade WebChannel e persistência offline
    this.firestore = initializeFirestore(this.app, {
      localCache: localCacheConfig,
      experimentalForceLongPolling: true
    });
  }
}
