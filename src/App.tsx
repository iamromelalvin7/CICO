import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { AddTransactionPage } from './features/add-transaction/AddTransactionPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { useHashRoute } from './hooks/useHashRoute'

function App() {
  const route = useHashRoute()
  return (
    <ToastProvider>
      <AppShell route={route}>
        {route === 'add' ? <AddTransactionPage /> : <DashboardPage />}
      </AppShell>
    </ToastProvider>
  )
}

export default App
