import type { Firestore } from 'firebase-admin/firestore';

export interface CleanupCycleResult {
  cyclesDeleted: number;
  expensesDeleted: number;
}

export interface GlobalCleanupResult {
  success: boolean;
  totalCyclesDeleted: number;
  totalExpensesDeleted: number;
  usersProcessed: number;
}

/**
 * Calcula o offset em meses entre um mês alvo (YYYY-MM) e um mês de referência (YYYY-MM)
 * Ex: target '2026-06', base '2026-09' -> -3
 */
export function calculateMonthOffset(targetYearMonth: string, baseYearMonth: string): number {
  if (!targetYearMonth || !baseYearMonth) return 0;
  const [targetY, targetM] = targetYearMonth.split('-').map(Number);
  const [baseY, baseM] = baseYearMonth.split('-').map(Number);
  if (isNaN(targetY) || isNaN(targetM) || isNaN(baseY) || isNaN(baseM)) return 0;
  return (targetY - baseY) * 12 + (targetM - baseM);
}

/**
 * Retorna o limite de retenção (em meses no passado) antes de ser expurgado:
 * - Free: 3 meses ativos + 1 carência. Expirado se offset < -3.
 * - Pro/Duo: 12 meses ativos + 1 carência. Expirado se offset < -12.
 */
export function getRetentionLimitMonths(plan: string | undefined): number {
  const normalized = (plan || 'free').toLowerCase();
  if (normalized === 'pro' || normalized === 'duo') {
    return 12;
  }
  return 3;
}

/**
 * Verifica se um ciclo mensal específico já expirou e deve ser expurgado
 */
export function isCycleExpiredForPlan(
  cycleYearMonth: string,
  baseYearMonth: string,
  plan: string | undefined
): boolean {
  const offset = calculateMonthOffset(cycleYearMonth, baseYearMonth);
  const limit = getRetentionLimitMonths(plan);
  return offset < -limit;
}

/**
 * Exclui ciclos mensais e suas subcoleções de despesas expiradas para um usuário
 */
export async function cleanupUserExpiredCycles(
  db: Firestore,
  userId: string,
  plan: string | undefined,
  referenceDate: Date = new Date()
): Promise<CleanupCycleResult> {
  const refYear = referenceDate.getFullYear();
  const refMonth = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const baseYearMonth = `${refYear}-${refMonth}`;

  let cyclesDeleted = 0;
  let expensesDeleted = 0;

  const cyclesColRef = db.collection(`users/${userId}/ciclos_mensais`);
  const cyclesSnap = await cyclesColRef.get();

  for (const cycleDoc of cyclesSnap.docs) {
    const cycleYearMonth = cycleDoc.id;
    if (!isCycleExpiredForPlan(cycleYearMonth, baseYearMonth, plan)) {
      continue;
    }

    // O ciclo expirou. Exclui a subcoleção de despesas e o ciclo em lote atômico
    const expensesColRef = db.collection(`users/${userId}/ciclos_mensais/${cycleYearMonth}/despesas`);
    const expensesSnap = await expensesColRef.get();

    // Firestore batch suporta até 500 operações por commit
    const batch = db.batch();
    for (const expDoc of expensesSnap.docs) {
      batch.delete(expDoc.ref);
      expensesDeleted++;
    }
    batch.delete(cycleDoc.ref);
    cyclesDeleted++;

    await batch.commit();
  }

  return { cyclesDeleted, expensesDeleted };
}

/**
 * Rotina global de limpeza de todos os usuários (agendada via Cloud Scheduler)
 */
export async function cleanupAllExpiredCycles(
  db: Firestore,
  referenceDate: Date = new Date()
): Promise<GlobalCleanupResult> {
  let totalCyclesDeleted = 0;
  let totalExpensesDeleted = 0;
  let usersProcessed = 0;

  try {
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      usersProcessed++;
      const userData = userDoc.data();
      const plan = userData?.plan || 'free';

      const result = await cleanupUserExpiredCycles(db, userDoc.id, plan, referenceDate);
      totalCyclesDeleted += result.cyclesDeleted;
      totalExpensesDeleted += result.expensesDeleted;
    }

    return {
      success: true,
      totalCyclesDeleted,
      totalExpensesDeleted,
      usersProcessed
    };
  } catch (err: any) {
    console.error('Erro crítico na execução de cleanupAllExpiredCycles:', err);
    return {
      success: false,
      totalCyclesDeleted,
      totalExpensesDeleted,
      usersProcessed
    };
  }
}
