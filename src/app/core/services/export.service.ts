import { Injectable } from '@angular/core';
import { Expense, MonthBalanceSummary } from '../models/finance.model';
import { formatBRL } from '../utils/formatters';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

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
   * Dispara a impressão / exportação de relatório em PDF com layout A4 profissional
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
   * Gera a estrutura HTML/CSS para o relatório em PDF
   */
  generatePDFReportHTML(
    mesAno: string,
    expenses: Expense[],
    summary: MonthBalanceSummary,
    userName?: string
  ): string {
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
            ${e.descricao}
            ${e.tipo === 'renda_extra' ? '<span style="background:#dcfce7;color:#15803d;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">Renda Extra</span>' : ''}
          </td>
          <td style="padding: 8px 12px; color: #475569;">${e.categoria || 'Outros'}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: ${e.tipo === 'renda_extra' ? '#16a34a' : '#0f172a'};">
            ${formatBRL(e.valor)}
          </td>
          <td style="padding: 8px 12px; text-align: center;">
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 600; background: ${e.status_pagamento ? '#dcfce7; color: #166534;' : '#fef2f2; color: #991b1b;'}">
              ${e.status_pagamento ? 'Pago' : 'Pendente'}
            </span>
          </td>
          <td style="padding: 8px 12px; text-align: center; color: #64748b; font-size: 11px;">
            ${e.codigo_comprovante || '-'}
          </td>
        </tr>
      `).join('');
    };

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório Financeiro - ${mesAno}</title>
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
            <p class="subtitle">Relatório Consolidado do Ciclo ${mesAno} ${userName ? ' • ' + userName : ''}</p>
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
