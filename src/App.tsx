import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { AddTransactionPage } from './features/add-transaction/AddTransactionPage'
import { ChatPage } from './features/chat/ChatPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { useHashRoute } from './hooks/useHashRoute'
import { LockGate } from './lock/LockGate'

function App() {
  const route = useHashRoute()
  return (
    <LockGate>
      <ToastProvider>
        <AppShell route={route}>
          {route === 'add' ? (
            <AddTransactionPage />
          ) : route === 'transactions' ? (
            <TransactionsPage />
          ) : route === 'ask' ? (
            <ChatPage />
          ) : route === 'settings' ? (
            <SettingsPage />
          ) : (
            <DashboardPage />
          )}
        </AppShell>
      </ToastProvider>
    </LockGate>
  )
}

export default App
