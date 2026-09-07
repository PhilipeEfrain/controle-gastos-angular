import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TaxFormModalComponent } from './tax-form-modal.component';
import { TaxService } from '../../../../core/services/tax.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { UserProfile } from '../../../../core/models/user.model';

describe('TaxFormModalComponent', () => {
  let component: TaxFormModalComponent;
  let fixture: ComponentFixture<TaxFormModalComponent>;

  let mockTaxService: any;
  let mockAuthStore: any;

  const mockUser: UserProfile = {
    uid: 'user-tax-1',
    email: 'taxes@finance.com',
    displayName: 'Usuário Tributos',
    photoURL: null
  };

  beforeEach(async () => {
    mockTaxService = {
      addTax: vi.fn().mockResolvedValue('tax-id-1'),
      updateTax: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser)
    };

    await TestBed.configureTestingModule({
      imports: [TaxFormModalComponent],
      providers: [
        { provide: TaxService, useValue: mockTaxService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaxFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve cadastrar um novo tributo anual', async () => {
    component.form.patchValue({
      titulo: 'IPTU 2025',
      valor_orcado: 1200,
      data_vencimento: '2025-02-10',
      ano_referencia: 2025,
      status: 'Pendente'
    });

    let savedEmitted = false;
    component.saved.subscribe(() => savedEmitted = true);

    await component.onSubmit();

    expect(mockTaxService.addTax).toHaveBeenCalledWith(
      'user-tax-1',
      expect.objectContaining({
        titulo: 'IPTU 2025',
        valor_orcado: 1200,
        data_vencimento: '2025-02-10',
        ano_referencia: 2025,
        status: 'Pendente'
      })
    );
    expect(savedEmitted).toBe(true);
  });

  it('deve atualizar um tributo existente quando taxToEdit for informado', async () => {
    fixture.componentRef.setInput('taxToEdit', {
      id: 'tax-99',
      titulo: 'IPVA 2025',
      valor_orcado: 2000,
      valor_pago: 0,
      data_vencimento: '2025-01-20',
      ano_referencia: 2025,
      status: 'Pendente'
    });
    fixture.detectChanges();

    component.form.patchValue({
      status: 'Pago',
      valor_pago: 1950
    });

    await component.onSubmit();

    expect(mockTaxService.updateTax).toHaveBeenCalledWith(
      'user-tax-1',
      'tax-99',
      expect.objectContaining({
        titulo: 'IPVA 2025',
        status: 'Pago',
        valor_pago: 1950
      })
    );
  });
});
