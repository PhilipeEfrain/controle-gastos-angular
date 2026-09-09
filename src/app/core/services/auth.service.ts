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
  updateProfile,
  deleteUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { UserProfile, PlanType, PlanStatus } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private firebaseService = inject(FirebaseService);
  private logger = inject(LoggerService);
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
      role: 'user',
      plan: 'free',
      planStatus: 'active',
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
        if (data['role']) {
          userProfile.role = data['role'];
        }
        if (data['plan']) {
          userProfile.plan = data['plan'];
        }
        if (data['planStatus']) {
          userProfile.planStatus = data['planStatus'];
        }
        if (data['planExpiresAt']) {
          userProfile.planExpiresAt = data['planExpiresAt'];
        }
        if (data['asaasCustomerId']) {
          userProfile.asaasCustomerId = data['asaasCustomerId'];
        }
        if (data['asaasSubscriptionId']) {
          userProfile.asaasSubscriptionId = data['asaasSubscriptionId'];
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
   * Atualiza e persiste a assinatura do usuário (plano, status e identificadores Asaas) no Firestore
   */
  async updateUserSubscription(
    userId: string,
    subscriptionData: {
      plan: PlanType;
      planStatus: PlanStatus;
      asaasCustomerId?: string;
      asaasSubscriptionId?: string;
      planExpiresAt?: string | null;
    }
  ): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${userId}`);
    const updatePayload: Record<string, any> = {
      plan: subscriptionData.plan,
      planStatus: subscriptionData.planStatus,
      updatedAt: new Date().toISOString()
    };

    if (subscriptionData.asaasCustomerId) {
      updatePayload['asaasCustomerId'] = subscriptionData.asaasCustomerId;
    }
    if (subscriptionData.asaasSubscriptionId) {
      updatePayload['asaasSubscriptionId'] = subscriptionData.asaasSubscriptionId;
    }
    if (subscriptionData.planExpiresAt !== undefined) {
      updatePayload['planExpiresAt'] = subscriptionData.planExpiresAt;
    }

    try {
      await setDoc(userDocRef, updatePayload, { merge: true });
    } catch (err) {
      this.logger.error('Erro ao atualizar assinatura no Firestore:', err);
      throw err;
    }
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

  /**
   * Exclusão Definitiva de Conta e Dados em Cascata (Direito ao Esquecimento - LGPD / Art. 18)
   */
  async deleteAccountAndData(userId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
      throw new Error('Usuário não autenticado ou sessão inválida para exclusão.');
    }

    try {
      // 1. Exclui ciclos mensais e subcoleções de despesas
      const ciclosRef = collection(this.firestore, `users/${userId}/ciclos_mensais`);
      const ciclosSnap = await getDocs(ciclosRef);
      for (const cicloDoc of ciclosSnap.docs) {
        const despesasRef = collection(this.firestore, `users/${userId}/ciclos_mensais/${cicloDoc.id}/despesas`);
        const despesasSnap = await getDocs(despesasRef);
        const batch = writeBatch(this.firestore);
        for (const desp of despesasSnap.docs) {
          batch.delete(desp.ref);
        }
        batch.delete(cicloDoc.ref);
        await batch.commit();
      }

      // 2. Exclui tributos e parcelas
      const tributosRef = collection(this.firestore, `users/${userId}/tributos_e_parcelas`);
      const tributosSnap = await getDocs(tributosRef);
      if (!tributosSnap.empty) {
        const batch = writeBatch(this.firestore);
        for (const t of tributosSnap.docs) {
          batch.delete(t.ref);
        }
        await batch.commit();
      }

      // 3. Exclui viagens
      const viagensRef = collection(this.firestore, `users/${userId}/viagens`);
      const viagensSnap = await getDocs(viagensRef);
      if (!viagensSnap.empty) {
        const batch = writeBatch(this.firestore);
        for (const v of viagensSnap.docs) {
          batch.delete(v.ref);
        }
        await batch.commit();
      }

      // 4. Exclui documento de perfil
      const userDocRef = doc(this.firestore, `users/${userId}`);
      await deleteDoc(userDocRef);
    } catch (dbErr) {
      this.logger.error('Erro ao expurgar dados no Firestore durante exclusão de conta:', dbErr);
    }

    // 5. Exclui credencial no Firebase Auth
    await deleteUser(currentUser);
  }
}
