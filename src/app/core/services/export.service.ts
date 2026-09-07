import { Injectable, inject } from '@angular/core';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Expense, MonthBalanceSummary, MonthlyCycle, AnnualTax } from '../models/finance.model';
import { formatBRL } from '../utils/formatters';
import { roundBRL, calculateGlobalBalance } from '../utils/calculations';
import { FirebaseService } from './firebase.service';

export interface AnnualMonthSummary {
  mesAno: string;
  mesNome: string;
  q1Renda: number;
  q1Gastos: number;
  q1Saldo: number;
  q2Renda: number;
  q2Gastos: number;
  q2Saldo: number;
  totalRenda: number;
  totalGastos: number;
  saldoFinal: number;
  temDeficit: boolean;
  expenses: Expense[];
}

export interface AnnualCategorySummary {
  categoria: string;
  total: number;
  percentual: number;
}

export interface AnnualDossierData {
  ano: number;
  userName?: string;
  meses: AnnualMonthSummary[];
  categorias: AnnualCategorySummary[];
  tributos: AnnualTax[];
  totalRendaAnual: number;
  totalGastosAnuais: number;
  saldoConsolidadoAnual: number;
  totalLancamentos: number;
  mesesComSuperavit: number;
  mesesComDeficit: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private firebaseService = inject(FirebaseService, { optional: true });

  private readonly monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  /**
   * Sanitiza campo textual contra CSV / Excel Formula Injection (CWE-1236).
   * Se o valor iniciar com =, +, -, @, \t, \r ou %, prefixa com apóstrofo (')
   * para forçar o software de planilhas a interpretá-lo estritamente como texto puro.
   */
  sanitizeCSVField(value: string | undefined | null): string {
    if (!value) return '';
    const str = String(value);
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '%'];
    const firstChar = str.charAt(0);
    const sanitized = dangerousPrefixes.includes(firstChar) ? `'${str}` : str;
    return sanitized.replace(/"/g, '""');
  }

