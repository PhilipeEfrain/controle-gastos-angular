# Entendimento do Negócio e Especificação Técnica - Controle de Gastos Quinzenais (Angular + Firebase)

## 1. Visão Geral do Produto

O **Controle de Gastos Quinzenais** é uma aplicação web moderna e responsiva (Single Page Application - SPA) desenvolvida em **Angular** (versão moderna com Standalone Components e Signals) integrada ao **Firebase** (Authentication, Cloud Firestore, Cloud Storage e Hosting).

O aplicativo atende à necessidade de gerenciar o orçamento pessoal e familiar com base no fluxo de recebimentos e pagamentos **quinzenais** (estruturado com base nos pagamentos do **Dia 31 / 1º período** e do **Dia 15 / 2º período**), além de manter controle dedicado de **compras parceladas** e **tributos/impostos anuais sazonais** (como IPTU, IPVA, Licenciamento e Taxa de Bombeiros).

---

## 2. Arquitetura de Dados (Cloud Firestore)

A modelagem de dados NoSQL é estritamente isolada por usuário (`userId`), garantindo segurança, privacidade e facilidade de sincronização reativa em tempo real.

```
users/{userId}
  ├── profile data (nome, email, avatar, preferências)
  │
  ├── ciclos_mensais/{mesAno}  (ex: "2025-03", "2026-08")
  │     ├── renda_quinzena_1: number  (Dia 31)
  │     ├── renda_quinzena_2: number  (Dia 15)
  │     ├── total_renda: number
  │     ├── total_gastos: number
  │     ├── saldo_final: number
  │     │
  │     └── despesas/{expenseId}
  │           ├── descricao: string
  │           ├── valor: number
  │           ├── quinzena: 1 | 2
  │           ├── status_pagamento: boolean
  │           ├── codigo_comprovante?: string (ex: "137", "0482")
  │           ├── categoria: string (ex: Moradia, Veículo, Cartão, Serviços, Alimentação)
  │           ├── recorrente?: boolean
  │           ├── data_vencimento?: string (YYYY-MM-DD)
  │           ├── parcela_atual?: number (ex: 1)
  │           ├── total_parcelas?: number (ex: 10)
  │           └── grupo_parcela_id?: string (UUID da compra parcelada)
  │
  └── tributos_e_parcelas/{taxId}
        ├── titulo: string (ex: "IPTU 2025", "IPVA 2025 - Licenciamento", "Taxa de Bombeiros")
        ├── data_vencimento: string (YYYY-MM-DD)
        ├── valor_orcado: number
        ├── valor_pago: number
        └── status: "Pendente" | "Pago"
```

---

## 3. Regras de Negócio e Cálculos Financeiros

### A. Separação Quinzenal e Ciclos Mensais
1. **Quinzena 1 (Dia 31 / 1º Período)**:
   - Recebe a primeira fatia de renda do ciclo.
   - Agrupa despesas fixas e variáveis programadas para a 1ª quinzena.
   - $\text{Saldo Q1} = \text{Renda Q1} - \sum \text{Despesas Q1}$

2. **Quinzena 2 (Dia 15 / 2º Período)**:
   - Recebe a segunda fatia de renda do ciclo.
   - Agrupa despesas da 2ª quinzena.
   - $\text{Saldo Q2} = \text{Renda Q2} - \sum \text{Despesas Q2}$

### B. Balanço Global e Análise de Déficit Quinzenal
- $\text{Total Renda} = \text{Renda Q1} + \text{Renda Q2}$
- $\text{Total Despesas} = \text{Total Despesas Q1} + \text{Total Despesas Q2}$
- $\text{Saldo Final} = \text{Total Renda} - \text{Total Despesas}$
- **Análise de Cobertura**:
  - Se a Quinzena 2 fecha deficitária ($\text{Saldo Q2} < 0$), o sistema verifica se a sobra da Quinzena 1 cobre o rombo: $\text{Saldo Q1} + \text{Saldo Q2} \ge 0$.
  - Se cobrir, exibe alerta informativo de compensação de fluxo de caixa.
  - Se não cobrir (ou se o saldo final for negativo), exibe banner crítico de alerta de déficit orçamentário.

