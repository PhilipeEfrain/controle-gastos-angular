---
name: User Story (Funcionalidade / Regra de Negócio)
about: Proposta de nova funcionalidade ou regra financeira para o time de agentes
title: 'CARD-XXX: '
labels: 'feature'
assignees: ''
---

## 📌 Contexto & Valor de Negócio (PM)
<!-- Descrição do problema que estamos resolvendo e qual valor é entregue ao usuário final -->

## 📐 Especificação Técnica & Critérios de Aceite BDD (PO)
<!-- Cenários em formato Gherkin (Dado / Quando / Então) e regras financeiras detalhadas -->

```gherkin
Cenário: [Nome do Cenário]
  Dado [Contexto inicial]
  Quando [Ação do usuário ou sistema]
  Então [Resultado esperado]
```

## 🛡️ Checklist de Segurança (SEC)
- [ ] Isolamento de leitura e escrita por `request.auth.uid == userId`
- [ ] Sanitização e tipagem rigorosa de dados de entrada
- [ ] Validação de integridade monetária (evitar valores negativos espúrios ou NaN)

## 🎨 Especificação de Design & UX (UX)
- [ ] Cores e tipografia em conformidade com o Design System (Emerald, Carmine, Indigo, Slate)
- [ ] Comportamento responsivo definido (Desktop em colunas / Mobile empilhado)
- [ ] Estados de loading, hover, erro e micro-interações documentados
