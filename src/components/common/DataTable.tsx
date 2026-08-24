import type { ReactNode } from 'react'

export function DataTable({
  columns,
  rows,
  totalRow,
}: {
  columns: { key: string; label: string; align?: 'right' }[]
  rows: Record<string, ReactNode>[]
  totalRow?: ReactNode[]
}) {
  return (
    <div className="overflow-x-auto border border-line rounded-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface-2 text-ink-soft text-xs">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 font-semibold tracking-wide whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? 'bg-surface-2/40' : ''}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 border-t border-line text-ink whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totalRow && (
          <tfoot>
            <tr className="font-bold bg-surface-2">
              {totalRow.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-2.5 border-t border-line text-ink whitespace-nowrap ${
                    columns[i]?.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
