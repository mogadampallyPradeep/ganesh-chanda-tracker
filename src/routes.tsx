import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './features/home/HomePage'
import { DonationsListPage } from './features/donations/DonationsListPage'
import { DonationEditPage } from './features/donations/DonationEditPage'
import { ReceiptPage } from './features/donations/ReceiptPage'
import { ExpensesListPage } from './features/expenses/ExpensesListPage'
import { ExpenseEditPage } from './features/expenses/ExpenseEditPage'
import { BudgetPage } from './features/budget/BudgetPage'
import { ActivityPage } from './features/activity/ActivityPage'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { CommitteePage } from './features/committee/CommitteePage'
import { FundSettingsPage } from './features/settings/FundSettingsPage'
import { PublicStatementPage } from './features/public/PublicStatementPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/s/:token', element: <PublicStatementPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/collect', element: <DonationsListPage /> },
          { path: '/collect/:id', element: <DonationEditPage /> },
          { path: '/collect/:id/receipt', element: <ReceiptPage /> },
          { path: '/spend', element: <ExpensesListPage /> },
          { path: '/spend/:id', element: <ExpenseEditPage /> },
          { path: '/budget', element: <BudgetPage /> },
          { path: '/activity', element: <ActivityPage /> },
          { path: '/categories', element: <CategoriesPage /> },
          { path: '/committee', element: <CommitteePage /> },
          { path: '/settings', element: <FundSettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
