import { useState } from 'react'
import { formatINR } from '../../lib/format'

const OPERATORS = ['+', '-', '×', '÷']

// Tiny left-to-right evaluator for cash-counting expressions like "500+500+200+100".
// Handles × and ÷ before + and -, then rounds to the nearest whole rupee (no paise).
function evaluateExpr(expr: string): number {
  const tokens = expr.match(/\d+|[+\-×÷]/g)
  if (!tokens || tokens.length === 0) return 0
  if (OPERATORS.includes(tokens[tokens.length - 1])) tokens.pop()
  if (tokens.length === 0) return 0

  const pass1: (number | string)[] = [Number(tokens[0])]
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const num = Number(tokens[i + 1])
    const last = pass1[pass1.length - 1] as number
    if (op === '×') pass1[pass1.length - 1] = last * num
    else if (op === '÷') pass1[pass1.length - 1] = num === 0 ? last : last / num
    else pass1.push(op, num)
  }

  let result = pass1[0] as number
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i] as string
    const num = pass1[i + 1] as number
    result = op === '+' ? result + num : result - num
  }
  return Math.round(result)
}

type CalcKey = { label: string; token: string; kind: 'digit' | 'op' | 'clear' | 'equals' }

const calcKeys: CalcKey[] = [
  { label: '7', token: '7', kind: 'digit' },
  { label: '8', token: '8', kind: 'digit' },
  { label: '9', token: '9', kind: 'digit' },
  { label: '÷', token: '÷', kind: 'op' },
  { label: '4', token: '4', kind: 'digit' },
  { label: '5', token: '5', kind: 'digit' },
  { label: '6', token: '6', kind: 'digit' },
  { label: '×', token: '×', kind: 'op' },
  { label: '1', token: '1', kind: 'digit' },
  { label: '2', token: '2', kind: 'digit' },
  { label: '3', token: '3', kind: 'digit' },
  { label: '−', token: '-', kind: 'op' },
  { label: 'C', token: '', kind: 'clear' },
  { label: '0', token: '0', kind: 'digit' },
  { label: '=', token: '', kind: 'equals' },
  { label: '+', token: '+', kind: 'op' },
]

function keyClass(kind: CalcKey['kind']) {
  if (kind === 'equals') return 'bg-primary text-white font-bold'
  if (kind === 'clear') return 'bg-surface text-neg font-semibold border border-line'
  if (kind === 'op') return 'bg-surface text-primary-deep font-semibold border border-line'
  return 'bg-bg text-ink font-medium border border-line'
}

export function AmountInput({
  value,
  onChange,
  placeholder = '0',
}: {
  value: number
  onChange: (n: number) => void
  placeholder?: string
}) {
  const [calcOpen, setCalcOpen] = useState(false)
  const [expr, setExpr] = useState('')

  const append = (token: string) => {
    setExpr((prev) => {
      const isOp = OPERATORS.includes(token)
      if (!isOp) return prev + token
      if (prev === '') return prev
      if (OPERATORS.includes(prev.slice(-1))) return prev.slice(0, -1) + token
      return prev + token
    })
  }

  const equals = () => {
    if (!expr) return
    const result = evaluateExpr(expr)
    onChange(result)
    setExpr(String(result))
  }

  const onKeyPress = (key: CalcKey) => {
    if (key.kind === 'clear') {
      setExpr('')
      return
    }
    if (key.kind === 'equals') {
      equals()
      return
    }
    append(key.token)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-line bg-bg rounded-xl px-3.5 py-3 focus-within:border-primary">
        <span className="text-ink-soft font-semibold">₹</span>
        <input
          type="text"
          inputMode="numeric"
          value={value === 0 ? '' : String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            onChange(digits ? Number(digits) : 0)
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-ink text-base"
        />
        <button
          type="button"
          aria-label="Open calculator"
          onClick={() => {
            setExpr('')
            setCalcOpen((v) => !v)
          }}
          className="p-1 -mr-1 text-ink-soft"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01" />
          </svg>
        </button>
      </div>

      {value > 0 && <p className="text-xs text-ink-soft mt-1">{formatINR(value)}</p>}

      {calcOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setCalcOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-surface border border-line rounded-xl shadow-md p-3">
            <div className="bg-surface-2 rounded-lg px-3 py-2 mb-2 text-right overflow-x-auto">
              <span className="font-mono text-base text-ink whitespace-nowrap">{expr || '0'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {calcKeys.map((key) => (
                <button
                  key={key.label}
                  type="button"
                  onClick={() => onKeyPress(key)}
                  className={`rounded-lg py-2.5 text-sm ${keyClass(key.kind)}`}
                >
                  {key.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
