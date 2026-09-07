export interface UserPreferences {
  theme: 'dark' | 'light';
  currency: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferences?: UserPreferences;
  createdAt?: string;
}
