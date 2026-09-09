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
| `maskCpfCnpj` | `src/app/core/utils/formatters.ts` | Aplica máscara dinâmica de CPF (`000.000.000-00`) ou CNPJ (`00.000.000/0000-00`). | `(value: string \| null \| undefined): string` |
| `maskCardNumber` | `src/app/core/utils/formatters.ts` | Aplica máscara de número de cartão com blocos de 4 dígitos (`0000 0000 0000 0000`). | `(value: string \| null \| undefined): string` |
| `maskCardExpiry` | `src/app/core/utils/formatters.ts` | Formata validade do cartão no formato `MM/AA`. | `(value: string \| null \| undefined): string` |
| `maskCardCvv` | `src/app/core/utils/formatters.ts` | Sanitiza e limita o CVV para até 4 dígitos numéricos. | `(value: string \| null \| undefined): string` |
| `maskCardHolderName` | `src/app/core/utils/formatters.ts` | Sanitiza e converte o nome do titular para maiúsculas (apenas letras e espaços). | `(value: string \| null \| undefined): string` |
| `isValidCpfCnpj` | `src/app/core/utils/formatters.ts` | Validador estrito de CPF e CNPJ através do algoritmo oficial de Módulo 11 (`validation-br`). | `(document: string \| null \| undefined): boolean` |

---

## 2. Modelos e Interfaces TypeScript (`src/app/core/models/`)

| Interface / Type | Arquivo | Descrição |
| :--- | :--- | :--- |
| `FortnightNumber` | `src/app/core/models/finance.model.ts` | Tipo literal `1 \| 2`. |
| `Expense` | `src/app/core/models/finance.model.ts` | Modelo de despesa ou renda extra (`tipo?: 'despesa' \| 'renda_extra'`, valor, quinzena, status_pagamento, categoria, recorrente, recorrente_id, parcelas). |
| `RecurringExpense` | `src/app/core/models/finance.model.ts` | Modelo mestre de despesa fixa/recorrente mensal (id, descricao, valor, quinzena, categoria, ativo). |
| `MonthlyCycle` | `src/app/core/models/finance.model.ts` | Modelo do ciclo mensal com rendas Q1/Q2, totais e saldos consolidados. |
| `FortnightSummary` | `src/app/core/models/finance.model.ts` | Estrutura de resumo da quinzena (renda, totalGastos, saldo, isDeficit). |
| `MonthBalanceSummary` | `src/app/core/models/finance.model.ts` | Consolidado global do mês com suporte à flag `q1CobreQ2` e `temDeficitGlobal`. |
| `AnnualTax` | `src/app/core/models/finance.model.ts` | Modelo de tributo/imposto anual (IPTU, IPVA, valor_orcado, valor_pago, status). |
| `TravelTrip` | `src/app/core/models/finance.model.ts` | Modelo de viagem com nome, quantidade de pessoas, moeda, itens de despesa e data. |
| `TravelExpenseItem` | `src/app/core/models/finance.model.ts` | Item de despesa de viagem com descrição, categoria, valor, pagador e rateio (`dividir`). |
| `InstallmentGroup` | `src/app/core/models/finance.model.ts` | Agrupamento de compras parceladas com progresso (ex: 3/10), saldo restante e parcelas vinculadas. |
| `InstallmentParcel` | `src/app/core/models/finance.model.ts` | Item individual de parcela com mês de referência, número, valor e status de quitação. |
| `UserProfile` | `src/app/core/models/user.model.ts` | Modelo de perfil de usuário com suporte a papéis RBAC (`role?: 'admin' \| 'user'`), planos SaaS (`plan?: 'free' \| 'pro' \| 'duo'`), status da assinatura e identificadores Asaas. |
| `UserRole` / `PlanType` / `PlanStatus` | `src/app/core/models/user.model.ts` | Tipos literais estritos para controle de acesso e monetização. |
| `PlanPricing` / `AsaasSubscriptionPayload` / `AsaasWebhookPayload` | `src/app/core/models/payment.model.ts` | Interfaces de contratos de pagamento com o gateway Asaas (API v3, PIX, Cartão e Webhooks). |
| `AsaasConfig` / `AsaasEnvironment` | `src/app/core/models/payment.model.ts` | Modelo de governança e configuração de credenciais Asaas v3 (`environment`, `apiKey`, `webhookSecret`, `walletId`, `isActive`, `lastTestedAt`). |
| `ToastNotification` | `src/app/core/models/notification.model.ts` | Modelo de notificação Toast reativa (id, tipo, mensagem, duração). |
| `DuoGroup` / `DuoSettlementSummary` | `src/app/core/models/duo.model.ts` | Interfaces do Modo Casal / Duo: grupos de pareamento, convites e saldo de acerto de contas 50/50. |

