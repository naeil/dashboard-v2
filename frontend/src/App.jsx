import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import SalesStatus from './pages/SalesStatus'
import Settings from './pages/Settings'
import ProductInventory from './pages/ProductInventory'
import ProductCosts from './pages/ProductCosts'
import LoginPage from './pages/LoginPage'
import { getAuthToken, getSession, logout } from './api/authApi'

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [page, setPage] = useState('sales')
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const checkSession = async () => {
      const token = getAuthToken()
      if (!token) {
        setSession(null)
        setAuthLoading(false)
        return
      }

      try {
        const response = await getSession()
        setSession(response.authenticated ? response : null)
      } catch (error) {
        setSession(null)
      } finally {
        setAuthLoading(false)
      }
    }

    const handleUnauthorized = () => {
      setSession(null)
      setAuthLoading(false)
    }

    checkSession()
    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setSession(null)
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Naeil Dashboard</p>
          <p className="mt-4 text-2xl font-black">접속 상태를 확인하는 중입니다.</p>
        </div>
      </main>
    )
  }

  if (!session?.authenticated) {
    return <LoginPage onLogin={setSession} />
  }

  return (
    <>
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        activePage={page}
        onNavigate={setPage}
        username={session.username}
        onLogout={handleLogout}
      />
      {page === 'dashboard' && <Dashboard isExpanded={isSidebarExpanded} />}
      {page === 'sales' && <SalesStatus isExpanded={isSidebarExpanded} />}
      {page === 'products-inventory' && <ProductInventory isExpanded={isSidebarExpanded} />}
      {page === 'products-costs' && <ProductCosts isExpanded={isSidebarExpanded} />}
      {page === 'settings' && <Settings isExpanded={isSidebarExpanded} />}
    </>
  )
}
