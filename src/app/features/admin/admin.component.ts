import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../core/components/navbar/navbar.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <div class="admin-layout">
      <app-navbar />
      <main class="admin-container">
        <div class="admin-header">
          <div class="header-tag">🛡️ Área de Governança</div>
          <h1>Painel Administrativo</h1>
          <p class="subtitle">Gestão de métricas globais, assinaturas SaaS e controle de usuários.</p>
        </div>
        <div class="admin-content-placeholder">
          <div class="admin-card">
            <h3>Módulo Administrativo Ativo</h3>
            <p>Controle de acesso baseado em papéis (RBAC) validado com sucesso.</p>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      min-height: 100vh;
      background: var(--color-background);
      color: var(--color-text-primary);
    }
    .admin-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .admin-header {
      margin-bottom: 2rem;
      .header-tag {
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #60a5fa;
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.3);
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        margin-bottom: 0.75rem;
      }
      h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      .subtitle {
        color: var(--color-text-secondary);
        font-size: 0.9375rem;
      }
    }
    .admin-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 2rem;
      text-align: center;
      h3 {
        font-size: 1.125rem;
        color: #60a5fa;
        margin-bottom: 0.5rem;
      }
      p {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent {}
