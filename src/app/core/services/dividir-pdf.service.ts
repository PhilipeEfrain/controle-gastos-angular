import { Injectable } from '@angular/core';
import { SplitGroup, SplitExpense, SplitGroupSummary } from '../models/split-group.model';
import { formatBRL } from '../utils/formatters';

@Injectable({
  providedIn: 'root'
})
export class DividirPdfService {
  /**
   * Abre a janela de impressão com o extrato formatado para salvar em PDF
   */
  exportGroupSummaryPdf(
    group: SplitGroup,
    expenses: SplitExpense[],
    summary: SplitGroupSummary
  ): void {
    const html = this.buildHtmlContent(group, expenses, summary);
    const printWindow = window.open('', '_blank', 'width=850,height=750');

    if (!printWindow) {
      alert('Por favor, permita popups para gerar o PDF da prestação de contas.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  private buildHtmlContent(
    group: SplitGroup,
    expenses: SplitExpense[],
    summary: SplitGroupSummary
  ): string {
    const nowStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const expensesRows = expenses
      .map((exp) => {
        const payer = group.participants.find((p) => p.id === exp.paidByParticipantId)?.name || 'Desconhecido';
        return `
          <tr>
            <td>${this.escapeHtml(exp.description)}</td>
            <td>${this.escapeHtml(payer)}</td>
            <td>${exp.date || '-'}</td>
            <td style="text-align: right; font-weight: 600;">${formatBRL(exp.amount)}</td>
          </tr>
        `;
      })
      .join('');

    const settlementsRows = summary.settlements.length
      ? summary.settlements
          .map((s) => {
            const pixInfo = s.toPixKey ? `PIX (${s.toPixKeyType || 'chave'}): <strong>${this.escapeHtml(s.toPixKey)}</strong>` : '<span style="color: #888;">Sem chave PIX cadastrada</span>';
            return `
              <div class="settlement-card">
                <div class="settlement-names">
                  <strong>${this.escapeHtml(s.fromParticipantName)}</strong> transfere para <strong>${this.escapeHtml(s.toParticipantName)}</strong>
                </div>
                <div class="settlement-amount">${formatBRL(s.amount)}</div>
                <div class="settlement-pix">${pixInfo}</div>
              </div>
            `;
          })
          .join('')
      : '<p style="color: #10b981; font-weight: 600; text-align: center; padding: 12px;">Ninguém deve a ninguém! Todas as contas estão equilibradas.</p>';

    const balancesRows = summary.balances
      .map((b) => {
        const isCreditor = b.netBalance > 0.005;
        const isDebtor = b.netBalance < -0.005;
        const statusClass = isCreditor ? 'color: #10b981;' : isDebtor ? 'color: #ef4444;' : 'color: #888;';
        const statusText = isCreditor
          ? `+ ${formatBRL(b.netBalance)} (a receber)`
          : isDebtor
          ? `- ${formatBRL(Math.abs(b.netBalance))} (a pagar)`
          : 'Quitado (R$ 0,00)';

        return `
          <tr>
            <td>${this.escapeHtml(b.participantName)}</td>
            <td style="text-align: right;">${formatBRL(b.totalPaid)}</td>
            <td style="text-align: right;">${formatBRL(b.totalOwed)}</td>
            <td style="text-align: right; font-weight: 700; ${statusClass}">${statusText}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Quinzena Dividir - ${this.escapeHtml(group.title)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 32px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .brand-subtitle {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .meta-info {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .group-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .group-desc {
            color: #475569;
            font-size: 12px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            background-color: #f8fafc;
            color: #475569;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
          }
          .summary-kpi {
            display: flex;
            gap: 16px;
            margin-bottom: 20px;
          }
          .kpi-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
          }
          .kpi-label { font-size: 11px; color: #64748b; }
          .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          .settlement-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #10b981;
            border-radius: 4px;
            padding: 10px 14px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .settlement-names { font-size: 13px; }
          .settlement-amount { font-size: 15px; font-weight: 800; color: #0f172a; }
          .settlement-pix { font-size: 11px; color: #475569; }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 16px; }
            .settlement-card { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">QUINZENA DIVIDIR</div>
            <div class="brand-subtitle">Prestação de Contas & Rateio de Despesas</div>
          </div>
          <div class="meta-info">
            <div>Emissão: <strong>${nowStr}</strong></div>
            <div>Anfitrião: <strong>${this.escapeHtml(group.ownerName)}</strong></div>
            <div>Status: <strong>${group.status === 'settled' ? 'LIQUIDADO' : 'EM ABERTO'}</strong></div>
          </div>
        </div>

        <div class="group-title">${this.escapeHtml(group.title)}</div>
        ${group.description ? `<div class="group-desc">${this.escapeHtml(group.description)}</div>` : ''}

        <div class="summary-kpi">
          <div class="kpi-card">
            <div class="kpi-label">Total Gasto no Grupo</div>
            <div class="kpi-val">${formatBRL(summary.totalAmount)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Despesas Registradas</div>
            <div class="kpi-val">${summary.expensesCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Participantes</div>
            <div class="kpi-val">${group.participants.length}</div>
          </div>
        </div>

        <div class="section-title">Acerto de Contas Otimizado (PIX)</div>
        <div>${settlementsRows}</div>

        <div class="section-title">Balanço Individual por Participante</div>
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              <th style="text-align: right;">Total Pago</th>
              <th style="text-align: right;">Total Devido</th>
              <th style="text-align: right;">Saldo Líquido</th>
            </tr>
          </thead>
          <tbody>
            ${balancesRows}
          </tbody>
        </table>

        <div class="section-title">Detalhamento dos Gastos</div>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Quem Pagou</th>
              <th>Data</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${expensesRows}
          </tbody>
        </table>

        <div class="footer">
          Gerado por Quinzena Dividir • O controle financeiro que respeita seu ritmo • https://quinzena.com.br
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
