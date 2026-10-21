import { ToastProvider } from './components/Toast'
import { AddTransactionPage } from './features/add-transaction/AddTransactionPage'

// Only Add transaction exists so far; navigation arrives with the next screens.
function App() {
  return (
    <ToastProvider>
      <main className="min-h-dvh">
        <AddTransactionPage />
      </main>
    </ToastProvider>
  )
}

export default App
