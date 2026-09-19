import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly functions: Functions;
  readonly storage: FirebaseStorage;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.functions = getFunctions(this.app);
    this.storage = getStorage(this.app);

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

    // Inicializa o Firestore com persistência offline e streaming WebChannel nativo
    try {
      this.firestore = initializeFirestore(this.app, {
        localCache: localCacheConfig
      });
    } catch {
      this.firestore = getFirestore(this.app);
    }

    // Segregação e Blindagem de Ambientes: Emuladores Locais ou Projeto Cloud Dedicado
    if (!environment.production && (environment as any).useEmulators) {
      try {
        connectAuthEmulator(this.auth, 'http://localhost:9099', { disableWarnings: true });
        connectFirestoreEmulator(this.firestore, 'localhost', 8080);
        connectFunctionsEmulator(this.functions, 'localhost', 5001);
        connectStorageEmulator(this.storage, 'localhost', 9199);
        console.info(
          '%c[Firebase] 🛡️ Suíte de Emuladores Conectada com Sucesso!\n' +
          '• Auth: http://localhost:9099\n' +
          '• Firestore: http://localhost:8080\n' +
          '• Functions: http://localhost:5001\n' +
          '• Storage: http://localhost:9199\n' +
          '• Emulator UI: http://localhost:4000',
          'background: #065f46; color: #a7f3d0; font-weight: bold; padding: 6px 10px; border-radius: 6px;'
        );
      } catch (emulatorErr) {
        console.warn('[Firebase] Aviso ao conectar aos emuladores:', emulatorErr);
      }
    } else if (!environment.production) {
      if (environment.firebase.projectId === 'controle-gastos-app-36264') {
        console.warn(
          '%c⚠️ ALERTA DE SEGURANÇA: Ambiente de desenvolvimento conectado ao projeto de PRODUÇÃO (controle-gastos-app-36264)! Para evitar riscos, defina o projeto dev em environment.ts ou useEmulators: true.',
          'background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
        );
      } else {
        console.info(
          `%c[Firebase] Ambiente Dev / Sandbox conectado: ${environment.firebase.projectId}`,
          'background: #1e3a8a; color: #bfdbfe; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
        );
      }
    }
  }
}
