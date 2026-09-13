import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuoSettlementCardComponent } from './duo-settlement-card.component';
import { DuoGroup, DuoSettlementSummary } from '../../../../core/models/duo.model';

describe('DuoSettlementCardComponent', () => {
  let component: DuoSettlementCardComponent;
  let fixture: ComponentFixture<DuoSettlementCardComponent>;

  const mockGroup: DuoGroup = {
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

  const mockSettlement: DuoSettlementSummary = {
    ownerId: 'user-owner',
    ownerName: 'Philipe',
    ownerTotalPaid: 3000,
    partnerId: 'user-partner',
    partnerName: 'Mariana',
    partnerTotalPaid: 1000,
    totalShared: 4000,
    targetSharePerPerson: 2000,
    debtor: 'partner',
    settlementAmount: 1000,
    message: 'Mariana deve transferir R$ 1.000,00 para Philipe.'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DuoSettlementCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DuoSettlementCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', mockGroup);
    fixture.componentRef.setInput('settlement', mockSettlement);
    fixture.detectChanges();
  });

  it('deve ser criado com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD 2: deve renderizar as despesas compartilhadas do casal e percentuais sem compensação sugerida', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('MODO CASAL 💕');
    expect(el.textContent).toContain('Despesas Compartilhadas do Casal');
    expect(el.textContent).toContain('Philipe');
    expect(el.textContent).toContain('Mariana');
    expect(el.textContent).toContain('3.000,00');
    expect(el.textContent).toContain('1.000,00');
    expect(el.textContent).not.toContain('Compensação Sugerida');
    expect(el.textContent).not.toContain('Mariana deve transferir R$ 1.000,00 para Philipe.');
    expect(el.textContent).not.toContain('transferir');

    expect(component.ownerPercent()).toBe(75);
    expect(component.partnerPercent()).toBe(25);
  });

  it('deve emitir openPairingModal ao clicar no botão de pareamento', () => {
    const spy = vi.spyOn(component.openPairingModal, 'emit');
    const btn = fixture.nativeElement.querySelector('.btn-manage-duo') as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalled();
  });
});
