import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Shell } from './components/layout'
import { CallbackPage, LoginPage, RegisterPage } from './pages/AuthPages'
import { CreateJobPage } from './pages/CreateJobPage'
import { DashboardPage } from './pages/DashboardPage'
import { JobDetailsPage } from './pages/JobDetailsPage'
import { JobsPage } from './pages/JobsPage'
import { SettingsPage } from './pages/SettingsPage'
import './App.css'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth/callback" element={<CallbackPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
        <Route path="/jobs" element={<ProtectedPage><JobsPage /></ProtectedPage>} />
        <Route path="/jobs/new" element={<ProtectedPage><CreateJobPage /></ProtectedPage>} />
        <Route path="/jobs/:id" element={<ProtectedPage><JobDetailsPage /></ProtectedPage>} />
        <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
