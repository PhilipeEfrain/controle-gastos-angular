---
name: ux-writing-copywriting
description: Guia de tom de voz, clareza financeira, microcopy, mensagens de erro humanizadas, CTAs de alta conversao e copywriting SaaS para o Quinzena.
---

# Skill: UX Writing & Copywriting de Conversão (Finanças SaaS)

Esta skill documenta os princípios, diretrizes de redação, vocabulário e padrões de microcopy para o aplicativo **Controle de Gastos Quinzena**, garantindo que a comunicação seja simples, empática, persuasiva e alinhada à psicologia financeira dos usuários.

---

## 1. Princípios de Redação do Quinzena (UX Writing)

### A. Clareza Acima da Sofisticação
- Evite jargões bancários ou contábeis ("demonstrativo de resultados", "conciliação", "provisão passiva").
- Prefira termos do dia a dia: "quanto sobra", "quanto sai", "guardar para tributos", "dividir no casal".
- **Regra dos 3 Segundos**: Se o usuário precisar reler o texto para entender o que fazer, o copy precisa ser simplificado.

### B. Empatia Financeira (Sem Culpa)
- Lidar com dinheiro gera ansiedade e estresse. Nunca utilize mensagens de alerta que façam o usuário se sentir punido ou irresponsável.
- **Antes (Agressivo)**: *"Você estourou seu orçamento da quinzena!"*
- **Depois (Construtivo)**: *"Atenção: seus gastos superaram a renda desta quinzena. A sobra da 1ª quinzena pode cobrir a diferença."*

### C. Transparência Absoluta
- Nos planos PRO e DUO, deixe explícito: *"Sem fidelidade. Cancele quando quiser em 1 clique nas configurações."*
- Prazos e cobranças no cartão ou PIX sempre com valores finais, sem taxas ocultas.

---

## 2. Dicionário de Termos do Quinzena

| ❌ Evitar (Complexo / Frio) | ✅ Preferir no Quinzena (Humano / Intuitivo) |
| :--- | :--- |
| Exercício Fiscal | Contas do Ano / Tributos Anuais |
| Déficit Orçamentário | Saldo Negativo / Despesas acima da renda |
| Superávit Consolidado | Saldo Livre / Sobra do mês |
| Despesas Recorrentes Contínuas | Contas Fixas Mensais |
| Rateio Proporcional Interpessoal | Divisão 50/50 / Dividir com parceiro |
| Liquidação de passivo parcelado | Quitar ou antecipar parcelas |
| Cadastrar novo lançamento a débito | + Nova Despesa |
| Upgrade compulsório | Desbloquear Poder Total com o PRO |
| Inadimplência / Cancelamento por falta de pagamento | Precisamos de um novo meio de pagamento |

---

## 3. Padrões de Microcopy por Componente

### A. Botões de Chamada para Ação (CTAs)
- O texto do botão deve sempre completar a frase mental do usuário: *"Eu quero..."*
  - *"Começar Gratuitamente"* (e não apenas *"Enviar"*)
  - *"Confirmar Despesa"* (e não *"OK"*)
  - *"Ver Meus Planos"* (e não *"Clique aqui"*)
  - *"Copiar Código Pix"* (com feedback imediato: *"✓ Código Copiado!"*)

### B. Mensagens de Erro Humanizadas (Error Handling)
Toda mensagem de erro deve conter 3 partes:
1. **O que aconteceu** (de forma simples).
2. **Por que aconteceu** (sem códigos de erro internos).
3. **Como resolver** (instrução clara).

```typescript
// Exemplo em modais de formulário:
// ❌ "Erro 422: campo valor inválido"
// ✅ "Informe um valor maior que zero para registrar a despesa."

// ❌ "Erro no Asaas: card rejected"
// ✅ "O cartão não foi autorizado pelo banco emissor. Verifique os dados ou tente pagar via Pix instantâneo."
```

### C. Onboarding e Gamificação de Primeiro Acesso
- Use frases de incentivo progressivo:
  - 0%: *"Vamos configurar seu orçamento em 3 passos rápidos."*
  - 66%: *"Quase lá! Falta apenas 1 passo para o controle total."*
  - 100%: *"🎉 Parabéns! Seu orçamento quinzenal está pronto para o mês."*

### D. Modal de Limite do Plano Free (Limit Reached)
- Nunca apresente o limite como uma punição. Apresente como um marco de crescimento financeiro do usuário:
  - **Título**: *"Você está organizando muitas contas! Que tal desbloquear cadastros ilimitados?"*
  - **Corpo**: *"No plano Gratuito você atingiu o limite de 3 contas fixas. Faça o upgrade para o PRO por apenas R$ 9,90/mês e tenha liberdade total para todas as suas despesas."*
  - **CTA**: *"Quero o Plano PRO"*

---

## 4. Copywriting para a Landing Page (Search Intent & Conversão)

1. **Título Principal (Hero)**:
   - *"Saiba quanto entra, quanto sai e quanto sobra."*
   - Comunica o benefício central em 9 palavras.
2. **Subtítulo de Apoio**:
   - Resolve a dor das datas de pagamento: *"O único controle desenhado para o ritmo real das suas quinzenas. Organize pagamentos do Dia 31 e Dia 15, planeje parcelamentos e divida viagens sem estresse."*
3. **Seção de Preços**:
   - Gratuito: *"Para dar os primeiros passos sem custo."*
   - PRO (Destaque): *"Poder total e tranquilidade financeira sem limites."*
   - DUO: *"Finanças a dois com total transparência e sincronização em tempo real."*
4. **Respostas do FAQ**:
   - Devem combater objeções: segurança de dados, funcionamento offline no celular, facilidade de cancelamento e suporte a regimes salariais flexíveis (5º dia útil CLT).
