import type { Category, Estimate, Expense } from '../types/db'

export interface BudgetRow {
  categoryId: string
  name: string
  estimated: number
  actual: number
  remaining: number
  over: boolean
  percent: number // 0..100, capped for the slider
}

export interface Budget {
  rows: BudgetRow[]
  totalEstimated: number
  totalActual: number
  unbudgeted: number
}

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((t, r) => t + pick(r), 0)

/** Planned-vs-actual per category, plus an "Unbudgeted" bucket for spends whose
 *  category has no known estimate line. */
export function computeBudget(
  categories: Category[],
  estimates: Estimate[],
  expenses: Pick<Expense, 'category_id' | 'amount'>[],
): Budget {
  const estByCat = new Map(estimates.map((e) => [e.category_id, e.estimated_amount]))
  const actualByCat = new Map<string, number>()
  for (const e of expenses) actualByCat.set(e.category_id, (actualByCat.get(e.category_id) ?? 0) + e.amount)

  const known = new Set(categories.map((c) => c.id))
  const rows: BudgetRow[] = [...categories]
    .sort((a, b) => a.display_order - b.display_order)
    .map((c) => {
      const estimated = estByCat.get(c.id) ?? 0
      const actual = actualByCat.get(c.id) ?? 0
      const remaining = estimated - actual
      const percent = estimated > 0 ? Math.min(100, Math.round((actual / estimated) * 100)) : actual > 0 ? 100 : 0
      return { categoryId: c.id, name: c.name, estimated, actual, remaining, over: actual > estimated, percent }
    })

  const unbudgeted = sum(expenses.filter((e) => !known.has(e.category_id)), (e) => e.amount)

  return {
    rows,
    totalEstimated: sum(rows, (r) => r.estimated),
    totalActual: sum(rows, (r) => r.actual) + unbudgeted,
    unbudgeted,
  }
}

export interface Shortfall {
  toRaise: number // estimated − collected (how much more chanda is needed)
  leftToSpend: number // estimated − spent
  collectedPercent: number // collected / estimated, 0..100 capped
}

export function computeShortfall(totalEstimated: number, collected: number, spent: number): Shortfall {
  return {
    toRaise: totalEstimated - collected,
    leftToSpend: totalEstimated - spent,
    collectedPercent: totalEstimated > 0 ? Math.min(100, Math.round((collected / totalEstimated) * 100)) : 0,
  }
}
