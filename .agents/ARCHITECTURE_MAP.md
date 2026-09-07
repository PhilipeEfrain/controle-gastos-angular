# Mapa de Arquitetura - Angular + Firebase (Web SPA)

> **ATENÇÃO DEV**: Antes de criar qualquer novo componente standalone, service, pipe, directive, guard ou função utilitária, consulte este catálogo para garantir máxima reutilização de código. Ao criar um novo artefato reutilizável, registre-o aqui imediatamente.
> **Stack Oficial**: Angular (Standalone Components, Signals, `inject()`), TypeScript, **SCSS Modular** (`src/styles/abstracts`), `@angular/fire` / Firebase Modular SDK (Auth, Firestore), Jasmine/Karma ou Vitest para testes unitários.

---

## 1. Utilitários e Helpers Financeiros (`src/app/core/utils/`)

| Nome | Arquivo | Descrição | Assinatura / Tipagem |
| :--- | :--- | :--- | :--- |
| `formatBRL` | `src/app/core/utils/formatters.ts` | Formata número para moeda Real Brasileiro (`R$ 1.234,56`). | `(value: number): string` |
| `parseBRL` | `src/app/core/utils/formatters.ts` | Converte string formatada em BRL para número decimal float. | `(formatted: string): number` |
| `sumExpenses` | `src/app/core/utils/calculations.ts` | Soma valores de itens de despesa (exclui rendas extras). | `(items: Expense[]): number` |
| `sumExtraIncomes` | `src/app/core/utils/calculations.ts` | Soma valores de itens marcados como renda extra (`tipo === 'renda_extra'`). | `(items: Expense[]): number` |
| `filterExpensesByFortnight` | `src/app/core/utils/calculations.ts` | Filtra despesas/itens pertencentes à Quinzena 1 ou 2. | `(items: Expense[], quinzena: 1 \| 2): Expense[]` |
| `calculateFortnightBalance` | `src/app/core/utils/calculations.ts` | Calcula saldo da quinzena (`Renda Base + Rendas Extras - Total Despesas`). | `(income: number, items: Expense[]): number` |
| `calculateGlobalBalance` | `src/app/core/utils/calculations.ts` | Calcula totais consolidados do mês, saldos e análise de cobertura de déficit considerando rendas extras. | `(rendaQ1: number, rendaQ2: number, items: Expense[]): MonthBalanceSummary` |
| `addMonthsToYearMonth` | `src/app/core/utils/calculations.ts` | Projeta N meses à frente/atrás no formato `YYYY-MM` para parcelamentos e navegação. | `(yearMonth: string, count: number): string` |
| `getFortnightFromDay` | `src/app/core/utils/date.ts` | Retorna se um determinado dia do mês pertence à Quinzena 1 ou Quinzena 2. | `(date: Date \| string): 1 \| 2` |

---

## 2. Modelos e Interfaces TypeScript (`src/app/core/models/`)

| Interface / Type | Arquivo | Descrição |
| :--- | :--- | :--- |
| `FortnightNumber` | `src/app/core/models/finance.model.ts` | Tipo literal `1 \| 2`. |
| `Expense` | `src/app/core/models/finance.model.ts` | Modelo de despesa ou renda extra (`tipo?: 'despesa' \| 'renda_extra'`, valor, quinzena, status_pagamento, categoria, parcelas). |
| `MonthlyCycle` | `src/app/core/models/finance.model.ts` | Modelo do ciclo mensal com rendas Q1/Q2, totais e saldos consolidados. |
| `FortnightSummary` | `src/app/core/models/finance.model.ts` | Estrutura de resumo da quinzena (renda, totalGastos, saldo, isDeficit). |
| `MonthBalanceSummary` | `src/app/core/models/finance.model.ts` | Consolidado global do mês com suporte à flag `q1CobreQ2` e `temDeficitGlobal`. |
| `AnnualTax` | `src/app/core/models/finance.model.ts` | Modelo de tributo/imposto anual (IPTU, IPVA, valor_orcado, valor_pago, status). |
| `UserProfile` | `src/app/core/models/user.model.ts` | Modelo de perfil de usuário autenticado no Firebase. |
| `ToastNotification` | `src/app/core/models/notification.model.ts` | Modelo de notificação Toast reativa (id, tipo, mensagem, duração). |

---

## 3. Serviços e Acesso a Dados Firebase (`src/app/core/services/`)

| Serviço | Arquivo | Descrição |
| :--- | :--- | :--- |
| `AuthService` | `src/app/core/services/auth.service.ts` | Gerenciamento de login (Google, E-mail/Senha), cadastro, logout e signal do usuário atual. |
| `MonthlyCycleService` | `src/app/core/services/monthly-cycle.service.ts` | CRUD e stream em tempo real para `users/{userId}/ciclos_mensais/{mesAno}`. |
| `ExpenseService` | `src/app/core/services/expense.service.ts` | CRUD de despesas, alternância de pagamento, atualização de comprovante e geração em lote de parcelas (`createInstallmentExpenses`). |
| `TaxService` | `src/app/core/services/tax.service.ts` | CRUD e sincronização em tempo real de tributos em `users/{userId}/tributos_e_parcelas`. |
| `NotificationService` | `src/app/core/services/notification.service.ts` | Notificações reativas do tipo Toast com Signals (`success`, `error`, `warning`, `info`). |

---

## 4. Estado Reativo e Signal Stores (`src/app/core/state/`)

| Store / Signal State | Arquivo | Descrição |
| :--- | :--- | :--- |
| `FinanceStore` | `src/app/core/state/finance.store.ts` | Store centralizada baseada em Signals contendo o mês selecionado (`selectedMonth`), ciclo ativo, despesas da Q1/Q2 e `computed()` com o `MonthBalanceSummary`. |
| `AuthStore` | `src/app/core/state/auth.store.ts` | Estado reativo da sessão do usuário autenticado e flags de carregamento. |

