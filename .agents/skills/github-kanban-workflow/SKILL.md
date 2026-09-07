---
name: github-kanban-workflow
description: Guia operacional do GitHub CLI (gh) para gerenciamento de Issues, Branches, Pull Requests, Reviews e fluxo de Kanban no GitHub Projects.
---

# Skill: GitHub & Kanban Workflow CLI

Esta skill documenta o fluxo operacional padrão para interação com o repositório GitHub e o **GitHub Project 5 (`Controle de gastos`)**, garantindo que o time de agentes atue de maneira estruturada e colaborativa.

---

## 1. Identificadores do GitHub Project

- **Owner**: `PhilipeEfrain`
- **Repo**: `PhilipeEfrain/controle-gastos-angular`
- **Project Number**: `5`
- **Project ID**: `PVT_kwHOAgvK3c4Bh6Nk`
- **Field Status ID**: `PVTSSF_lAHOAgvK3c4Bh6Nkzhg0I5w`

### Colunas e Option IDs de Status:
| Coluna / Status | Option ID | Descrição |
| :--- | :--- | :--- |
| **`Backlog`** | `9143e0d7` | Card criado pelo PM aguardando refinamento. |
| **`Ready`** | `f75ad846` | Especificado com BDD (PO), seguro (SEC) e desenhado (UX). |
| **`In Progress`** | `47fc9ee4` | DEV trabalhando ativamente na branch. |
| **`In review`** | `5a6f59fd` | PR aberto aguardando QA, SEC e UX reviews. |
| **`Done`** | `98236657` | PR aprovado e mergeado na `main`. |

---

## 2. Comandos Operacionais no GitHub Projects

### A. Criar Issue e Adicionar ao Project
```bash
# 1. Criar a Issue no repositório
gh issue create \
  --repo PhilipeEfrain/controle-gastos-angular \
  --title "CARD-001: Setup do Projeto Angular com Tailwind e Firebase" \
  --body "Corpo da issue com BDD e especificações" \
  --label "feature,core"

# 2. Adicionar a Issue criada ao GitHub Project 5
gh project item-add 5 --owner PhilipeEfrain --url "https://github.com/PhilipeEfrain/controle-gastos-angular/issues/<ISSUE_NUMBER>"
```

### B. Mover Card de Status no Kanban
Para alterar a coluna de um item no Project 5:
```bash
# 1. Obter o item ID do card no project
gh project item-list 5 --owner PhilipeEfrain --format json

# 2. Alterar o status (substituir <ITEM_ID> e <OPTION_ID>)
gh project item-edit \
  --id "<ITEM_ID>" \
  --project-id "PVT_kwHOAgvK3c4Bh6Nk" \
  --field-id "PVTSSF_lAHOAgvK3c4Bh6Nkzhg0I5w" \
  --single-select-option-id "<OPTION_ID>"
```
*Tabela rápida de `OPTION_ID`:*
- Para **Backlog**: `9143e0d7`
- Para **Ready**: `f75ad846`
- Para **In Progress**: `47fc9ee4`
- Para **In review**: `5a6f59fd`
- Para **Done**: `98236657`

---

## 3. Fluxo de Branch e Desenvolvimento (DEV)

### A. Padrão de Nomenclatura de Branches
- Funcionalidades: `feat/issue-<NUMERO>-<descricao-curta>`
- Correções de Bugs: `fix/issue-<NUMERO>-<descricao-curta>`
- Tarefas Técnicas/Refatoração: `chore/issue-<NUMERO>-<descricao-curta>` ou `refactor/issue-<NUMERO>-<descricao-curta>`

### B. Criação de Branch e Commits
```bash
# Garantir branch main atualizada
git checkout main
git pull origin main

# Criar nova branch de trabalho
git checkout -b feat/issue-1-setup-angular-firebase

# Seguir o padrão Conventional Commits
git commit -m "feat(core): setup inicial angular standalone e tailwind css"
```

---

## 4. Abertura e Gestão de Pull Requests (DEV, QA, SEC, UX, PO)

### A. Abrir Pull Request (DEV)
Ao concluir o desenvolvimento e testes unitários:
```bash
git push -u origin feat/issue-1-setup-angular-firebase

gh pr create \
  --repo PhilipeEfrain/controle-gastos-angular \
  --base main \
  --head feat/issue-1-setup-angular-firebase \
  --title "feat(core): Setup inicial Angular 19+, Tailwind CSS e AngularFire" \
  --body "Closes #1

## Resumo das Alterações
- Inicialização do app standalone com Angular 19+
- Configuração do Tailwind CSS com design tokens
- Configuração modular do AngularFire
"
```

### B. Revisões e Pareceres Técnicos no PR

Cada agente deve deixar seu comentário formal no PR:
- **`sec_agent`**:
  ```bash
  gh pr comment <PR_NUMBER> --body "### 🛡️ [SEC Sign-off]
  - [x] Regras de Firestore isoladas por UID
  - [x] Sanitização de inputs validada
  - [x] npm audit verificado (0 vulnerabilidades)"
  ```
- **`ux_agent`**:
  ```bash
  gh pr comment <PR_NUMBER> --body "### 🎨 [UX Sign-off]
  - [x] Cores e tipografia em conformidade com o Design System
  - [x] Layout responsivo (Desktop e Mobile) validado
  - [x] Micro-interações e estados de loading implementados"
  ```
- **`qa_agent`**:
  ```bash
  gh pr comment <PR_NUMBER> --body "### 🧪 [QA Sign-off]
  - [x] 100% dos cenários BDD validados com sucesso
  - [x] Suíte de testes unitários passando sem falhas
  - [x] Casos de borda financeiros cobertos"
  ```

### C. Merge e Finalização do Card (PO / DEV)
Após os sign-offs aprovados:
```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```
O GitHub fechará a Issue automaticamente (via `Closes #<ID>`) e o card é movido para **`Done`**.
