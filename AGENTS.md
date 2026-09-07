# Regras de Colaboração do Time de Agentes - Angular & Firebase (PM, PO, SEC, UX, DEV, QA)

Este repositório é gerenciado por uma equipe multidisciplinar de agentes atuando no desenvolvimento e evolução do **Controle de Gastos Quinzenais (Angular + Firebase Web App)** no GitHub e no Kanban do GitHub Projects.

---

## Papéis do Time

1. **PM (`pm_agent`)**: Gestão de produto, roadmap, criação de issues no GitHub e priorização no Kanban (`Backlog`).
2. **PO (`po_agent`)**: Especificação de regras de negócio financeiras, detalhamento BDD (Gherkin), critérios de aceite e aprovação para `Ready`.
3. **SEC (`sec_agent`)**: Modelagem de segurança, Firebase Security Rules (Firestore & Storage), sanitização de dados, auditoria SAST (`npm audit`) e parecer de segurança (`[SEC Sign-off]`).
4. **UX (`ux_agent`)**: Design System financeiro (Tailwind CSS, dark mode, micro-interações, responsividade mobile/desktop) e parecer de UX (`[UX Sign-off]`).
5. **DEV (`dev_agent`)**: Engenharia frontend em Angular (Standalone Components, Signals, `inject()`, AngularFire, TypeScript rigoroso), consulta obrigatória ao `ARCHITECTURE_MAP.md`, criação de branch `feat/` e abertura de Pull Requests.
6. **QA (`qa_agent`)**: Automação de testes unitários e de componentes, validação estrita dos critérios de aceite BDD e parecer final de qualidade (`[QA Sign-off]`).

---

## Fluxo Kanban & GitHub Workflow (GitHub Project 5)

As transições no GitHub Projects seguem 5 colunas estritas:

```
[1. Backlog] ──(Refinamento PO+SEC+UX)──► [2. Ready] ──(DEV inicia)──► [3. In Progress] ──(PR aberto)──► [4. In review] ──(Sign-offs)──► [5. Done]
```

1. **Backlog**:
   - O **PM** cria a Issue no GitHub com contexto de negócio, valor e escopo.
   - Adiciona a Issue ao GitHub Project 5 na coluna `Backlog`.
2. **Refinamento (Pré-Ready)**:
   - **PO** adiciona cenários BDD (`Dado`, `Quando`, `Então`) e regras de cálculo à Issue.
   - **SEC** adiciona requisitos de segurança e isolamento por usuário.
   - **UX** adiciona layout, tokens Tailwind e comportamento responsivo.
   - Com o consenso do trio (PO, SEC, UX), o **PO** move o card para **`Ready`**.
3. **Ready**:
   - Card pronto para ser puxado pelo DEV.
4. **In Progress**:
   - **DEV** puxa a tarefa do topo de `Ready`, move para **`In Progress`**, cria a branch `feat/issue-<NUMERO>-<nome>` e implementa código + testes.
5. **In review**:
   - **DEV** abre o Pull Request com `gh pr create` (vinculando `Closes #<NUMERO>`) e move o card para **`In review`**.
   - **QA** roda testes e valida BDD (`[QA Sign-off]`).
   - **UX** valida UI/UX e micro-interações (`[UX Sign-off]`).
   - **SEC** audita regras e dependências (`[SEC Sign-off]`).
6. **Done**:
   - Com todos os pareceres aprovados, o PR é mergeado com squash (`gh pr merge --squash --delete-branch`), a Issue é fechada e o card é movido para **`Done`**.

---

## Prevenção de Código Duplicado (Regra Pétrea)

O agente DEV **nunca** cria novas funções utilitárias, componentes, pipes, guards ou serviços sem antes:

1. Consultar `.agents/ARCHITECTURE_MAP.md`.
2. Fazer busca por símbolos e seletores similares no repositório.
3. Atualizar o `.agents/ARCHITECTURE_MAP.md` imediatamente após a criação de novos artefatos reutilizáveis.
