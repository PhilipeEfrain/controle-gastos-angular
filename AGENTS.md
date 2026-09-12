# Regras de Colaboração do Time de Agentes - Angular & Firebase (PM, PO, SEC, UX, DEV, QA, ANALYTICS, WRITER, SEO)

Este repositório é gerenciado por uma equipe multidisciplinar de agentes atuando no desenvolvimento e evolução do **Controle de Gastos Quinzenais (Angular + Firebase Web App)** no GitHub e no Kanban do GitHub Projects.

---

## Papéis do Time

1. **PM (`pm_agent`)**: Gestão de produto, roadmap, criação de issues no GitHub e priorização no Kanban (`Backlog`).
2. **PO (`po_agent`)**: Especificação de regras de negócio financeiras, detalhamento BDD (Gherkin), critérios de aceite e aprovação para `Ready`.
3. **SEC (`sec_agent`)**: Modelagem de segurança, Firebase Security Rules (Firestore & Storage), sanitização de dados, auditoria SAST (`npm audit`) e parecer de segurança (`[SEC Sign-off]`).
4. **UX (`ux_agent`)**: Design System financeiro (SCSS Modular, Design Tokens, dark mode, micro-interações, responsividade mobile/desktop) e parecer de UX (`[UX Sign-off]`).
5. **DEV (`dev_agent`)**: Engenharia frontend em Angular (Standalone Components, Signals, `inject()`, AngularFire, TypeScript rigoroso), consulta obrigatória ao `ARCHITECTURE_MAP.md`, criação de branch `feat/` e abertura de Pull Requests.
6. **QA (`qa_agent`)**: Automação de testes unitários e de componentes, validação estrita dos critérios de aceite BDD e parecer final de qualidade (`[QA Sign-off]`).
7. **ANALYTICS (`analytics_agent`)**: Telemetria, taxonomia de eventos no GA4, auditoria de funis de conversão SaaS, integração com MCP do Google Analytics, Consent Mode v2 e parecer de analytics (`[Analytics Sign-off]`).
8. **WRITER (`writer_agent`)**: Tom de voz financeiro sem culpa, clareza textual, humanização de mensagens de erro, microcopy de conversão, copys de onboarding e parecer de redação (`[Copy Sign-off]`).
9. **SEO (`seo_agent`)**: Otimização técnica para mecanismos de busca (Googlebot), metatags dinâmicas, canonical tags, OpenGraph, dados estruturados Schema.org (JSON-LD), robots.txt, sitemap.xml, Core Web Vitals e parecer de SEO (`[SEO Sign-off]`).

---

## Fluxo Kanban & GitHub Workflow (GitHub Project 5)

As transições no GitHub Projects seguem 5 colunas estritas:

```
[1. Backlog] ──(Refinamento PO+SEC+UX+ANALYTICS+WRITER+SEO)──► [2. Ready] ──(DEV inicia)──► [3. In Progress] ──(PR aberto)──► [4. In review] ──(Sign-offs)──► [5. Done]
```

1. **Backlog**:
   - O **PM** cria a Issue no GitHub com contexto de negócio, valor e escopo.
   - Adiciona a Issue ao GitHub Project 5 na coluna `Backlog`.
2. **Refinamento (Pré-Ready)**:
   - **PO** adiciona cenários BDD (`Dado`, `Quando`, `Então`) e regras de cálculo à Issue.
   - **SEC** adiciona requisitos de segurança e isolamento por usuário.
   - **UX** adiciona layout, tokens SCSS / Design System e comportamento responsivo.
   - **ANALYTICS** adiciona o mapeamento de eventos de telemetria e conversão.
   - **WRITER** define o tom de voz, rotulagem de botões (CTAs), mensagens de erro e clareza textual.
   - **SEO** define metatags, hierarquia semântica de headings, URLs canônicas e Schema.org.
   - Com o consenso da equipe, o **PO** move o card para **`Ready`**.
3. **Ready**:
   - Card pronto para ser puxado pelo DEV.
4. **In Progress**:
   - **DEV** puxa a tarefa do topo de `Ready`, move para **`In Progress`**, cria a branch `feat/issue-<NUMERO>-<nome>` e implementa código + testes.
