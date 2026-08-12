import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { AppRouter } from '@/router/AppRouter'

function App() {
  return (
    <AuthProvider>
      {/* Global toast notification container */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />
      <AppRouter />
    </AuthProvider>
  )
}

export default App

