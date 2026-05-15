import { useEffect, useState } from 'react'
import ExecutiveHeader from './components/ExecutiveHeader'
import Sidebar from './components/Sidebar'
import AdPerformancePage from './pages/executive/AdPerformancePage'
import CashFlowPage from './pages/executive/CashFlowPage'
import ChannelSalesPage from './pages/executive/ChannelSalesPage'
import ConsultingRevenuePage from './pages/executive/ConsultingRevenuePage'
import DebtPage from './pages/executive/DebtPage'
import ExecutiveSummary from './pages/executive/ExecutiveSummary'
import ExportPipelinePage from './pages/executive/ExportPipelinePage'
import InventoryRiskPage from './pages/executive/InventoryRiskPage'
import MarketingStatusPage from './pages/executive/MarketingStatusPage'
import OperatingExpensesPage from './pages/executive/OperatingExpensesPage'
import PartnerManagementPage from './pages/executive/PartnerManagementPage'
import ProductForecastPage from './pages/executive/ProductForecastPage'
import ProductProfitPage from './pages/executive/ProductProfitPage'
import ReceivablesPage from './pages/executive/ReceivablesPage'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import { getAuthToken, getSession, logout } from './api/authApi'

const pages = {
  summary: ExecutiveSummary,
  'cash-flow': CashFlowPage,
  'product-profit': ProductProfitPage,
  'product-forecast': ProductForecastPage,
  'channel-sales': ChannelSalesPage,
  'consulting-revenue': ConsultingRevenuePage,
  receivables: ReceivablesPage,
  'operating-expenses': OperatingExpensesPage,
  debts: DebtPage,
  inventory: InventoryRiskPage,
  'export-pipeline': ExportPipelinePage,
  'marketing-status': MarketingStatusPage,
  'ad-performance': AdPerformancePage,
  partners: PartnerManagementPage,
}

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [page, setPage] = useState('summary')
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
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Naeil Executive</p>
          <p className="mt-4 text-2xl font-black">접속 상태를 확인하는 중입니다.</p>
        </div>
      </main>
    )
  }

  if (!session?.authenticated) {
    return <LoginPage onLogin={setSession} />
  }

  const PageComponent = pages[page]

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        activePage={page}
        onNavigate={setPage}
        username={session.username}
        onLogout={handleLogout}
      />
      <div className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <ExecutiveHeader username={session.username} />
        {page === 'settings' ? (
          <Settings isExpanded={false} />
        ) : (
          <main className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),#020617] p-8">
            {PageComponent ? <PageComponent onNavigate={setPage} /> : <ExecutiveSummary onNavigate={setPage} />}
          </main>
        )}
      </div>
    </div>
  )
}
