import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { AppRouter } from '@/router/AppRouter'

function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  )
}

export default App

