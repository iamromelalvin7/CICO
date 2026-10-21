import { createContext, useContext } from 'react'

export const ToastContext = createContext<(title: string, detail?: string) => void>(() => {})

// Shows a quiet confirmation, e.g. toast('Saved on this device', 'GH₵ 45.00 · Lunch').
export function useToast() {
  return useContext(ToastContext)
}
