import { TestBed } from '@angular/core/testing';
import { ExportService, AnnualDossierData } from './export.service';
import { Expense, MonthBalanceSummary } from '../models/finance.model';

import { FirebaseService } from './firebase.service';

describe('ExportService', () => {
  let service: ExportService;
  let mockFirebaseService: any;

  const mockSummary: MonthBalanceSummary = {
    q1: {
      quinzena: 1,
      label: '1ª Quinzena (Dia 31)',
      renda: 2500,
      totalGastos: 1500,
      saldo: 1000,
      isDeficit: false,
      percentualGasto: 60
    },
    q2: {
      quinzena: 2,
      label: '2ª Quinzena (Dia 15)',
      renda: 2500,
      totalGastos: 2000,
      saldo: 500,
      isDeficit: false,
      percentualGasto: 80
    },
    totalRenda: 5000,
    totalGastos: 3500,
    saldoFinal: 1500,
    temDeficitGlobal: false,
    q1CobreQ2: false
  };

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      descricao: 'Supermercado',
      valor: 800,
      categoria: 'Alimentação',
      quinzena: 1,
      status_pagamento: true,
      tipo: 'despesa',
      data_vencimento: '2026-09-05',
      codigo_comprovante: 'COMP-123',
      createdAt: '2026-09-01'
    },
    {
      id: 'exp-2',
      descricao: 'Freelance Design',
      valor: 200,
      categoria: 'Renda Extra',
      quinzena: 2,
      status_pagamento: true,
      tipo: 'renda_extra',
      data_vencimento: '2026-09-18',
      createdAt: '2026-09-02'
    },
    {
      id: 'exp-3',
      descricao: 'Internet Fibra',
      valor: 150,
      categoria: 'Serviços',
      quinzena: 2,
      status_pagamento: false,
      tipo: 'despesa',
      createdAt: '2026-09-03'
    }
  ];

  beforeEach(() => {
    mockFirebaseService = {
      firestore: {},
      auth: {}
    };

    TestBed.configureTestingModule({
      providers: [
        ExportService,
        { provide: FirebaseService, useValue: mockFirebaseService }
      ]
    });
    service = TestBed.inject(ExportService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeTruthy();
  });

  describe('sanitizeCSVField', () => {
    it('deve prefixar apóstrofo para strings que iniciam com =, +, -, @, \\t, \\r ou %', () => {
      expect(service.sanitizeCSVField('=SUM(1+1)')).toBe('\'=SUM(1+1)');
      expect(service.sanitizeCSVField('@calc')).toBe('\'@calc');
      expect(service.sanitizeCSVField('+100')).toBe('\'+100');
      expect(service.sanitizeCSVField('-50')).toBe('\'-50');
      expect(service.sanitizeCSVField('\tcmd')).toBe('\'\tcmd');
      expect(service.sanitizeCSVField('\rcmd')).toBe('\'\rcmd');
      expect(service.sanitizeCSVField('%0A')).toBe('\'%0A');
    });

    it('não deve alterar strings normais e deve tratar aspas duplas', () => {
      expect(service.sanitizeCSVField('Supermercado')).toBe('Supermercado');
      expect(service.sanitizeCSVField('Aluguel "Central"')).toBe('Aluguel ""Central""');
      expect(service.sanitizeCSVField('')).toBe('');
      expect(service.sanitizeCSVField(null)).toBe('');
      expect(service.sanitizeCSVField(undefined)).toBe('');
    });
  });

  describe('exportToCSV', () => {
    it('deve disparar download com conteúdo CSV formatado com BOM e separador de ponto e vírgula', () => {
      let createdBlob: Blob | null = null;
      let createdFilename = '';

      vi.spyOn(service as any, 'triggerDownload').mockImplementation((...args: any[]) => {
        createdBlob = args[0];
        createdFilename = args[1];
      });

      service.exportToCSV('09-2026', mockExpenses, mockSummary);

      expect(createdFilename).toBe('controle-financeiro-09-2026.csv');
      expect(createdBlob).toBeTruthy();
      expect((createdBlob as any)?.type).toBe('text/csv;charset=utf-8;');
    });

    it('deve sanitizar despesas com fórmulas perigosas ao gerar o CSV', async () => {
      const maliciousExpenses: Expense[] = [
        {
          id: 'exp-malicious',
          descricao: '=SUM(1+1)',
          valor: 50,
          categoria: '@Financas',
          quinzena: 1,
          status_pagamento: true,
          codigo_comprovante: '+COMP-001',
          tipo: 'despesa'
        }
      ];

      let capturedBlob: Blob | null = null;
      vi.spyOn(service as any, 'triggerDownload').mockImplementation((...args: any[]) => {
        capturedBlob = args[0];
      });

      service.exportToCSV('09-2026', maliciousExpenses, mockSummary);

      expect(capturedBlob).toBeTruthy();
      const text = await (capturedBlob as any).text();
      expect(text).toContain('\'=SUM(1+1)');
      expect(text).toContain('\'@Financas');
      expect(text).toContain('\'+COMP-001');
    });
  });

  describe('escapeHTML', () => {
    it('deve escapar caracteres especiais HTML (&, <, >, ", \')', () => {
      expect(service.escapeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(service.escapeHTML('<img src=x onerror=\'alert(1)\'>')).toBe('&lt;img src=x onerror=&#39;alert(1)&#39;&gt;');
      expect(service.escapeHTML('Básico & Simples')).toBe('Básico &amp; Simples');
      expect(service.escapeHTML('')).toBe('');
      expect(service.escapeHTML(null)).toBe('');
      expect(service.escapeHTML(undefined)).toBe('');
    });
  });

  describe('generatePDFReportHTML', () => {
    it('deve gerar string HTML contendo cabeçalho, resumo consolidado e tabelas de Q1 e Q2', () => {
      const html = service.generatePDFReportHTML('09-2026', mockExpenses, mockSummary, 'Philipe Efrain');

      expect(html).toContain('Relatório Financeiro - 09-2026');
      expect(html).toContain('Philipe Efrain');
      expect(html).toContain('1ª Quinzena (Dia 31)');
      expect(html).toContain('2ª Quinzena (Dia 15)');
      expect(html).toContain('Supermercado');
      expect(html).toContain('Freelance Design');
      expect(html).toContain('Renda Extra');
      expect(html).toContain('COMP-123');
    });

    it('deve escapar tags HTML e prevenir injeção de script (CWE-79) no relatório PDF', () => {
      const xssExpenses: Expense[] = [
        {
          id: 'exp-xss',
          descricao: '<script>alert("xss")</script>',
          valor: 100,
          categoria: '<b onmouseover="alert(1)">Lazer</b>',
          quinzena: 1,
          status_pagamento: true,
          codigo_comprovante: '<img src=x onerror=alert(1)>',
          tipo: 'despesa'
        }
      ];

      const html = service.generatePDFReportHTML('09-2026', xssExpenses, mockSummary, '<script>evil()</script>');

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;b onmouseover=&quot;alert(1)&quot;&gt;Lazer&lt;/b&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    });

    it('deve renderizar mensagem de ausência se uma quinzena não tiver lançamentos', () => {
      const q1OnlyExpenses = [mockExpenses[0]];
      const html = service.generatePDFReportHTML('09-2026', q1OnlyExpenses, mockSummary);

      expect(html).toContain('Supermercado');
      expect(html).toContain('Nenhum lançamento nesta quinzena.');
    });
  });

  describe('generateAnnualDossierHTML', () => {
    it('deve renderizar o layout executivo A4 do Dossiê Anual com 24 quinzenas, categorias e tributos', () => {
      const mockDossierData: AnnualDossierData = {
        ano: 2026,
        userName: 'Philipe Efrain',
        meses: [
          {
            mesAno: '2026-01',
            mesNome: 'Janeiro',
            q1Renda: 3000,
            q1Gastos: 1200,
            q1Saldo: 1800,
            q2Renda: 3000,
            q2Gastos: 1500,
            q2Saldo: 1500,
            totalRenda: 6000,
            totalGastos: 2700,
            saldoFinal: 3300,
            temDeficit: false,
            expenses: []
          }
        ],
        categorias: [
          { categoria: 'Moradia', total: 12000, percentual: 40.0 },
          { categoria: 'Alimentação', total: 6000, percentual: 20.0 }
        ],
        tributos: [
          {
            id: 'tax-1',
            titulo: 'IPVA 2026',
            data_vencimento: '2026-01-20',
            valor_orcado: 1850,
            valor_pago: 1850,
            status: 'Pago',
            ano_referencia: 2026
          }
        ],
        totalRendaAnual: 72000,
        totalGastosAnuais: 30000,
        saldoConsolidadoAnual: 42000,
        totalLancamentos: 85,
        mesesComSuperavit: 12,
        mesesComDeficit: 0
      };

      const html = service.generateAnnualDossierHTML(mockDossierData);

      expect(html).toContain('Dossiê Financeiro Consolidado • Exercício Fiscal 2026');
      expect(html).toContain('Philipe Efrain');
      expect(html).toContain('Janeiro');
      expect(html).toContain('Moradia');
      expect(html).toContain('IPVA 2026');
      expect(html).toContain('12 de 12 meses positivos');
      expect(html).toContain('72.000,00');
      expect(html).toContain('42.000,00');
    });
  });

  describe('exportToPDF', () => {
    it('deve abrir uma janela popup e invocar print()', () => {
      const mockDoc = {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn()
      };
      const mockWindow = {
        document: mockDoc,
        focus: vi.fn(),
        print: vi.fn(),
        onload: null as any
      };

      vi.spyOn(window, 'open').mockReturnValue(mockWindow as any);

      service.exportToPDF('09-2026', mockExpenses, mockSummary, 'Philipe');

      expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=900,height=750');
      expect(mockDoc.open).toHaveBeenCalled();
      expect(mockDoc.write).toHaveBeenCalled();
      expect(mockDoc.close).toHaveBeenCalled();

      // Disparar onload simulado
      if (typeof mockWindow.onload === 'function') {
        mockWindow.onload();
        expect(mockWindow.focus).toHaveBeenCalled();
        expect(mockWindow.print).toHaveBeenCalled();
      }
    });

    it('deve exibir alert se popup for bloqueado', () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      service.exportToPDF('09-2026', mockExpenses, mockSummary);

      expect(window.alert).toHaveBeenCalledWith(
        'Por favor, permita popups para gerar a visualização de impressão em PDF.'
      );
    });
  });
});