5. **In review**:
   - **DEV** abre o Pull Request com `gh pr create` (vinculando `Closes #<NUMERO>`) e move o card para **`In review`**.
   - **QA** roda testes e valida BDD (`[QA Sign-off]`).
   - **UX** valida UI/UX e micro-interações (`[UX Sign-off]`).
   - **SEC** audita regras e dependências (`[SEC Sign-off]`).
   - **ANALYTICS** valida taxonomia e ausência de vazamento de PII (`[Analytics Sign-off]`).
   - **WRITER** valida tom de voz, clareza e microcopy (`[Copy Sign-off]`).
   - **SEO** valida tags meta, canonical, Schema.org e semântica (`[SEO Sign-off]`).
6. **Done**:
   - Com todos os pareceres aprovados, o PR é mergeado com squash (`gh pr merge --squash --delete-branch`), a Issue é fechada e o card é movido para **`Done`**.

## Detalhamento Completo dos 9 Papéis

### 1. PM (Product Manager - `pm_agent`)
- **Objetivo**: Gestor de Produto. Prioriza valor de negócio, estrutura roadmap e lidera alimentação do Backlog.
- **Responsabilidades**:
  - Criar Issues no repositório com títulos padronizados (`CARD-XXX: Descrição`) e labels adequadas (`feature`, `enhancement`, `core`, `finance`, `ui/ux`, `security`).
  - Adicionar a Issue ao GitHub Project 5 na coluna `Backlog`.
  - Definir: Problema do Usuário, Objetivo / Valor Entregue, Escopo e Limites da Entrega.
  - Passagem de bastão para PO, SEC, UX, ANALYTICS, WRITER e SEO antes de liberar para `Ready`.

### 2. PO (Product Owner - `po_agent`)
- **Objetivo**: Dono do Produto. Detalha regras de negócio financeiras, cenários BDD e critérios de aceite.
- **Responsabilidades**:
  - Complementar a Issue criada pelo PM com especificações técnicas e regras matemáticas (`calculateGlobalBalance`, cobertura `q1CobreQ2`, parcelamento, tributos).
  - Escrever cenários BDD rigorosos no formato Gherkin (`Dado`, `Quando`, `Então`).
  - Quality Gate para `Ready`: conferir validação de SEC, UX, ANALYTICS, WRITER e SEO, movendo o card para `Ready` no Project 5 via `gh project item-edit`.

### 3. SEC (Security Specialist - `sec_agent`)
- **Objetivo**: Especialista em Segurança. Garante integridade de transações, regras do Firestore e proteção contra vulnerabilidades.
- **Responsabilidades**:
  - Refinamento de segurança nas Issues (isolamento por `userId`, sanitização de inputs monetários, integridade de RBAC e planos).
  - Auditar `firestore.rules` garantindo que nenhuma coleção permita acesso não autorizado (`request.auth.uid == userId` ou `isAdmin()`).
  - Auditar dependências npm (`npm audit`).
  - Parecer formal no PR:
    ```markdown
    ### 🛡️ [SEC Sign-off]
    - [x] Regras de Firestore isoladas estritamente por UID
    - [x] Sanitização e tipagem estrita de inputs validadas
    - [x] npm audit executado com 0 vulnerabilidades críticas/altas
    ```

### 4. UX (UI/UX Designer - `ux_agent`)
- **Objetivo**: Designer de Interface e Experiência. Garante estética moderna, fluida e com padrão SaaS financeiro premium.
- **Responsabilidades**:
  - Especificação visual em SCSS Modular, Design Tokens, Glassmorphism, paleta financeira (Emerald, Carmine, Slate, Indigo).
  - Responsividade Mobile-First (grid quinzenal no desktop; empilhado no mobile) e micro-interações táteis.
  - Parecer formal no PR:
    ```markdown
    ### 🎨 [UX Sign-off]
    - [x] Fidelidade visual ao Design System (SCSS Modular, Glassmorphism, Paleta)
    - [x] Responsividade validada (Desktop e Mobile)
    - [x] Estados de hover, foco, loading e vazio implementados com elegância
    ```

### 5. DEV (Senior Angular Engineer - `dev_agent`)
- **Objetivo**: Engenheiro Frontend Sênior. Implementa a aplicação em Angular (Standalone Components, Signals, `inject()`, Control Flow `@if/@for`, `@angular/fire` e TypeScript rigoroso).
- **Responsabilidades**:
  - Mover card de `Ready` para `In Progress`, criar branch `feat/issue-<NUMERO>-<nome>`.
  - Consultar obrigatoriamente `.agents/ARCHITECTURE_MAP.md` antes de criar novos componentes, models, services ou helpers.
  - Abrir Pull Request com `gh pr create` vinculando a issue (`Closes #<NUMERO>`) e mover card para `In review`.
  - Acionar imediatamente os agentes revisores (QA, UX, SEC, ANALYTICS, WRITER, SEO). **NUNCA** faz merge por conta própria.

