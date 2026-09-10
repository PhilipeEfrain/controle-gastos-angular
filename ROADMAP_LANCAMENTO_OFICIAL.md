# 🚀 Plano de Prontidão para o Lançamento Oficial (Go-Live Readiness Roadmap)
**Produto:** Controle de Gastos Quinzenais (Angular 19 + Firebase + Asaas)  
**Autor:** Equipe Multidisciplinar de Agentes (PM, PO, SEC, UX, DEV, QA)  
**Data:** Setembro de 2026  
**Status do Projeto:** Pré-Lançamento (Beta Maduro)

---

## 1. Diagnóstico Executivo: Onde Estamos Hoje

O aplicativo atingiu um patamar de maturidade técnica e funcional de nível sênior, com arquitetura reativa moderna baseada em Angular Standalone Components, Signals, Firebase Modular SDK e isolamento estrito por usuário no Cloud Firestore.

### Indicadores de Qualidade Atual
- **Cobertura de Testes:** 54 suítes de testes unitários com **318 testes passando com 100% de sucesso**.
- **Compilação de Produção:** Build de produção (`ng build`) verde, com divisão inteligente de chunks via lazy-loading.
- **Segurança da Informação:**
  - Hardening de cabeçalhos HTTP e CSP rígida no `firebase.json`.
  - Regras de segurança no Firestore (`firestore.rules`) com RBAC e validação estrita de whitelisting de chaves.
  - Sanitização preventiva contra injeção de fórmulas em planilhas (CWE-1236) e prevenção de DOM XSS (CWE-79).
  - Supressão de vazamento de credenciais e stacktraces em logs de produção (CWE-532).
  - Conformidade com LGPD para exclusão definitiva de conta (Direito ao Esquecimento).

---

## 2. Pilares Funcionais Concluídos

| Pilar | Escopo Entregue | Status |
| :--- | :--- | :---: |
| **Autenticação & Sessão** | Login/Cadastro por E-mail e Google Sign-In, recuperação de senha, persistência reativa e proteção contra perda de sessão no F5 via `ensureInitialized()`. | ✅ Concluído |
| **Orçamento Quinzenal** | Divisão de ciclo em Quinzena 1 (Dia 31) e Quinzena 2 (Dia 15), suporte a múltiplos regimes salariais, rendas extras, barra de progresso visual, cálculo de déficit e compensação de fluxo de caixa entre quinzenas. | ✅ Concluído |
| **Compras Parceladas** | Projeção em lote para meses futuros subsequentes, acompanhamento de progresso de quitação (ex: 3/10), amortização antecipada via `writeBatch` e cancelamento de saldo devedor futuro. | ✅ Concluído |
| **Tributos e Sazonais** | Gestão anual de IPTU, IPVA, Licenciamento e Taxa de Bombeiros com comparativo em tempo real de valores orçados vs. efetivamente pagos. | ✅ Concluído |
| **Gastos de Viagem** | Painel de viagens com múltiplos participantes, conversão multimoedas e rateio proporcional por item com exportação direta para a quinzena do usuário. | ✅ Concluído |
| **Modo Casal / Duo** | Sistema de convites de pareamento por código, sincronização bidirecional em tempo real e cálculo automático de acerto de contas 50/50 (*Settlement*). | ✅ Concluído |
| **Relatórios e Auditoria** | Exportação de planilha em CSV sanitizada para Excel, relatório mensal impresso/PDF e Dossiê Anual das 24 quinzenas consolidado para declaração de IRPF. | ✅ Concluído |
| **PWA & Responsividade** | Manifesto PWA, suporte a modo offline com alerta contextual, Design System SCSS com Dark Mode e layout responsivo desktop/mobile. | ✅ Concluído |
| **Administração SaaS** | Painel restrito a administradores com listagem de usuários, controle RBAC, gestão de planos e tela de configuração protegida do Gateway Asaas com teste de conectividade. | ✅ Concluído |
| **Checkout Inicial** | Modal de assinatura com escolha de ciclo (Mensal/Anual) e planos (Free, Pro, Duo), integração com API v3 do Asaas para PIX (com QR Code dinâmico) e Cartão de Crédito com validação estrita de CPF. | ✅ Concluído |

---

## 3. Matriz de Lacunas para o Lançamento Oficial

Apesar da riqueza funcional do aplicativo, existem lacunas que separam o projeto atual de uma operação comercial independente e em conformidade com as exigências legais e de mercado.

```
                          MATRIZ DE RISCO & IMPACTO
           Alta  │ [P1: Termos & LGPD]        [P0: Webhook Recorrência]
                 │ [P1: Minha Assinatura]     [P0: Inadimplência/Dunning]
  IMPACTO        │                            [P0: Chave Asaas Produção]
                 ├───────────────────────────────────────────────────────
           Baixa │ [P2: Ajuste SCSS Budget]   [P2: Domínio Oficial]
                 │                            [P2: Monitoramento Sentry]
                 └───────────────────────────────────────────────────────
                                    Baixa                       Alta
                                         URGÊNCIA
```

