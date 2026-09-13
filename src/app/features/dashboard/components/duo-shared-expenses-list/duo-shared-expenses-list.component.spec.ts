import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuoSharedExpensesListComponent } from './duo-shared-expenses-list.component';
import { DuoSharedExpense } from '../../../../core/models/duo.model';

describe('DuoSharedExpensesListComponent', () => {
  let component: DuoSharedExpensesListComponent;
  let fixture: ComponentFixture<DuoSharedExpensesListComponent>;

  const mockSharedExpenses: DuoSharedExpense[] = [
    {
      id: 'shared-1',
      descricao: 'Geladeira Frost Free',
      valorTotal: 200,
      valorOwner: 100,
      valorPartner: 100,
      categoria: 'Casa',
      quinzena: 1,
      mesAno: '2026-09',
      pagoPorId: 'user-owner',
      pagoPorNome: 'Philipe',
      tipoDivisao: '50_50',
      isParcelado: true,
      parcelaAtual: 3,
      totalParcelas: 10,
      status_pagamento: false,
      members: ['user-owner', 'user-partner']
    },
    {
      id: 'shared-2',
      descricao: 'Fogão 4 Bocas',
      valorTotal: 150,
      valorOwner: 75,
      valorPartner: 75,
      categoria: 'Casa',
      quinzena: 2,
      mesAno: '2026-09',
      pagoPorId: 'user-partner',
      pagoPorNome: 'Mariana',
      tipoDivisao: '50_50',
      isParcelado: true,
      parcelaAtual: 1,
      totalParcelas: 5,
      status_pagamento: true,
      members: ['user-owner', 'user-partner']
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DuoSharedExpensesListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DuoSharedExpensesListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sharedExpenses', mockSharedExpenses);
    fixture.componentRef.setInput('currentUserId', 'user-owner');
    fixture.componentRef.setInput('isOwner', true);
    fixture.componentRef.setInput('ownerName', 'Philipe');
    fixture.componentRef.setInput('partnerName', 'Mariana');
    fixture.detectChanges();
  });

  it('deve ser criado com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('Cenário BDD: deve renderizar as compras compartilhadas (Geladeira e Fogão) com totais e parcelas', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nossos Gastos (Compras & Contas do Casal)');
    expect(el.textContent).toContain('Geladeira Frost Free');
    expect(el.textContent).toContain('3/10 parcelas');
    expect(el.textContent).toContain('Fogão 4 Bocas');
    expect(el.textContent).toContain('1/5 parcelas');

    // Totais calculados
    expect(component.totalShared()).toBe(350);
    expect(component.myShare()).toBe(175);
    expect(component.partnerShare()).toBe(175);

    expect(el.textContent).toContain('350,00');
    expect(el.textContent).toContain('175,00');
  });

  it('deve exibir empty state quando não houver compras compartilhadas', () => {
    fixture.componentRef.setInput('sharedExpenses', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nenhum gasto compartilhado neste mês');
  });

  it('deve emitir addSharedExpense ao clicar no botão de adicionar', () => {
    const spy = vi.spyOn(component.addSharedExpense, 'emit');
    const btn = fixture.nativeElement.querySelector('.btn-add-shared') as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalled();
  });

  it('deve emitir togglePayment ao clicar no botão de quitação', () => {
    const spy = vi.spyOn(component.togglePayment, 'emit');
    const btnCheck = fixture.nativeElement.querySelector('.btn-check') as HTMLButtonElement;
    btnCheck.click();

    expect(spy).toHaveBeenCalledWith({
      mesAno: '2026-09',
      id: 'shared-1',
      status: true
    });
  });

  it('deve abrir modal de confirmação ao clicar no botão de exclusão e emitir deleteExpense ao confirmar', () => {
    const spy = vi.spyOn(component.deleteExpense, 'emit');
    const btnDelete = fixture.nativeElement.querySelector('.btn-delete') as HTMLButtonElement;
    btnDelete.click();

    expect(component.isDeleteModalOpen()).toBe(true);
    expect(component.itemToDelete()?.id).toBe('shared-1');
    expect(spy).not.toHaveBeenCalled();

    // Confirma exclusão
    component.confirmDelete();
    expect(spy).toHaveBeenCalledWith({
      mesAno: '2026-09',
      id: 'shared-1'
    });
    expect(component.isDeleteModalOpen()).toBe(false);
  });

  it('deve fechar modal sem emitir evento ao cancelar exclusão', () => {
    const spy = vi.spyOn(component.deleteExpense, 'emit');
    component.onDelete(mockSharedExpenses[0]);
    expect(component.isDeleteModalOpen()).toBe(true);

    component.cancelDelete();
    expect(component.isDeleteModalOpen()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
