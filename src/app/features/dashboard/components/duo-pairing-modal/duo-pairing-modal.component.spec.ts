import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DuoPairingModalComponent } from './duo-pairing-modal.component';
import { DuoService } from '../../../../core/services/duo.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { DuoGroup } from '../../../../core/models/duo.model';

describe('DuoPairingModalComponent', () => {
  let component: DuoPairingModalComponent;
  let fixture: ComponentFixture<DuoPairingModalComponent>;
  let mockDuoService: any;
  let mockAuthStore: any;
  let mockNotificationService: any;

  const mockPendingGroup: DuoGroup = {
    id: 'grp-1',
    ownerId: 'user-owner',
    ownerEmail: 'owner@test.com',
    ownerName: 'Philipe',
    partnerId: null,
    partnerEmail: null,
    partnerName: null,
    inviteCode: 'DUO-1234',
    status: 'pending'
  };

  const mockActiveGroup: DuoGroup = {
    id: 'grp-1',
    ownerId: 'user-owner',
    ownerEmail: 'owner@test.com',
    ownerName: 'Philipe',
    partnerId: 'user-partner',
    partnerEmail: 'partner@test.com',
    partnerName: 'Mariana',
    inviteCode: 'DUO-1234',
    status: 'active'
  };

  beforeEach(async () => {
    mockDuoService = {
      getDuoGroupForUser: vi.fn().mockResolvedValue(mockPendingGroup),
      createOrGetDuoGroup: vi.fn().mockResolvedValue(mockPendingGroup),
      acceptInvite: vi.fn().mockResolvedValue(mockActiveGroup),
      disconnectPartner: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthStore = {
      currentUser: signal({ uid: 'user-owner', email: 'owner@test.com', displayName: 'Philipe' }),
      isDuo: signal(true)
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DuoPairingModalComponent],
      providers: [
        { provide: DuoService, useValue: mockDuoService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DuoPairingModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('deve ser criado com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 1: deve aceitar código de convite e conectar parceiro', async () => {
    component.inviteCodeInput.set('DUO-1234');
    await component.onAcceptInvite();

    expect(mockDuoService.acceptInvite).toHaveBeenCalledWith(
      'DUO-1234',
      'user-owner',
      'owner@test.com',
      'Philipe'
    );
    expect(mockNotificationService.success).toHaveBeenCalledWith(
      'Contas conectadas com sucesso no Modo Casal! 💕'
    );
  });

  it('deve emitir close ao clicar no backdrop', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    const mockBackdropEvent = {
      target: {
        classList: {
          contains: (cls: string) => cls === 'modal-backdrop'
        }
      }
    } as any;

    component.onBackdropClick(mockBackdropEvent);
    expect(closeSpy).toHaveBeenCalled();
  });
});