---

### 🔴 P0: Bloqueadores Críticos de Go-Live (Showstoppers)
*Sem estes itens, o produto não pode receber clientes pagantes reais.*

#### 1. Endpoint de Webhook do Asaas (Firebase Cloud Function) — [CARD-039 / Issue #81]
- **Problema:** A aplicação Angular roda 100% no navegador do usuário. Quando o cliente paga um PIX ou sua fatura mensal do cartão de crédito é renovada no Asaas, não há um servidor público para receber as notificações via HTTP do gateway.
- **Risco:** O cliente realiza o pagamento com dinheiro real e o aplicativo não libera o plano PRO nem renova o vencimento de forma automática, exigindo intervenção manual constante.
- **Solução Técnica:**
  - Setup do diretório `functions` com Node.js 20 e TypeScript.
  - Endpoint `POST /asaasWebhook` implementado via `onRequest` (Firebase Functions v2).
  - Validação rigorosa de autenticidade através do header `asaas-access-token` comparado ao segredo seguro cadastrado.
  - Mapeamento dos eventos:
    - `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`: Define `planStatus = 'active'` e renova `planExpiresAt` para D+30 dias.
    - `PAYMENT_OVERDUE`: Define `planStatus = 'past_due'` e inicia carência de 3 dias (`gracePeriodExpiresAt`).
    - `SUBSCRIPTION_INACTIVATED` / `SUBSCRIPTION_DELETED`: Rebaixa para `plan = 'free'` e `planStatus = 'canceled'`.
  - Tabela de auditoria e idempotência em `system_events/webhooks/{eventId}` para evitar reprocessamento duplicado.

#### 2. Política de Inadimplência, Grace Period e Banner no Frontend — [CARD-040 / Issue #82]
- **Problema:** O `AuthStore` atual concede privilégios de plano avaliando apenas `plan === 'pro'`, sem considerar se a assinatura está com pagamento pendente (`planStatus === 'past_due'`) ou cancelada.
- **Risco:** O usuário pode deixar de pagar a mensalidade e continuar utilizando recursos ilimitados sem qualquer bloqueio ou aviso, gerando vazamento de receita (*involuntary churn*).
- **Solução Técnica:**
  - Atualização do `isProOrDuo` no `AuthStore` e `PlanLimitsService` para validar se o plano está ativo ou dentro do Grace Period (3 dias corridos).
  - Banner de alerta visual no topo do Dashboard:
    - *Estado 1 (Dentro do Grace Period):* Alerta âmbar amigável informando a data limite da tolerância e atalho de regularização rápida.
    - *Estado 2 (Após Grace Period):* Alerta vermelho informando a suspensão temporária dos novos cadastros ilimitados.
  - **Preservação de Dados:** Garantia irrestrita de que todas as despesas, parcelamentos e tributos criados no passado permaneçam visíveis e intactos mesmo em caso de suspensão da assinatura.

#### 3. Habilitação da Conta Asaas em Modo Produção
- **Problema:** A aplicação opera no ambiente Sandbox de testes do Asaas.
- **Risco:** Impossibilidade de movimentar valores financeiros reais e emitir cobranças válidas perante o Banco Central.
- **Ação Operacional:**
  - Submeter a aprovação da conta jurídica (PJ) ou MEI no painel oficial do Asaas.
  - Inserir a `productionApiKey` no painel administrativo `/admin` e alternar o switch de ambiente para `Produção`.

---

### 🟡 P1: Essenciais para Operação, Compliance e Retenção
*Itens indispensáveis para conformidade legal e experiência autônoma do usuário.*

#### 4. Termos de Uso e Política de Privacidade (Conformidade com a LGPD)
- **Problema:** Aplicações financeiras que coletam dados bancários, hábitos de consumo e CPF necessitam de bases legais explícitas de processamento de dados para operar no Brasil.
- **Risco:** Risco de sanções da ANPD, insegurança jurídica e reprovação da verificação do Google OAuth (Google Sign-In para domínios públicos).
- **Solução:**
  - Criação das páginas públicas `/termos` e `/privacidade`.
  - Link obrigatório no rodapé da Landing Page e checkbox de aceite tácito no formulário de cadastro de novos usuários.
  - Banner de consentimento de cookies da LGPD.

#### 5. Gestão de Assinatura pelo Usuário (Self-Service)
- **Problema:** O assinante não possui uma tela para consultar a data da próxima fatura, atualizar o cartão de crédito cadastrado ou solicitar o cancelamento voluntário do plano.
- **Risco:** Reclamações de suporte operacional, aumento de cancelamentos forçados e potenciais disputas de chargeback.
- **Solução:**
  - Adição da aba "Minha Assinatura" na tela de Configurações (`/settings`).
  - Consulta aos dados da assinatura vigente no Asaas (`GET /v3/subscriptions/{id}`).
  - Fluxo para atualização dos dados do cartão de crédito.
  - Botão de cancelamento voluntário, assegurando a permanência do acesso PRO até o término do ciclo já pago.