  /**
   * Exporta os dados do ciclo em formato CSV (UTF-8 com BOM para Excel)
   */
  exportToCSV(mesAno: string, expenses: Expense[], summary: MonthBalanceSummary): void {
    const lines: string[] = [];

    // Cabeçalho de Identificação e Resumo
    lines.push(`Relatório Financeiro Quinzenal - Ciclo ${mesAno}`);
    lines.push(`Gerado em:;${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    lines.push(`RESUMO CONSOLIDADO`);
    lines.push(`Renda 1ª Quinzena (Dia 31):;${formatBRL(summary.q1.renda)}`);
    lines.push(`Renda 2ª Quinzena (Dia 15):;${formatBRL(summary.q2.renda)}`);
    lines.push(`Renda Total do Mês:;${formatBRL(summary.totalRenda)}`);
    lines.push(`Total de Gastos do Mês:;${formatBRL(summary.totalGastos)}`);
    lines.push(`Saldo Consolidado:;${formatBRL(summary.saldoFinal)}`);
    lines.push(`Situação:;${summary.temDeficitGlobal ? 'Déficit' : 'Superavitário'}`);
    lines.push('');

    // Cabeçalho da Tabela de Lançamentos
    lines.push('DETALHAMENTO DOS LANÇAMENTOS');
    lines.push('Quinzena;Tipo;Descrição;Categoria;Valor (R$);Status;Comprovante;Vencimento');

    const sortedExpenses = [...expenses].sort((a, b) => (a.quinzena - b.quinzena) || a.descricao.localeCompare(b.descricao));

    for (const exp of sortedExpenses) {
      const quinzenaStr = exp.quinzena === 1 ? '1ª Quinzena (Dia 31)' : '2ª Quinzena (Dia 15)';
      const tipoStr = exp.tipo === 'renda_extra' ? 'Renda Extra' : 'Despesa';
      const descStr = `"${this.sanitizeCSVField(exp.descricao)}"`;
      const catStr = `"${this.sanitizeCSVField(exp.categoria || 'Outros')}"`;
      const valorStr = formatBRL(exp.valor).replace('R$', '').trim();
      const statusStr = exp.status_pagamento ? 'Pago / Recebido' : 'Pendente';
      const compStr = exp.codigo_comprovante ? `"${this.sanitizeCSVField(exp.codigo_comprovante)}"` : '-';
      const vencStr = exp.data_vencimento || '-';

      lines.push(`${quinzenaStr};${tipoStr};${descStr};${catStr};${valorStr};${statusStr};${compStr};${vencStr}`);
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `controle-financeiro-${mesAno}.csv`;

    this.triggerDownload(blob, filename);
  }

  /**
   * Dispara a impressão / exportação de relatório mensal em PDF com layout A4 profissional
   */
  exportToPDF(
    mesAno: string,
    expenses: Expense[],
    summary: MonthBalanceSummary,
    userName?: string
  ): void {
    const htmlContent = this.generatePDFReportHTML(mesAno, expenses, summary, userName);
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      alert('Por favor, permita popups para gerar a visualização de impressão em PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  /**
   * Compila e busca os dados de todas as 24 quinzenas do ano fiscal no Firestore
   */
  async fetchAnnualDossierData(ano: number, userId: string, userName?: string): Promise<AnnualDossierData> {
    if (!this.firebaseService) {
      throw new Error('Serviço Firebase não disponível para compilação do Dossiê.');
    }

    const db = this.firebaseService.firestore;
    const mesesSummaries: AnnualMonthSummary[] = [];
    const allYearExpenses: Expense[] = [];

    let totalRendaAnual = 0;
    let totalGastosAnuais = 0;
    let mesesComSuperavit = 0;
    let mesesComDeficit = 0;

    // 1. Busca dados dos 12 meses do ano fiscal
    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m).padStart(2, '0');
      const mesAno = `${ano}-${mesStr}`;
      const mesNome = this.monthNames[m - 1];

      // Busca documento do ciclo
      const cycleRef = doc(db, `users/${userId}/ciclos_mensais/${mesAno}`);
      const cycleSnap = await getDoc(cycleRef);
      const cycleData = cycleSnap.exists() ? (cycleSnap.data() as Partial<MonthlyCycle>) : null;

      const baseRendaQ1 = cycleData?.renda_quinzena_1 || 0;
      const baseRendaQ2 = cycleData?.renda_quinzena_2 || 0;

      // Busca despesas do mês
      const expensesRef = collection(db, `users/${userId}/ciclos_mensais/${mesAno}/despesas`);
      const expensesSnap = await getDocs(expensesRef);
      const monthExpenses: Expense[] = expensesSnap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Expense, 'id'>)
      }));

      // Calcula balanço com utilitário oficial
      const balance = calculateGlobalBalance(baseRendaQ1, baseRendaQ2, monthExpenses);

      mesesSummaries.push({
        mesAno,
        mesNome,
        q1Renda: balance.q1.renda,
        q1Gastos: balance.q1.totalGastos,
        q1Saldo: balance.q1.saldo,
        q2Renda: balance.q2.renda,
        q2Gastos: balance.q2.totalGastos,
        q2Saldo: balance.q2.saldo,
        totalRenda: balance.totalRenda,
        totalGastos: balance.totalGastos,
        saldoFinal: balance.saldoFinal,
        temDeficit: balance.temDeficitGlobal,
        expenses: monthExpenses
      });

      allYearExpenses.push(...monthExpenses);
      totalRendaAnual = roundBRL(totalRendaAnual + balance.totalRenda);
      totalGastosAnuais = roundBRL(totalGastosAnuais + balance.totalGastos);

      if (balance.totalRenda > 0 || balance.totalGastos > 0) {
        if (balance.temDeficitGlobal) {
          mesesComDeficit++;
        } else {
          mesesComSuperavit++;
        }
      }
    }

    // 2. Busca Tributos e Gastos Anuais
    const taxesRef = collection(db, `users/${userId}/tributos_e_parcelas`);
    const taxesSnap = await getDocs(taxesRef);
    const tributos: AnnualTax[] = [];

    taxesSnap.forEach(d => {
      const data = d.data() as any;
      if (data.tipo === 'tributo' || !data.tipo) {
        // Checa se pertence ao ano de referência ou se a data de vencimento é do ano
        const anoVencimento = data.data_vencimento ? parseInt(data.data_vencimento.split('-')[0], 10) : null;
        if (data.ano_referencia === ano || anoVencimento === ano) {
          tributos.push({
            id: d.id,
            titulo: data.titulo || data.descricao || 'Tributo',
            data_vencimento: data.data_vencimento || '',
            valor_orcado: data.valor_orcado || data.valor || 0,
            valor_pago: data.valor_pago || 0,
            status: data.status || 'Pendente',
            data_pagamento: data.data_pagamento,
            ano_referencia: data.ano_referencia || ano
          });
        }
      }
    });

    // 3. Agrupamento e ranking por Categoria
    const categoryMap = new Map<string, number>();
    const despesasOnly = allYearExpenses.filter(e => e.tipo !== 'renda_extra');

    for (const exp of despesasOnly) {
      const cat = exp.categoria || 'Outros';
      const current = categoryMap.get(cat) || 0;
      categoryMap.set(cat, roundBRL(current + (exp.valor || 0)));
    }

    const categorias: AnnualCategorySummary[] = Array.from(categoryMap.entries())
      .map(([categoria, total]) => ({
        categoria,
        total,
        percentual: totalGastosAnuais > 0 ? roundBRL((total / totalGastosAnuais) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    const saldoConsolidadoAnual = roundBRL(totalRendaAnual - totalGastosAnuais);

    return {
      ano,
      userName,
      meses: mesesSummaries,
      categorias,
      tributos,
      totalRendaAnual,
      totalGastosAnuais,
      saldoConsolidadoAnual,
      totalLancamentos: allYearExpenses.length,
      mesesComSuperavit,
      mesesComDeficit
    };
  }

  /**
   * Compila os dados e dispara a geração do Dossiê Anual em PDF para impressão
   */
  async exportAnnualDossierPDF(ano: number, userId: string, userName?: string): Promise<void> {
    const data = await this.fetchAnnualDossierData(ano, userId, userName);
    const htmlContent = this.generateAnnualDossierHTML(data);

    const printWindow = window.open('', '_blank', 'width=1000,height=850');
    if (!printWindow) {
      alert('Por favor, permita popups para gerar a visualização do Dossiê Anual em PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  /**
   * Escapa caracteres especiais HTML para prevenir injeção de tags e DOM XSS (CWE-79).
   */
  escapeHTML(value: string | undefined | null): string {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Gera a estrutura HTML/CSS para o relatório mensal em PDF
   */
  generatePDFReportHTML(
    mesAno: string,
    expenses: Expense[],
    summary: MonthBalanceSummary,
    userName?: string
  ): string {
    const safeMesAno = this.escapeHTML(mesAno);
    const safeUserName = userName ? this.escapeHTML(userName) : '';
    const sorted = [...expenses].sort((a, b) => a.quinzena - b.quinzena);
    const q1List = sorted.filter(e => e.quinzena === 1);
    const q2List = sorted.filter(e => e.quinzena === 2);

    const renderTableRows = (items: Expense[]) => {
      if (items.length === 0) {
        return `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:12px;">Nenhum lançamento nesta quinzena.</td></tr>`;
      }
      return items.map(e => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">
            ${this.escapeHTML(e.descricao)}
            ${e.tipo === 'renda_extra' ? '<span style="background:#dcfce7;color:#15803d;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">Renda Extra</span>' : ''}
          </td>
          <td style="padding: 8px 12px; color: #475569;">${this.escapeHTML(e.categoria || 'Outros')}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: ${e.tipo === 'renda_extra' ? '#16a34a' : '#0f172a'};">
            ${formatBRL(e.valor)}
          </td>
          <td style="padding: 8px 12px; text-align: center;">
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 600; background: ${e.status_pagamento ? '#dcfce7; color: #166534;' : '#fef2f2; color: #991b1b;'}">
              ${e.status_pagamento ? 'Pago' : 'Pendente'}
            </span>
          </td>
          <td style="padding: 8px 12px; text-align: center; color: #64748b; font-size: 11px;">
            ${this.escapeHTML(e.codigo_comprovante || '-')}
          </td>
        </tr>
      `).join('');
    };

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório Financeiro - ${safeMesAno}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin: 4px 0 0 0; }
          .meta-info { text-align: right; font-size: 11px; color: #64748b; }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .summary-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .summary-box.highlight {
            background: #f0fdf4;
            border-color: #bbf7d0;
          }
          .summary-box.danger {
            background: #fef2f2;
            border-color: #fecaca;
          }
          .box-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
          .box-value { font-size: 16px; font-weight: 800; color: #0f172a; }
          .box-value.green { color: #16a34a; }
          .box-value.red { color: #dc2626; }

          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #1e293b;
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 6px;
            margin: 20px 0 10px 0;
            display: flex;
            justify-content: space-between;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f8fafc; color: #475569; font-size: 11px; text-align: left; padding: 8px 12px; border-bottom: 2px solid #cbd5e1; }
          
          .footer {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Controle Financeiro Quinzenal</h1>
            <p class="subtitle">Relatório Consolidado do Ciclo ${safeMesAno} ${safeUserName ? ' • ' + safeUserName : ''}</p>
          </div>
          <div class="meta-info">
            <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
            <strong>Status:</strong> ${summary.temDeficitGlobal ? 'Déficit no Mês' : 'Superavitário'}
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <div class="box-label">Renda Total do Mês</div>
            <div class="box-value green">${formatBRL(summary.totalRenda)}</div>
          </div>
          <div class="summary-box">
            <div class="box-label">Total de Gastos</div>
            <div class="box-value">${formatBRL(summary.totalGastos)}</div>
          </div>
          <div class="summary-box ${summary.temDeficitGlobal ? 'danger' : 'highlight'}">
            <div class="box-label">Saldo Líquido Consolidado</div>
            <div class="box-value ${summary.temDeficitGlobal ? 'red' : 'green'}">${formatBRL(summary.saldoFinal)}</div>
          </div>
          <div class="summary-box">
            <div class="box-label">Total de Lançamentos</div>
            <div class="box-value">${expenses.length} itens</div>
          </div>
        </div>

        <!-- 1ª Quinzena (Dia 31) -->
        <div class="section-title">
          <span>1ª Quinzena (Dia 31)</span>
          <span>Renda: ${formatBRL(summary.q1.renda)} | Gastos: ${formatBRL(summary.q1.totalGastos)} | Saldo: ${formatBRL(summary.q1.saldo)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35%;">Descrição</th>
              <th style="width: 20%;">Categoria</th>
              <th style="width: 15%; text-align: right;">Valor</th>
              <th style="width: 15%; text-align: center;">Status</th>
              <th style="width: 15%; text-align: center;">Comprovante</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(q1List)}
          </tbody>
        </table>

        <!-- 2ª Quinzena (Dia 15) -->
        <div class="section-title">
          <span>2ª Quinzena (Dia 15)</span>
          <span>Renda: ${formatBRL(summary.q2.renda)} | Gastos: ${formatBRL(summary.q2.totalGastos)} | Saldo: ${formatBRL(summary.q2.saldo)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35%;">Descrição</th>
              <th style="width: 20%;">Categoria</th>
              <th style="width: 15%; text-align: right;">Valor</th>
              <th style="width: 15%; text-align: center;">Status</th>
              <th style="width: 15%; text-align: center;">Comprovante</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(q2List)}
          </tbody>
        </table>

        <div class="footer">
          Documento gerado automaticamente pelo aplicativo Controle de Gastos Quinzenais • Uso Pessoal e Confidencial
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Gera o layout executivo A4 do Dossiê Anual (24 Quinzenas)
   */
  generateAnnualDossierHTML(data: AnnualDossierData): string {
    const safeUserName = data.userName ? this.escapeHTML(data.userName) : '';
    const ano = data.ano;

    // Linhas da tabela das 24 quinzenas (12 meses x 2 quinzenas)
    const render24FortnightsRows = () => {
      return data.meses.map((m, idx) => {
        const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr style="background: ${bgRow}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px 10px; font-weight: 700; color: #1e293b;">${m.mesNome}</td>
            <!-- Q1 -->
            <td style="padding: 6px 8px; text-align: right; color: #16a34a;">${formatBRL(m.q1Renda)}</td>
            <td style="padding: 6px 8px; text-align: right; color: #0f172a;">${formatBRL(m.q1Gastos)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 600; color: ${m.q1Saldo < 0 ? '#dc2626' : '#16a34a'};">${formatBRL(m.q1Saldo)}</td>
            <!-- Q2 -->
            <td style="padding: 6px 8px; text-align: right; color: #16a34a; border-left: 1px solid #e2e8f0;">${formatBRL(m.q2Renda)}</td>
            <td style="padding: 6px 8px; text-align: right; color: #0f172a;">${formatBRL(m.q2Gastos)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 600; color: ${m.q2Saldo < 0 ? '#dc2626' : '#16a34a'};">${formatBRL(m.q2Saldo)}</td>
            <!-- Mês Consolidado -->
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #0f172a; border-left: 1px solid #cbd5e1;">${formatBRL(m.totalGastos)}</td>
            <td style="padding: 6px 10px; text-align: right; font-weight: 800; color: ${m.saldoFinal < 0 ? '#dc2626' : '#16a34a'}; background: ${m.saldoFinal < 0 ? '#fef2f2' : '#f0fdf4'};">
              ${formatBRL(m.saldoFinal)}
            </td>
          </tr>
        `;
      }).join('');
    };

    // Linhas de Categorias
    const renderCategoryRows = () => {
      if (data.categorias.length === 0) {
        return `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:10px;">Nenhuma despesa registrada no ano fiscal.</td></tr>`;
      }
      return data.categorias.map(c => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 10px; font-weight: 600; color: #1e293b;">${this.escapeHTML(c.categoria)}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatBRL(c.total)}</td>
          <td style="padding: 6px 10px; text-align: right; color: #6366f1; font-weight: 700;">${c.percentual.toFixed(1)}%</td>
        </tr>
      `).join('');
    };

    // Linhas de Tributos
    const renderTaxesRows = () => {
      if (data.tributos.length === 0) {
        return `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:10px;">Nenhum tributo anual registrado no exercício fiscal.</td></tr>`;
      }
      return data.tributos.map(t => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 10px; font-weight: 600; color: #1e293b;">${this.escapeHTML(t.titulo)}</td>
          <td style="padding: 6px 10px; color: #64748b;">${t.data_vencimento || '-'}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatBRL(t.valor_orcado)}</td>
          <td style="padding: 6px 10px; text-align: center;">
            <span style="font-size: 10px; padding: 2px 8px; border-radius: 9999px; font-weight: 700; background: ${t.status === 'Pago' ? '#dcfce7; color:#166534;' : '#fef2f2; color:#991b1b;'}">
              ${t.status}
            </span>
          </td>
        </tr>
      `).join('');
    };

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Dossiê Financeiro Anual - Exercício ${ano}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
          }
          .dossier-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 10px;
            margin-bottom: 16px;
          }
          .brand-title { font-size: 18px; font-weight: 900; color: #1e1b4b; margin: 0; }
          .brand-subtitle { font-size: 11px; color: #64748b; margin: 2px 0 0 0; }
          .meta-box { text-align: right; font-size: 10px; color: #64748b; }

          .grid-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .card-stat {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .card-stat.highlight {
            background: #f0fdf4;
            border-color: #bbf7d0;
          }
          .card-stat.danger {
            background: #fef2f2;
            border-color: #fecaca;
          }
          .card-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px; }
          .card-value { font-size: 15px; font-weight: 900; margin-top: 2px; }
          .val-green { color: #16a34a; }
          .val-red { color: #dc2626; }

          .section-heading {
            font-size: 12px;
            font-weight: 800;
            color: #1e293b;
            background: #f1f5f9;
            padding: 6px 10px;
            border-radius: 4px;
            margin: 14px 0 8px 0;
            border-left: 4px solid #4f46e5;
          }

          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { background: #f8fafc; color: #475569; font-size: 10px; text-align: left; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; }
          
          .two-cols {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 16px;
            page-break-inside: avoid;
          }

          .footer-note {
            margin-top: 20px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <!-- Cabeçalho Oficial -->
        <div class="dossier-header">
          <div>
            <h1 class="brand-title">Dossiê Financeiro Consolidado • Exercício Fiscal ${ano}</h1>
            <p class="brand-subtitle">Demonstrativo Anual de 24 Quinzenas & Imposto de Renda ${safeUserName ? ' • ' + safeUserName : ''}</p>
          </div>
          <div class="meta-box">
            <strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
            <strong>Quinzena App:</strong> Pro / Duo Edition
          </div>
        </div>

        <!-- Indicadores Anuais -->
        <div class="grid-summary">
          <div class="card-stat">
            <div class="card-label">Renda Bruta Anual</div>
            <div class="card-value val-green">${formatBRL(data.totalRendaAnual)}</div>
          </div>
          <div class="card-stat">
            <div class="card-label">Gastos Totais Anuais</div>
            <div class="card-value">${formatBRL(data.totalGastosAnuais)}</div>
          </div>
          <div class="card-stat ${data.saldoConsolidadoAnual < 0 ? 'danger' : 'highlight'}">
            <div class="card-label">Superávit / Saldo Líquido</div>
            <div class="card-value ${data.saldoConsolidadoAnual < 0 ? 'val-red' : 'val-green'}">
              ${formatBRL(data.saldoConsolidadoAnual)}
            </div>
          </div>
          <div class="card-stat">
            <div class="card-label">Taxa de Eficiência</div>
            <div class="card-value" style="color: #4f46e5;">
              ${data.mesesComSuperavit} de 12 meses positivos
            </div>
          </div>
        </div>

        <!-- Tabela das 24 Quinzenas (12 Meses) -->
        <div class="section-heading">
          Demonstrativo Consolidado das 24 Quinzenas (Exercício Fiscal ${ano})
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 14%;">Mês Fiscal</th>
              <th style="width: 10%; text-align: right;">Renda Q1</th>
              <th style="width: 10%; text-align: right;">Gasto Q1</th>
              <th style="width: 10%; text-align: right;">Saldo Q1</th>
              <th style="width: 10%; text-align: right; border-left: 1px solid #e2e8f0;">Renda Q2</th>
              <th style="width: 10%; text-align: right;">Gasto Q2</th>
              <th style="width: 10%; text-align: right;">Saldo Q2</th>
              <th style="width: 12%; text-align: right; border-left: 1px solid #cbd5e1;">Gastos Mês</th>
              <th style="width: 14%; text-align: right;">Saldo Mês</th>
            </tr>
          </thead>
          <tbody>
            ${render24FortnightsRows()}
          </tbody>
          <tfoot>
            <tr style="background: #eef2ff; font-weight: 800; border-top: 2px solid #4f46e5;">
              <td style="padding: 8px 10px; color: #1e1b4b;">TOTAL ANUAL</td>
              <td colspan="6" style="padding: 8px 8px; text-align: right; color: #16a34a;">Renda Total: ${formatBRL(data.totalRendaAnual)}</td>
              <td style="padding: 8px 8px; text-align: right; color: #0f172a;">${formatBRL(data.totalGastosAnuais)}</td>
              <td style="padding: 8px 10px; text-align: right; color: ${data.saldoConsolidadoAnual < 0 ? '#dc2626' : '#16a34a'}; font-size: 12px;">
                ${formatBRL(data.saldoConsolidadoAnual)}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Seções: Distribuição de Despesas & Tributos Anuais -->
        <div class="two-cols">
          <div>
            <div class="section-heading">Distribuição Anual por Categoria</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">Categoria</th>
                  <th style="width: 30%; text-align: right;">Total Gasto</th>
                  <th style="width: 20%; text-align: right;">% Anual</th>
                </tr>
              </thead>
              <tbody>
                ${renderCategoryRows()}
              </tbody>
            </table>
          </div>

          <div>
            <div class="section-heading">Tributos, Seguros & Anuidades do Exercício</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 40%;">Tributo</th>
                  <th style="width: 25%;">Vencimento</th>
                  <th style="width: 20%; text-align: right;">Valor</th>
                  <th style="width: 15%; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${renderTaxesRows()}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer-note">
          Dossiê Financeiro emitido em conformidade com as regras de cálculo do Quinzena App • Apropriado para Declaração de IRPF e Arquivamento Contábil
        </div>
      </body>
      </html>
    `;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