---

## 3. Serviços e Acesso a Dados Firebase (`src/app/core/services/`)

| Serviço | Arquivo | Descrição |
| :--- | :--- | :--- |
| `AuthService` | `src/app/core/services/auth.service.ts` | Gerenciamento de login (Google, E-mail/Senha), cadastro, logout, signal do usuário atual e persistência definitiva de assinaturas no Firestore (`updateUserSubscription`). |
| `MonthlyCycleService` | `src/app/core/services/monthly-cycle.service.ts` | CRUD e stream em tempo real para `users/{userId}/ciclos_mensais/{mesAno}`. |
| `ExpenseService` | `src/app/core/services/expense.service.ts` | CRUD de despesas, alternância de pagamento, atualização de comprovante, gestão e sincronização automática de despesas recorrentes (`syncRecurringExpensesForMonth`) e geração em lote de parcelas (`createInstallments`). |
| `TaxService` | `src/app/core/services/tax.service.ts` | CRUD e sincronização em tempo real de tributos em `users/{userId}/tributos_e_parcelas`. |
| `TravelService` | `src/app/core/services/travel.service.ts` | CRUD e stream em tempo real para controle de gastos de viagem e rateio (`users/{userId}/viagens`). |
| `InstallmentService` | `src/app/core/services/installment.service.ts` | Agrupamento de parcelamentos ativos nos ciclos do usuário e quitação/cancelamento em lote via `writeBatch`. |
| `ExportService` | `src/app/core/services/export.service.ts` | Exportação de balanço e relatórios em CSV (UTF-8 com BOM para Excel), PDF mensal e Dossiê Anual Consolidado das 24 quinzenas do exercício fiscal (`exportAnnualDossierPDF`) com demonstrativo por categoria e tributos para IRPF. |
| `DuoService` | `src/app/core/services/duo.service.ts` | Gestão de pareamento do Plano Casal / Duo: geração e validação de convites, vinculação de contas, stream em tempo real e cálculo de liquidação 50/50 (`calculateSettlement`). |
| `ThemeService` | `src/app/core/services/theme.service.ts` | Gerenciamento reativo de tema (Dark / Light) com persistência em localStorage e sincronização com DOM. |
| `PwaService` | `src/app/core/services/pwa.service.ts` | Monitoramento reativo de conectividade (online/offline), captura de beforeinstallprompt, instalação de PWA e controle de Service Worker. |
| `NotificationService` | `src/app/core/services/notification.service.ts` | Notificações reativas do tipo Toast com Signals (`success`, `error`, `warning`, `info`). |
| `LoggerService` | `src/app/core/services/logger.service.ts` | Logging seguro com supressão de stacktraces e dados de exceção em ambiente de produção (CWE-532). |
| `AdminService` | `src/app/core/services/admin.service.ts` | Gestão administrativa de usuários, papéis RBAC, planos SaaS, cálculo de KPIs de MRR/conversão e persistência/teste de conectividade da integração Asaas (`getAsaasConfig`, `saveAsaasConfig`, `testAsaasConnection`). |
| `AsaasService` | `src/app/core/services/asaas.service.ts` | Integração com Gateway Asaas API v3: tabela oficial de preços, URLs base dinâmicas por ambiente (`getBaseUrl` com proxy dev-server), criação de clientes, assinaturas recorrentes (PIX e Cartão) e processamento seguro de Webhooks. |
| `PlanLimitsService` | `src/app/core/services/plan-limits.service.ts` | Validação de regras e limites da matriz de planos SaaS (Free: máx 3 recorrentes, 3 parcelamentos, 1 tributo, 1 viagem, 2 meses histórico; Pro/Duo: ilimitado, 13 meses e PDF). |

---

## 4. Estado Reativo e Signal Stores (`src/app/core/state/`)

| Store / Signal State | Arquivo | Descrição |
| :--- | :--- | :--- |
| `FinanceStore` | `src/app/core/state/finance.store.ts` | Store centralizada baseada em Signals contendo o mês selecionado (`selectedMonth`), ciclo ativo, despesas da Q1/Q2 e `computed()` com o `MonthBalanceSummary`. |
| `AuthStore` | `src/app/core/state/auth.store.ts` | Estado reativo da sessão do usuário autenticado, upgrade persistente de plano (`upgradeSubscription`) e flags de carregamento. |


---

## 5. Componentes Standalone (`src/app/`)

