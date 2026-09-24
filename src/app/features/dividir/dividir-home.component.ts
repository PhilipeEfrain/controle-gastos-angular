import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SplitService } from '../../core/services/split.service';
import { AuthStore } from '../../core/state/auth.store';
import { NotificationService } from '../../core/services/notification.service';
import { SplitGroup, PixKeyType } from '../../core/models/split-group.model';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { formatBRL } from '../../core/utils/formatters';

import { DividirRestauranteComponent } from './dividir-restaurante.component';
import { AdBannerComponent } from '../../shared/components/ad-banner/ad-banner.component';

@Component({
  selector: 'app-dividir-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AppCardComponent,
    BrandLogoComponent,
    DividirRestauranteComponent,
    AdBannerComponent
  ],
  templateUrl: './dividir-home.component.html',
  styleUrls: ['./dividir-home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DividirHomeComponent implements OnInit {
  private splitService = inject(SplitService);
  private authStore = inject(AuthStore);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  readonly activeTab = signal<'role' | 'restaurante'>('role');

  readonly currentUser = this.authStore.currentUser;
  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly isProOrDuo = this.authStore.isProOrDuo;
  readonly showAds = computed(() => !this.authStore.isProOrDuo());

  readonly groups = signal<SplitGroup[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isCreateModalOpen = signal<boolean>(false);

  // Form State
  groupTitle = '';
  groupDescription = '';
  ownerPixKey = '';
  ownerPixKeyType: PixKeyType = 'aleatoria';
  
  participantsList: Array<{ name: string; pixKey: string; pixKeyType: PixKeyType }> = [];
  newParticipantName = '';
  newParticipantPix = '';
  newParticipantPixType: PixKeyType = 'aleatoria';

  async ngOnInit(): Promise<void> {
    await this.loadUserGroups();
  }

  async loadUserGroups(): Promise<void> {
    const user = this.currentUser();
    if (!user) {
      this.isLoading.set(false);
      return;
    }

    try {
      this.isLoading.set(true);
      const list = await this.splitService.getGroupsForUser(user.uid);
      this.groups.set(list);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
      this.notificationService.show('Não foi possível carregar seus grupos de divisão.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  openCreateModal(): void {
    if (!this.isAuthenticated()) {
      this.notificationService.show('Faça login ou crie sua conta no Quinzena para criar um grupo de divisão.', 'warning');
      this.router.navigate(['/auth'], { queryParams: { redirect: '/dividir' } });
      return;
    }

    this.groupTitle = '';
    this.groupDescription = '';
    this.ownerPixKey = '';
    this.participantsList = [];
    this.newParticipantName = '';
    this.newParticipantPix = '';
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  addParticipantToForm(): void {
    const name = this.newParticipantName.trim();
    if (!name) return;

    this.participantsList.push({
      name,
      pixKey: this.newParticipantPix.trim(),
      pixKeyType: this.newParticipantPixType
    });

    this.newParticipantName = '';
    this.newParticipantPix = '';
  }

  removeParticipantFromForm(index: number): void {
    this.participantsList.splice(index, 1);
  }

  async submitCreateGroup(): Promise<void> {
    const title = this.groupTitle.trim();
    if (!title) {
      this.notificationService.show('Informe o nome do grupo ou evento.', 'warning');
      return;
    }

    const user = this.currentUser();
    if (!user) return;

    try {
      const created = await this.splitService.createGroup(
        title,
        this.groupDescription,
        user.uid,
        user.displayName || 'Anfitrião',
        this.ownerPixKey.trim(),
        this.ownerPixKeyType,
        this.participantsList
      );

      this.notificationService.success('Grupo de divisão criado com sucesso!');
      this.closeCreateModal();
      this.router.navigate(['/dividir', created.id], { queryParams: { t: created.viewToken } });
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
      this.notificationService.show('Ocorreu um erro ao criar o grupo.', 'error');
    }
  }

  formatMoney(val: number | undefined): string {
    return formatBRL(val || 0);
  }
}
