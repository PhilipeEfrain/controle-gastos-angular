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
      isDuo: signal(true),
      updateCurrentUser: vi.fn()
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

  it('Cenário BDD 1: deve aceitar código de convite, conectar parceiro e atualizar plano local', async () => {
    component.inviteCodeInput.set('DUO-1234');
    await component.onAcceptInvite();

    expect(mockDuoService.acceptInvite).toHaveBeenCalledWith(
      'DUO-1234',
      'user-owner',
      'owner@test.com',
      'Philipe'
    );
    expect(mockAuthStore.updateCurrentUser).toHaveBeenCalledWith({
      plan: 'duo',
      planStatus: 'active'
    });
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

  it('Cenário BDD 2: deve abrir WhatsApp com mensagem, código de convite e link direto', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    component.currentGroup.set(mockPendingGroup);

    component.onShareWhatsApp();

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.whatsapp.com/send?text='),
      '_blank',
      'noopener,noreferrer'
    );
    const calledUrl = String(windowOpenSpy.mock.calls[0][0] || '');
    const decodedMessage = decodeURIComponent(calledUrl);
    expect(decodedMessage).toContain('https://app.quinzena.com.br/dashboard?duoCode=DUO-1234');
    expect(decodedMessage).toContain('DUO-1234');
    expect(mockNotificationService.info).toHaveBeenCalledWith(
      'Abrindo WhatsApp para enviar o convite...'
    );
  });

  it('Cenário BDD 3: deve salvar o e-mail do parceiro quando informado corretamente', async () => {
    mockDuoService.updatePartnerEmail = vi.fn().mockResolvedValue(undefined);
    component.currentGroup.set(mockPendingGroup);
    component.partnerEmailInput.set('mariana@casal.com');

    await component.onSavePartnerEmail();

    expect(mockDuoService.updatePartnerEmail).toHaveBeenCalledWith('grp-1', 'mariana@casal.com');
    expect(component.currentGroup()?.partnerEmail).toBe('mariana@casal.com');
    expect(mockNotificationService.success).toHaveBeenCalledWith('E-mail do parceiro salvo com sucesso! 💕');
  });

  it('Cenário BDD 4: deve rejeitar salvamento de e-mail com formato inválido', async () => {
    component.currentGroup.set(mockPendingGroup);
    component.partnerEmailInput.set('email-invalido');

    await component.onSavePartnerEmail();

    expect(mockNotificationService.error).toHaveBeenCalledWith('Por favor, informe um e-mail válido para o(a) parceiro(a).');
  });

  it('Cenário BDD 5 (CARD-062): deve preencher inviteCodeInput a partir de initialInviteCode', async () => {
    const newFixture = TestBed.createComponent(DuoPairingModalComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.componentRef.setInput('initialInviteCode', 'DUO-5555');
    newFixture.componentRef.setInput('isOpen', true);
    newFixture.detectChanges();

    expect(newComponent.inviteCodeInput()).toBe('DUO-5555');
  });
});
