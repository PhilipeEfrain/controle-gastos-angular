# Diretivas Globais do Projeto - Quinzena (Controle de Gastos Quinzenais)
# Angular + Firebase (Firestore, Cloud Functions v2, Hosting)

## 🚨 DIRETIVA DE VIGILÂNCIA CONTÍNUA: CONTROLE ABSOLUTO DE GASTOS E CONSUMO DO FIREBASE

> [!CAUTION]
> **REGRA PÉTREA DE INFRAESTRUTURA E CUSTOS (PLANO FIREBASE BLAZE):**
> O assistente Antigravity e todos os agentes do time DEVEM priorizar, monitorar e auditar continuamente o consumo de quotas do Firebase. Nenhuma modificação, refatoração, criação de código, query ou Cloud Function pode introduzir desperdício de leituras, escritas ou execuções desnecessárias. Não podemos perder o controle de gastos em nenhum momento!

---

### 1. Comunicação Obrigatória ao Usuário sobre Impacto no Firebase
Em **TODA e QUALQUER** modificação, adição ou remoção de código que envolva:
- Queries ou snapshots do Firestore (`getDocs`, `onSnapshot`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `runTransaction`).
- Novas subcoleções ou índices.
- Disparadores, agendamentos ou endpoints do Cloud Functions v2.
- Uploads ou downloads no Firebase Storage.
- Cache de Hosting ou regras de reescrita.

O agente DEVE **informar proativamente e explicitamente ao usuário**:
1. Quantas leituras/escritas estimadas a ação realiza por usuário/mês.
2. A estratégia adotada para mitigar custos (cache em memória/Signals, `limit()`, `takeUntilDestroyed()`, etc.).
3. Se há qualquer risco de custos no plano Blaze e como ele foi neutralizado.

---

### 2. Mandamentos de Engenharia para Prevenção de Custos no Firestore

1. **PROIBIDO `getDocs()` ou leituras dentro de listeners contínuos (`onSnapshot` / streams)**:
   - Nunca execute chamadas `getDocs()` ou queries secundárias dentro do callback de um `onSnapshot` sem um controle de cache em memória estrito (`syncedMonths`, `hasLoaded`, `Map`/`Set`), pois cada alteração local de documento (ex: marcar como pago) re-dispararia leituras completas da coleção secundária.

2. **PROIBIDO consultas em loop (`for` / `Promise.all` em série)**:
   - Evite fazer varreduras em cascata (como ler 24 meses futuros de uma vez sem filtro). Quando indispensável, garanta que os resultados sejam cacheados e a subscrição encerrada ao sair da tela.

3. **OBRIGATÓRIO cancelamento de subscrições com `DestroyRef` / `takeUntilDestroyed`**:
   - Todo componente que subscreve em streams ou Observables deve usar `takeUntilDestroyed(this.destroyRef)` ou ter seu `unsubscribe()` chamado explicitamente no `onDestroy`. Subscrições órfãs continuam consumindo leituras e banda em segundo plano indefinidamente.

4. **OBRIGATÓRIO uso de `limit()` em consultas abertas**:
   - Nenhuma listagem deve consultar coleções inteiras sem `limit()`. A paginação ou janela temporal deslizante deve ser sempre aplicada.

5. **CACHE EM MEMÓRIA / SIGNALS PARA DADOS MESTRE**:
   - Coleções com baixa taxa de alteração (ex: `despesas_recorrentes`, tabelas de configuração, perfil de usuário) devem ser carregadas uma única vez por sessão ou com política de invalidação pontual, jamais recarregadas a cada clique.

6. **PROTEÇÃO DE REGRAS NO `firestore.rules` (Prevenção de Denial of Wallet)**:
   - Coleções globais ou sensíveis (como `/users` e `/system_config`) NUNCA podem ter `allow list: if isAuthenticated()`. Apenas `isAdmin()` pode executar queries de listagem agregada para impedir que scripts ou usuários façam varredura massiva de documentos cobrada na fatura.

---

### 3. Mandamentos para Cloud Functions v2
1. **Configuração de `maxInstances`**: Toda função HTTPS ou disparada por evento deve declarar `maxInstances` (ex: `maxInstances: 10`) para prevenir escalonamento descontrolado.
2. **Idempotência Obrigatória**: Webhooks e listeners que realizam escritas no Firestore devem verificar se o evento já foi processado (ex: coleção `system_events`), evitando loops infinitos e faturamentos repetidos.
3. **Autenticação Fail-Closed**: Funções que recebem dados de gateways externos (como Asaas) devem rejeitar a requisição imediatamente (HTTP 401) se o token for inválido ou o segredo estiver ausente.

---

### 4. Checklist Obrigatório em Todo Pull Request e Relatório de Entrega
Todo PR e relatório de implementação deve conter o parecer formal:
```markdown
### 💰 [Cost/Quota Sign-off]
- [x] Avaliação de impacto no Firestore (Leituras, Escritas, Deletes estimadas)
- [x] Ausência de queries sem limite ou em loops
- [x] Subscrições e streams devidamente canceladas no ciclo de vida (takeUntilDestroyed)
- [x] Estratégia de cache em memória ou memoização validada
- [x] Cloud Functions com limite de instâncias e idempotência
- [x] Zero risco de custos descontrolados no plano Blaze do Firebase
```
