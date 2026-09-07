import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExportModalComponent } from './export-modal.component';
import { ExportService } from '../../../../core/services/export.service';
import { PlanLimitsService } from '../../../../core/services/plan-limits.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { MonthBalanceSummary, Expense } from '../../../../core/models/finance.model';

describe('ExportModalComponent', () => {
  let component: ExportModalComponent;
  let fixture: ComponentFixture<ExportModalComponent>;
  let mockExportService: {
    exportToCSV: any;
    exportToPDF: any;
    exportAnnualDossierPDF: any;
  };
  let canExportPdfSignal = signal<boolean>(true);
  let mockPlanLimitsService: any;
  let mockAuthStore: any;

  const mockSummary: MonthBalanceSummary = {
    q1: {
      quinzena: 1,
      label: '1ª Quinzena (Dia 31)',
      renda: 2500,
      totalGastos: 1000,
      saldo: 1500,
      isDeficit: false,
      percentualGasto: 40
    },
    q2: {
      quinzena: 2,
      label: '2ª Quinzena (Dia 15)',
      renda: 2500,
      totalGastos: 1200,
      saldo: 1300,
      isDeficit: false,
      percentualGasto: 48
    },
    totalRenda: 5000,
    totalGastos: 2200,
    saldoFinal: 2800,
    temDeficitGlobal: false,
    q1CobreQ2: false
  };

  const mockExpenses: Expense[] = [
    {
      id: '1',
      descricao: 'Mercado',
      valor: 450,
      categoria: 'Alimentação',
      quinzena: 1,
      status_pagamento: true,
      tipo: 'despesa',
      createdAt: '2026-09-01'
    }
  ];

  beforeEach(async () => {
    canExportPdfSignal = signal<boolean>(true);

    mockExportService = {
      exportToCSV: vi.fn(),
      exportToPDF: vi.fn(),
      exportAnnualDossierPDF: vi.fn().mockResolvedValue(undefined)
    };

    mockPlanLimitsService = {
      canExportPdf: vi.fn(() => canExportPdfSignal())
    };

    mockAuthStore = {
      currentUser: signal({ uid: 'user-123', displayName: 'Philipe', email: 'philipe@test.com' }),
      isProOrDuo: signal(true)
    };

    await TestBed.configureTestingModule({
      imports: [ExportModalComponent],
      providers: [
        { provide: ExportService, useValue: mockExportService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExportModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('mesAno', '09-2026');
    fixture.componentRef.setInput('expenses', mockExpenses);
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.componentRef.setInput('userName', 'Philipe');
    fixture.detectChanges();
  });

  it('deve ser criado com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve chamar exportService.exportToCSV e emitir close ao clicar em Exportar CSV', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.onExportCSV();

    expect(mockExportService.exportToCSV).toHaveBeenCalledWith('09-2026', mockExpenses, mockSummary);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve chamar exportService.exportToPDF e emitir close ao clicar em Exportar PDF', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.onExportPDF();

    expect(mockExportService.exportToPDF).toHaveBeenCalledWith('09-2026', mockExpenses, mockSummary, 'Philipe');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Cenário BDD 1: deve compilar e exportar Dossiê Anual no Plano PRO', async () => {
    canExportPdfSignal.set(true);
    component.selectedYear.set(2026);

    const closeSpy = vi.spyOn(component.close, 'emit');
    await component.onExportAnnualDossier();

    expect(mockExportService.exportAnnualDossierPDF).toHaveBeenCalledWith(2026, 'user-123', 'Philipe');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('Cenário BDD 2: deve bloquear Dossiê Anual no Plano Free e emitir requestUpgrade', async () => {
    mockPlanLimitsService.canExportPdf.mockReturnValue(false);

    const closeSpy = vi.spyOn(component.close, 'emit');
    const upgradeSpy = vi.spyOn(component.requestUpgrade, 'emit');

    await component.onExportAnnualDossier();

    expect(mockExportService.exportAnnualDossierPDF).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(upgradeSpy).toHaveBeenCalled();
  });

  it('deve fechar modal ao clicar no backdrop', () => {
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