### C. Compras Parceladas em Lote (`Installments Engine`)
- Ao cadastrar uma compra parcelada (ex: 10 parcelas de R$ 150,00), o motor financeiro projeta e persiste os lançamentos nos respectivos meses futuros subsequentes (`mesAno`, `mesAno + 1`, ...), vinculando-os através de um `grupo_parcela_id`.

### D. Tributos e Impostos Sazonais (`Tributos e Parcelas Anuais`)
- Gestão independente de despesas sazonais do ano.
- Comparativo em tempo real entre **Valor Orçado/Previsto** e **Valor Efetivamente Pago** (com indicação de variação percentual ou monetária).
- Marcação de status de quitação com data de liquidação.

### E. Comprovantes e Liquidação Rápida
- Checkbox de quitação com atualização otimista na interface e sincronização no Firestore.
- Campo de identificação numérica rápida do comprovante bancário (`codigo_comprovante`), facilitando a conferência com extratos bancários.

---

## 4. Módulos e Telas do Sistema (Angular SPA)

1. **Módulo de Autenticação (`/auth`)**:
   - Login e Cadastro com E-mail/Senha e Google Sign-In.
   - Recuperação de senha e tratamento amigável de erros de autenticação Firebase.
   - Route Guards (`authGuard` e `publicGuard`).

2. **Dashboard Principal (`/dashboard`)**:
   - Seletor de Ciclo Mensal (`< YYYY-MM >`) com navegação fluida entre meses.
   - Resumo Top Cards: Total de Renda, Total de Despesas, Saldo Consolidado e Badge de Status Financeiro.
   - Banner Dinâmico de Déficit (quando aplicável).
   - Visão em Duas Colunas / Cards Quinzenais:
     - Card Quinzena 1 (Entrada, Saídas, Saldo, Barra de Progresso de Gastos, Lista de Despesas com Checkbox e Código de Comprovante).
     - Card Quinzena 2 (Entrada, Saídas, Saldo, Barra de Progresso de Gastos, Lista de Despesas com Checkbox e Código de Comprovante).
   - Ações Rápidas: Adicionar Despesa, Configurar Renda do Mês, Lançar Compra Parcelada, Visualizar Tributos.

3. **Modais e Diálogos Reativos**:
   - `ExpenseFormModal`: Cadastro/edição de despesa simples ou parcelada.
   - `IncomeFormModal`: Definição/ajuste das rendas de Q1 e Q2.
   - `ReceiptModal`: Inserção/edição expressa do código de comprovante.
   - `TaxesModal`: Listagem, inclusão e comparativo previsto vs. pago de impostos anuais.

4. **Módulo de Tributos e Sazonais (`/tributos`)**:
   - Visão consolidada anual, total orçado no ano x total pago, filtros por status (Pendente / Pago).

---

## 5. Padrões de Engenharia Angular

- **Arquitetura Standalone**: Sem `NgModule`, componentes limpos e modulares com injeção de dependência moderna (`inject()`).
- **Reatividade com Signals**:
  - `signal()`, `computed()` e `effect()` para gerenciamento de estado previsível e de alta performance (Zone-less ready / OnPush Change Detection).
  - RxJS com `toSignal` para integração com streams do Firestore (`collectionData`, `docData`).
- **Formulários Reativos**: `ReactiveFormsModule` tipado com validações customizadas (moeda BRL, parcelamento).
- **Estilização e Design System**: **SCSS Modular** (Padrão de abstrações, variáveis e mixins) com Design Tokens em CSS Custom Properties para Dark Mode e paleta financeira personalizada (Esmeralda, Carmim/Ruby, Slate Dark, Glassmorphism).


## 6. GitHub
- **Método de acesso**: GitHub CLI (`gh`) autenticado para gerenciamento de Issues, PRs e Kanban.
- **URL do repositório**: https://github.com/PhilipeEfrain/controle-gastos-angular.git
- **Nome do repositório**: controle-gastos-angular
- **Controle do projeto e Kanban**: https://github.com/users/PhilipeEfrain/projects/5

---

## 7. Firebase Cloud
- **Project ID**: `controle-gastos-app-36264`
- **Project Name**: Controle de Gastos Quinzenais
- **App ID (Web)**: `1:562686483207:web:8f8fb528069c1af4b083a2`
- **Auth Domain**: `controle-gastos-app-36264.firebaseapp.com`
- **Storage Bucket**: `controle-gastos-app-36264.firebasestorage.app`