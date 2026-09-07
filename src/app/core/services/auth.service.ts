import { Injectable, inject } from '@angular/core';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { UserProfile } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private firebaseService = inject(FirebaseService);
  private auth = this.firebaseService.auth;
  private firestore = this.firebaseService.firestore;

  /**
   * Observable com as mudanças de estado de autenticação
   */
  authState$(): Observable<User | null> {
    return new Observable(subscriber => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        user => subscriber.next(user),
        error => subscriber.error(error)
      );
      return { unsubscribe };
    });
  }

  /**
   * Login via Google Popup
   */
  async loginWithGoogle(): Promise<UserProfile> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(this.auth, provider);
    return this.syncUserProfile(result.user);
  }

  /**
   * Login com E-mail e Senha
   */
  async loginWithEmail(email: string, password: string): Promise<UserProfile> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return this.syncUserProfile(result.user);
  }

  /**
   * Cadastro com E-mail, Senha e Nome
   */
  async registerWithEmail(email: string, password: string, displayName: string): Promise<UserProfile> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }

    return this.syncUserProfile(result.user, displayName);
  }

  /**
   * Envio de e-mail para recuperação de senha
   */
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  /**
   * Logout do usuário
   */
  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /**
   * Sincroniza os dados do usuário autenticado no documento Firestore users/{userId}
   */
  async syncUserProfile(user: User, fallbackName?: string): Promise<UserProfile> {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || fallbackName || 'Usuário',
      photoURL: user.photoURL,
      preferences: { theme: 'dark', currency: 'BRL' },
      createdAt: new Date().toISOString()
    };

    try {
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const existingSnap = await getDoc(userDocRef);

      if (existingSnap.exists()) {
        const data = existingSnap.data();
        if (data['preferences']) {
          userProfile.preferences = data['preferences'];
        }
        if (data['createdAt']) {
          userProfile.createdAt = data['createdAt'];
        }
      }

      // Salva ou atualiza os dados no Firestore com merge
      await setDoc(userDocRef, userProfile, { merge: true });
    } catch (firestoreError) {
      console.warn('Aviso: Não foi possível sincronizar o perfil no Firestore (banco pode não estar criado ou regras pendentes). Prosseguindo com login:', firestoreError);
    }

    return userProfile;
  }

  /**
   * Atualiza dados de perfil (nome, foto e preferências) no Firebase Auth e Firestore
   */
  async updateProfileData(
    userId: string,
    data: { displayName?: string; photoURL?: string; preferences?: any }
  ): Promise<UserProfile> {
    const currentUser = this.auth.currentUser;

    if (currentUser) {
      const authUpdates: { displayName?: string; photoURL?: string } = {};
      if (data.displayName !== undefined) authUpdates.displayName = data.displayName;
      if (data.photoURL !== undefined) authUpdates.photoURL = data.photoURL;

      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(currentUser, authUpdates);
      }
    }

    const userDocRef = doc(this.firestore, `users/${userId}`);
    const updatePayload: Record<string, any> = { ...data, updatedAt: new Date().toISOString() };

    try {
      await setDoc(userDocRef, updatePayload, { merge: true });
    } catch (err) {
      console.warn('Erro ao atualizar perfil no Firestore:', err);
    }

    const updatedSnap = await getDoc(userDocRef);
    if (updatedSnap.exists()) {
      return updatedSnap.data() as UserProfile;
    }

    return {
      uid: userId,
      email: currentUser?.email || null,
      displayName: data.displayName ?? currentUser?.displayName ?? 'Usuário',
      photoURL: data.photoURL ?? currentUser?.photoURL ?? null,
      preferences: data.preferences ?? { theme: 'dark', currency: 'BRL' }
    };
  }
}