### A. Shared & UI Primitives (`src/app/shared/components/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `AppCardComponent` | `app-card` | Contêiner estilizado com suporte a glassmorphism, bordas suaves e variantes de destaque. |
| `BalanceBadgeComponent` | `app-balance-badge` | Badge financeiro automático (Verde = superávit / Vermelho = déficit). |
| `DeficitAlertBannerComponent` | `app-deficit-alert-banner` | Banner de alerta condicional disparado quando a Q2 está deficitária ou o mês está no vermelho. |
| `OfflineBannerComponent` | `app-offline-banner` | Banner de aviso de modo offline ativo e diálogo para atualização de versão PWA. |
| `ProgressBarComponent` | `app-progress-bar` | Barra de progresso visual demonstrando percentual gasto em relação à renda prevista. |
| `ToastContainerComponent` | `app-toast-container` | Contêiner flutuante com animações para renderização de alertas Toast. |
| `ConfirmationModalComponent` | `app-confirmation-modal` | Modal de confirmação reutilizável para exclusão ou ações irreversíveis. |
| `BrandLogoComponent` | `app-brand-logo` | Componente de identidade visual que renderiza dinamicamente o símbolo oficial Quinzena (vetor Dark no tema claro e vetor White no tema escuro) com suporte a tamanhos e slogan. |
| `SubscriptionModalComponent` | `app-subscription-modal` | Modal responsivo de checkout e assinatura com planos PRO/DUO mensais sem fidelidade, pagamentos PIX/Cartão e ativação imediata. |
| `LimitReachedModalComponent` | `app-limit-reached-modal` | Modal de bloqueio amigável de limites do plano Free com destaque de benefícios PRO e conversão direta para checkout. |

### B. Core & Navegação (`src/app/core/components/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `NavbarComponent` | `app-navbar` | Barra de navegação superior responsiva com Glassmorphism, links com indicador ativo, perfil do usuário e logout. |

### C. Feature: Dashboard & Finanças (`src/app/features/dashboard/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `DashboardComponent` | `app-dashboard` | Página principal com seletor de mês, top summary cards, grid quinzenal e botões de ação rápida. |
| `DuoPairingModalComponent` | `app-duo-pairing-modal` | Modal de pareamento e gerenciamento de convites do Plano Casal / Duo. |
| `DuoSettlementCardComponent` | `app-duo-settlement-card` | Card no dashboard com divisão proporcional 50/50 de gastos e cálculo de acerto de contas entre os parceiros. |
| `FortnightCardComponent` | `app-fortnight-card` | Card quinzenal completo com resumo de entrada/saída, barra de progresso e listagem de despesas. |
| `ExpenseItemRowComponent` | `app-expense-item-row` | Linha de despesa com checkbox de quitação, badge de categoria, indicador de comprovante e ações de edição/exclusão. |
| `ExpenseFormModalComponent` | `app-expense-form-modal` | Modal com formulário reativo para criação/edição de despesas simples ou em lote parcelado. |
| `IncomeFormModalComponent` | `app-income-form-modal` | Modal para configuração das rendas de Q1 e Q2 com suporte a múltiplos regimes salariais (`quinzenal`, `divisao_50_50`, `mensal_q1`, `mensal_q2`) e distribuição automática. |
| `ReceiptModalComponent` | `app-receipt-modal` | Diálogo rápido para inserção/alteração do código de comprovante da transação. |
| `CategoryDonutChartComponent` | `app-category-donut-chart` | Gráfico Donut em SVG com cálculo proporcional por categoria, tooltips reativos e legenda com percentuais. |
| `MonthlyEvolutionChartComponent` | `app-monthly-evolution-chart` | Gráfico de evolução histórica mensal em barras SVG comparativas (Rendas vs. Gastos vs. Saldo). |
| `ExportModalComponent` | `app-export-modal` | Modal para seleção de formato de exportação (Planilha Excel/CSV ou Relatório PDF/Impressão) com prévia do resumo financeiro. |

### D. Feature: Tributos Anuais (`src/app/features/taxes/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `TaxesListComponent` | `app-taxes-list` | Tabela consolidada de tributos e taxas anuais (IPTU, IPVA, Licenciamento, Bombeiros). |
| `TaxComparisonCardComponent` | `app-tax-comparison-card` | Card comparativo de totais anuais orçados vs. efetivamente pagos. |
| `TaxFormModalComponent` | `app-tax-form-modal` | Modal de inclusão e edição de impostos e taxas. |

### E. Feature: Gastos de Viagem (`src/app/features/travel/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `TravelComponent` | `app-travel` | Gestão de viagens com múltiplos participantes, rateio por pessoa/item, cálculo em tempo real e exportação direta da cota individual para o orçamento quinzenal. |

### F. Feature: Compras Parceladas (`src/app/features/installments/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `InstallmentsComponent` | `app-installments` | Painel de compras parceladas, acompanhamento de progresso de quitação (ex: 3/10), quitação antecipada em lote com writeBatch e cancelamento de parcelas futuras. |

