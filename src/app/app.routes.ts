import { Routes } from '@angular/router';
import { publicGuard } from './core/guards/public.guard';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.component').then(m => m.AuthComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'tributos',
    loadComponent: () =>
      import('./features/taxes/taxes.component').then(m => m.TaxesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'viagens',
    loadComponent: () =>
      import('./features/travel/travel.component').then(m => m.TravelComponent),
    canActivate: [authGuard]
  },
  {
    path: 'parcelamentos',
    loadComponent: () =>
      import('./features/installments/installments.component').then(m => m.InstallmentsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'configuracoes',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