---

## 5. Componentes Standalone (`src/app/`)

### A. Shared & UI Primitives (`src/app/shared/components/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `AppCardComponent` | `app-card` | Contêiner estilizado com suporte a glassmorphism, bordas suaves e variantes de destaque. |
| `BalanceBadgeComponent` | `app-balance-badge` | Badge financeiro automático (Verde = superávit / Vermelho = déficit). |
| `DeficitAlertBannerComponent` | `app-deficit-alert-banner` | Banner de alerta condicional disparado quando a Q2 está deficitária ou o mês está no vermelho. |
| `ProgressBarComponent` | `app-progress-bar` | Barra de progresso visual demonstrando percentual gasto em relação à renda prevista. |
| `ToastContainerComponent` | `app-toast-container` | Contêiner flutuante com animações para renderização de alertas Toast. |
| `ConfirmationModalComponent` | `app-confirmation-modal` | Modal de confirmação reutilizável para exclusão ou ações irreversíveis. |

### B. Core & Navegação (`src/app/core/components/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `NavbarComponent` | `app-navbar` | Barra de navegação superior responsiva com Glassmorphism, links com indicador ativo, perfil do usuário e logout. |

### C. Feature: Dashboard & Finanças (`src/app/features/dashboard/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `DashboardComponent` | `app-dashboard` | Página principal com seletor de mês, top summary cards, grid quinzenal e botões de ação rápida. |
| `FortnightCardComponent` | `app-fortnight-card` | Card quinzenal completo com resumo de entrada/saída, barra de progresso e listagem de despesas. |
| `ExpenseItemRowComponent` | `app-expense-item-row` | Linha de despesa com checkbox de quitação, badge de categoria, indicador de comprovante e ações de edição/exclusão. |
| `ExpenseFormModalComponent` | `app-expense-form-modal` | Modal com formulário reativo para criação/edição de despesas simples ou em lote parcelado. |
| `IncomeFormModalComponent` | `app-income-form-modal` | Modal para configuração das rendas de Q1 e Q2 com suporte a múltiplos regimes salariais (`quinzenal`, `divisao_50_50`, `mensal_q1`, `mensal_q2`) e distribuição automática. |
| `ReceiptModalComponent` | `app-receipt-modal` | Diálogo rápido para inserção/alteração do código de comprovante da transação. |

### D. Feature: Tributos Anuais (`src/app/features/taxes/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `TaxesListComponent` | `app-taxes-list` | Tabela consolidada de tributos e taxas anuais (IPTU, IPVA, Licenciamento, Bombeiros). |
| `TaxComparisonCardComponent` | `app-tax-comparison-card` | Card comparativo de totais anuais orçados vs. efetivamente pagos. |
| `TaxFormModalComponent` | `app-tax-form-modal` | Modal de inclusão e edição de impostos e taxas. |

### E. Feature: Autenticação (`src/app/features/auth/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `AuthComponent` | `app-auth` | Tela com abas de Login e Cadastro, suporte a Google Sign-In e recuperação de senha. |

---

## 6. Pipes e Diretivas Customizadas (`src/app/shared/`)

| Pipe / Diretiva | Arquivo | Descrição |
| :--- | :--- | :--- |
| `BrlCurrencyPipe` | `src/app/shared/pipes/brl-currency.pipe.ts` | Pipe para formatação instantânea de valores em Real (`R$ 0,00`). |
| `FortnightLabelPipe` | `src/app/shared/pipes/fortnight-label.pipe.ts` | Transforma `1` em `Quinzena 1 (Dia 31)` e `2` em `Quinzena 2 (Dia 15)`. |
| `CurrencyMaskDirective` | `src/app/shared/directives/currency-mask.directive.ts` | Máscara de input monetário BRL para inputs de formulários reativos. |

---

## 7. Guards de Rota (`src/app/core/guards/`)

| Guard | Arquivo | Descrição |
| :--- | :--- | :--- |
| `authGuard` | `src/app/core/guards/auth.guard.ts` | Guard assíncrono que aguarda `authStore.ensureInitialized()` e redireciona usuários não autenticados para `/auth` preservando `returnUrl`. |
| `publicGuard` | `src/app/core/guards/public.guard.ts` | Guard assíncrono que aguarda `authStore.ensureInitialized()` e redireciona usuários já autenticados de `/auth` para `/dashboard`. |

---

## 8. Segurança e Regras de Acesso

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `Firestore Security Rules` | `firestore.rules` | Regras com isolamento de leitura e escrita por `request.auth.uid == userId`. |

---

---

## 9. Arquitetura de Estilos SCSS & Design System (`src/styles/`)

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `Abstracts Index` | `src/styles/abstracts/_index.scss` | Centralizador com `@forward` de colors, variables, mixins e functions. |
| `Colors & Tokens` | `src/styles/abstracts/_colors.scss` | Paleta financeira (Emerald, Carmine, Slate Dark, Glassmorphism) e CSS Custom Properties. |
| `Mixins` | `src/styles/abstracts/_mixins.scss` | Mixins de responsividade (`respond-to`), glassmorphism e flex helpers. |
| `Base & Reset` | `src/styles/base/_reset.scss` | Reset CSS moderno e normalizações. |
| `Grid Layout` | `src/styles/layout/_grid.scss` | Layout do dashboard quinzenal (desktop 2 colunas / mobile empilhado). |

---

## 10. CI/CD e Automação de Qualidade

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `GitHub Actions CI Pipeline` | `.github/workflows/ci.yml` | Pipeline que executa linting, typecheck, suíte de testes unitários e build de produção do Angular. |
