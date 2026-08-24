import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './features/home/HomePage'
import { CollectPage } from './features/collect/CollectPage'
import { SpendPage } from './features/spend/SpendPage'
import { BudgetPage } from './features/budget/BudgetPage'
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
          { path: '/collect', element: <CollectPage /> },
          { path: '/spend', element: <SpendPage /> },
          { path: '/budget', element: <BudgetPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