#### 6. Onboarding e Empty State Guiado (Ativação de Novos Usuários)
- **Problema:** Ao criar uma conta nova, o usuário encontra o mês inicial completamente zerado, o que pode causar o "efeito paralisia por tela vazia".
- **Risco:** Abandono prematuro da plataforma no primeiro dia antes de perceber a utilidade do balanço quinzenal.
- **Solução:**
  - Componente de boas-vindas com checklist interativo de ativação:
    1. *Configurar a renda quinzenal.*
    2. *Cadastrar a primeira despesa fixa.*
    3. *Conferir a análise automática de superávit/déficit.*

#### 7. Canal de Suporte e Feedback no App
- **Problema:** Não há um canal ágil para o usuário relatar falhas, dúvidas operacionais ou problemas de pagamento.
- **Solução:**
  - Botão flutuante ou link no rodapé/menu para atendimento direto via WhatsApp ou e-mail de suporte dedicado.

---

### 🟢 P2: Otimização de Performance, SEO e Crescimento (Pós Go-Live)
*Aprimoramentos técnicos e de marketing para alavancar a tração.*

| Item | Descrição |
| :--- | :--- |
| **Domínio Próprio & SSL** | Mapear o Firebase Hosting para um domínio personalizado (ex: `quinzena.app` ou `quinzenaapp.com.br`) com certificado SSL gerenciado pelo Google Cloud. |
| **Metatags OpenGraph e Favicon Oficial** | Ajustar as tags `og:title`, `og:description`, `og:image` no `index.html` para previews nos aplicativos de mensagens (WhatsApp, Telegram) e redes sociais. |
| **Monitoramento de Erros (Sentry/Crashlytics)** | Integrar telemetria de erros no frontend para monitorar exceptions em tempo real sem depender de relatos manuais dos clientes. |
| **Resolução do Warning de SCSS Budget** | Ajustar o orçamento de compilação do `admin.component.scss` no `angular.json` ou segmentar o arquivo em sub-folhas modulares para manter o build totalmente limpo. |

---

## 4. Cronograma de Execução Recomendado (Sprint de Go-Live)

```
================================================================================
FASE 1: AUTOMAÇÃO DE MONETIZAÇÃO & SEGURANÇA (P0) - 100% CONCLUÍDA
================================================================================
[x] CARD-037: Envio obrigatório de creditCardHolderInfo no Asaas (Concluído)
[x] CARD-038: Resolução de ID de cobrança para PIX dinâmico (Concluído)
[x] CARD-039: Endpoint de Webhook do Asaas via Firebase Cloud Functions (Concluído)
[x] CARD-040: Política de Inadimplência, Grace Period e Banner no Frontend (Concluído)
[ ] Configuração e homologação das credenciais de Produção do Asaas

================================================================================
FASE 2: CONFORMIDADE, SELF-SERVICE & VISIBILIDADE DE VENCIMENTOS (P1)
================================================================================
[ ] CARD-041: Painel "Minha Assinatura" em /settings (Data de Expiração, Próxima Cobrança, Troca de Cartão e Cancelamento)
[ ] CARD-042: Visibilidade de Vencimentos, Próxima Cobrança e Auditoria de Assinaturas no Painel Admin (/admin)
[ ] CARD-043: Páginas públicas de Termos de Uso, Política de Privacidade e Consentimento LGPD
[ ] CARD-044: Checklist guiado de Onboarding e Primeiro Acesso com Empty State Interativo
[ ] CARD-045: Widget e Canal de Suporte / Atendimento ao Cliente no App

================================================================================
FASE 3: LANÇAMENTO OFICIAL & GO-LIVE (P2)
================================================================================
[ ] Apontamento de Domínio Próprio no Firebase Hosting
[ ] Configuração de Metatags OpenGraph e SEO
[ ] Auditoria final de segurança (`npm audit` zero vulnerabilidades)
[ ] Abertura do app para o público e início das campanhas de tráfego!
```

---

## 5. Checklist de Verificação para o Lançamento (Definition of Done)

- [ ] Todas as cobranças PIX e Cartão ativam o plano PRO imediatamente no Firestore via Webhook sem interferência manual.
- [ ] Usuários inadimplentes recebem aviso amigável de tolerância de 3 dias antes do bloqueio de novas criações.
- [ ] 100% dos dados históricos dos usuários permanecem seguros e acessíveis mesmo se o plano for cancelado.
- [ ] Links para Termos de Uso e Privacidade estão ativos e visíveis no rodapé.
- [ ] A conta Asaas está validada para transações com dinheiro real no ambiente de Produção.
- [ ] O domínio próprio responde com HTTPS e certificado SSL válido.
- [ ] A suíte com 318 testes unitários continua passando com 100% de sucesso.
