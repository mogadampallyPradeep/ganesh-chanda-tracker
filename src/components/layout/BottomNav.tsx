import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <path d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1v-9" />
    ),
  },
  {
    to: '/collect',
    label: 'Collect',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.5 9.5c0-1.1 1-2 2.5-2s2.5.7 2.5 1.8-1 1.5-2.5 2-2.5.9-2.5 2 1 1.7 2.5 1.7 2.5-.9 2.5-2" />
      </>
    ),
  },
  {
    to: '/spend',
    label: 'Spend',
    icon: (
      <>
        <rect x="3" y="6.5" width="18" height="13" rx="2" />
        <path d="M3 10h18M16 14.5h2.5" />
      </>
    ),
  },
  {
    to: '/budget',
    label: 'Budget',
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
      </>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className="shrink-0 bg-surface border-t border-line flex">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs ${
              isActive ? 'text-primary-deep font-semibold' : 'text-ink-soft'
            }`
          }
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {icon}
          </svg>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