### G. Feature: Autenticação (`src/app/features/auth/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `AuthComponent` | `app-auth` | Tela com abas de Login e Cadastro, suporte a Google Sign-In e recuperação de senha. |

### H. Feature: Configurações & Perfil (`src/app/features/settings/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `SettingsComponent` | `app-settings` | Gestão de perfil (nome de exibição, avatar), alternância de tema Dark/Light e redefinição de senha. |

### I. Feature: Landing Page & Apresentação (`src/app/features/landing/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `LandingComponent` | `app-landing` | Landing Page de conversão de alto impacto com Glassmorphism, proposta de valor dos 4 pilares do Quinzena, mockups interativos, FAQ e CTAs. |

### J. Feature: Administração SaaS (`src/app/features/admin/`)
| Componente | Seletor | Descrição |
| :--- | :--- | :--- |
| `AdminComponent` | `app-admin` | Painel administrativo com abas (Visão Geral & Usuários vs. Integração Asaas), monitoramento global de métricas de SaaS, governança de planos e configuração protegida do gateway de pagamentos com teste de conectividade em tempo real. |

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
| `adminGuard` | `src/app/core/guards/admin.guard.ts` | Guard assíncrono RBAC que valida papel `admin` no `AuthStore`, bloqueia acesso não autorizado com toast de erro e redireciona para `/dashboard`. |

---

## 8. Segurança, Hardening e Regras de Acesso

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `Firestore Security Rules` | `firestore.rules` | Regras com isolamento estrito por `isOwner(userId)`, RBAC administrativo (`isAdmin()`), proteção anti-elevação de privilégio (bloqueio de alteração de `role` e `plan` por usuários comuns), validação estrita de whitelisting de chaves (`keys().hasOnly([...])`) e fechamento de catch-all. |
| `CSV Formula Sanitizer` | `src/app/core/services/export.service.ts` | Sanitização preventiva contra CWE-1236 (CSV Formula Injection) neutralizando operadores (`=`, `+`, `-`, `@`, `\t`, `\r`, `%`) com apóstrofo antes da exportação. |
| `HTML Sanitizer & XSS Escape` | `src/app/core/services/export.service.ts` | Função `escapeHTML()` para prevenção de DOM XSS (CWE-79) em relatórios gerados e impressos em PDF. |
| `HTTPS URL Validator` | `src/app/features/settings/settings.component.ts` | Validação estrita de URLs seguras (`https://`) para imagens de perfil (prevenção contra CWE-79 / XSS via esquemas `javascript:` ou `http:`). |
| `LGPD Right to be Forgotten` | `src/app/core/services/auth.service.ts` / `settings.component.ts` | Exclusão definitiva de conta em cascata (`deleteAccountAndData`) com expurgo total no Firestore e encerramento no Firebase Auth (CWE-404 / LGPD). |
| `Rate Limit Handler` | `src/app/features/auth/auth.component.ts` | Tratamento amigável e bloqueio preventivo para `auth/too-many-requests`. |
| `Hosting Security Headers & CSP` | `firebase.json` | Hardening HTTP com `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy`. |
| `Session & State Cleanup` | `src/app/core/state/auth.store.ts` / `finance.store.ts` | Expurgamento total de dados em memória e cancelamento de streams via `FinanceStore.resetState()` no logout. |
| `Production Logger` | `src/app/core/services/logger.service.ts` | Supressão de stacktraces e vazamento de dados sensíveis no console do cliente em produção (CWE-532). |

---

---

## 9. Arquitetura de Estilos SCSS & Design System (`src/styles/`)

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `Abstracts Index` | `src/styles/abstracts/_index.scss` | Centralizador com `@forward` de colors, variables, mixins e functions. |
| `Colors & Tokens` | `src/styles/abstracts/_colors.scss` | Paleta financeira (Emerald, Carmine, Slate Dark, Glassmorphism) e CSS Custom Properties. |
| `Mixins` | `src/styles/abstracts/_mixins.scss` | Mixins de responsividade (`respond-to` e `respond-below` com suporte a `mobile` e `tablet`), glassmorphism e flex helpers. |
| `Base & Reset` | `src/styles/base/_reset.scss` | Reset CSS moderno e normalizações. |
| `Grid Layout` | `src/styles/layout/_grid.scss` | Layout do dashboard quinzenal (desktop 2 colunas / mobile empilhado). |

---

## 10. CI/CD e Automação de Qualidade

| Artefato | Arquivo | Descrição |
| :--- | :--- | :--- |
| `GitHub Actions CI Pipeline` | `.github/workflows/ci.yml` | Pipeline que executa linting, typecheck, suíte de testes unitários e build de produção do Angular. |