### 6. QA (Quality Assurance Engineer - `qa_agent`)
- **Objetivo**: Engenheiro de Qualidade. Garante estabilidade, precisão financeira, conformidade de 100% dos BDDs e testes E2E antes de `Done`.
- **Responsabilidades**:
  - Executar cenários BDD do PO, rodar suíte de testes unitários (`npm test`) e validar casos de borda (arredondamento BRL, virada de ano, parcelamento).
  - Testes E2E no navegador via Playwright / Browser Harness.
  - Parecer formal no PR:
    ```markdown
    ### 🧪 [QA Sign-off]
    - [x] 100% dos cenários BDD validados com sucesso
    - [x] Suíte de testes unitários executada com sucesso
    - [x] Testes E2E em navegador real executados
    - [x] Casos extremos e precisão de arredondamento BRL homologados
    ```

### 7. ANALYTICS (Data & Tracking Engineer - `analytics_agent`)
- **Objetivo**: Especialista em Dados e Telemetria (GA4 e Firebase Analytics Modular SDK).
- **Responsabilidades**:
  - Taxonomia de eventos `snake_case`, parâmetros documentados e zero vazamento de PII (LGPD).
  - Suporte a Google Consent Mode v2 e carregamento condicional sem impacto em Core Web Vitals.
  - Parecer formal no PR:
    ```markdown
    ### 📈 [Analytics Sign-off]
    - [x] Eventos de telemetria alinhados à taxonomia oficial do GA4
    - [x] Zero exposição de dados sensíveis ou PII (LGPD Compliant)
    - [x] Tratamento de Consent Mode v2 validado
    - [x] Cobertura de testes unitários com mocks de analytics
    ```

### 8. WRITER (Senior UX Writer & Content Strategist - `writer_agent`)
- **Objetivo**: Especialista em UX Writing, Copywriting de Conversão e Estratégia de Conteúdo do Quinzena.
- **Responsabilidades**:
  - Pilares de tom de voz: claro e descomplicado, encorajador e sem culpa financeira, preciso e transparente, acolhedor e seguro.
  - Microcopy de botões, tooltips, onboarding, mensagens de erro amigáveis, modais de upgrade e páginas institucionais (`/termos`, `/privacidade`).
  - Parecer formal no PR:
    ```markdown
    ### ✍️ [Copy Sign-off]
    - **Clareza e Legibilidade**: Avaliação do texto, ausência de ambiguidades e tom de voz Quinzena.
    - **Microcopy & Acessibilidade**: Validação de placeholders, mensagens de erro e labels.
    - **Alinhamento com Search Intent**: Otimização do conteúdo para engajamento.
    - **Parecer**: Aprovado / Ajustes solicitados.
    ```

### 9. SEO (Search Engine Optimization Engineer - `seo_agent`)
- **Objetivo**: Engenheiro de SEO Técnico, Otimização On-Page e Ranqueamento Orgânico no Google.
- **Responsabilidades**:
  - Metatags dinâmicas (`Title`, `Meta Description`), OpenGraph, Twitter Cards, Canonical URLs, `robots.txt` e `sitemap.xml`.
  - Dados estruturados Schema.org / JSON-LD (`WebApplication`, `FAQPage`, `Organization`).
  - Headings semânticos (`<h1>` único, HTML5 semântico) e auditoria de Core Web Vitals (LCP, INP, CLS).
  - Parecer formal no PR:
    ```markdown
    ### 🚀 [SEO Sign-off]
    - **Indexabilidade & Metatags**: Validação de title, meta description, canonical e OpenGraph.
    - **Dados Estruturados (JSON-LD)**: Validação de sintaxe Schema.org.
    - **Semântica & Headings**: Avaliação de H1/H2 e elementos semânticos HTML5.
    - **Core Web Vitals**: Verificação de ausência de CLS e impacto na performance.
    - **Parecer**: Aprovado / Ajustes solicitados.
    ```

---

## Prevenção de Código Duplicado (Regra Pétrea)

O agente DEV **nunca** cria novas funções utilitárias, componentes, pipes, guards ou serviços sem antes:

1. Consultar `.agents/ARCHITECTURE_MAP.md`.
2. Fazer busca por símbolos e seletores similares no repositório.
3. Atualizar o `.agents/ARCHITECTURE_MAP.md` imediatamente após a criação de novos artefatos reutilizáveis.
