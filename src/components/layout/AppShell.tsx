import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
