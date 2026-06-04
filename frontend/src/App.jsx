import { useEffect, useState } from 'react'
import ExecutiveHeader from './components/ExecutiveHeader'
import Sidebar from './components/Sidebar'
import AccountSecurityPage from './pages/executive/AccountSecurityPage'
import AdPerformancePage from './pages/executive/AdPerformancePage'
import CashFlowPage from './pages/executive/CashFlowPage'
import ChannelCredentialPage from './pages/executive/ChannelCredentialPage'
import ChannelOperationsPage from './pages/executive/ChannelOperationsPage'
import ChannelSalesPage from './pages/executive/ChannelSalesPage'
import ConsultingRevenuePage from './pages/executive/ConsultingRevenuePage'
import CustomerDatabasePage from './pages/executive/CustomerDatabasePage'
import DebtPage from './pages/executive/DebtPage'
import EmployeeManagementPage from './pages/executive/EmployeeManagementPage'
import EmployeePerformancePage from './pages/executive/EmployeePerformancePage'
import CEOStrategicDashboard from './pages/executive/CEOStrategicDashboard'
import ExecutiveSummary from './pages/executive/ExecutiveSummary'
import ExportPipelinePage from './pages/executive/ExportPipelinePage'
import InventoryRiskPage from './pages/executive/InventoryRiskPage'
import IssueBriefingPage from './pages/executive/IssueBriefingPage'
import MarketingAgentPage from './pages/executive/MarketingAgentPage'
import MarketingProjectBoardPage from './pages/executive/MarketingProjectBoardPage'
import MarketingStatusPage from './pages/executive/MarketingStatusPage'
import OperatingExpensesPage from './pages/executive/OperatingExpensesPage'
import PartnerManagementPage from './pages/executive/PartnerManagementPage'
import PayrollPage from './pages/executive/PayrollPage'
import ProfitManagementPage from './pages/executive/ProfitManagementPage'
import ProductCostPage from './pages/executive/ProductCostPage'
import BlogAutoPublishPage from './pages/executive/BlogAutoPublishPage'
import PaymentApprovalPage from './pages/executive/PaymentApprovalPage'
import PaymentRequestPage from './pages/executive/PaymentRequestPage'
import PlatformOverviewPage from './pages/executive/PlatformOverviewPage'
import ProductForecastPage from './pages/executive/ProductForecastPage'
import ProductMovementPage from './pages/executive/ProductMovementPage'
import ProductProfitPage from './pages/executive/ProductProfitPage'
import ProductionManagementPage from './pages/executive/ProductionManagementPage'
import ReceivablesPage from './pages/executive/ReceivablesPage'
import ResourceLibraryPage from './pages/executive/ResourceLibraryPage'
import WorkInputPage from './pages/executive/WorkInputPage'
import WorkManagementPage from './pages/executive/WorkManagementPage'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import StaffDashboardPage from './pages/staff/StaffDashboardPage'
import { getAuthToken, getSession, logout } from './api/authApi'

const pages = {
  platform: PlatformOverviewPage,
  'staff-dashboard': StaffDashboardPage,
  account: AccountSecurityPage,
  'ceo-dashboard': CEOStrategicDashboard,
  summary: ExecutiveSummary,
  'cash-flow': CashFlowPage,
  'channel-credentials': ChannelCredentialPage,
  'customer-db': CustomerDatabasePage,
  'channel-operations': ChannelOperationsPage,
  'product-profit': ProductProfitPage,
  'product-forecast': ProductForecastPage,
  'channel-sales': ChannelSalesPage,
  'consulting-revenue': ConsultingRevenuePage,
  receivables: ReceivablesPage,
  'resource-library': ResourceLibraryPage,
  'operating-expenses': OperatingExpensesPage,
  debts: DebtPage,
  employees: EmployeeManagementPage,
  'employee-performance': EmployeePerformancePage,
  'payment-request': PaymentRequestPage,
  'payment-approval': PaymentApprovalPage,
  'work-input': WorkInputPage,
  'work-management': WorkManagementPage,
  inventory: InventoryRiskPage,
  'issue-briefing': IssueBriefingPage,
  'product-movement': ProductMovementPage,
  production: ProductionManagementPage,
  'export-pipeline': ExportPipelinePage,
  'marketing-status': MarketingStatusPage,
  'marketing-projects': MarketingProjectBoardPage,
  'marketing-agent': MarketingAgentPage,
  'ad-performance': AdPerformancePage,
  partners: PartnerManagementPage,
  payroll: PayrollPage,
  'profit-management': ProfitManagementPage,
  'product-cost': ProductCostPage,
  'blog-auto-publish': BlogAutoPublishPage,
  'brand-health': ChannelSalesPage,
}

const executivePages = new Set(['summary', 'employee-performance', 'cash-flow', 'receivables', 'operating-expenses', 'debts'])

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [page, setPage] = useState('platform')
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
      } catch {
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

  useEffect(() => {
    const openDatePicker = (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'date' || target.disabled || target.readOnly) {
        return
      }

      target.focus({ preventScroll: true })
      if (event.type === 'pointerdown' && typeof target.showPicker === 'function') {
        try {
          target.showPicker()
        } catch {
          // Browser security rules can block programmatic picker opening.
        }
      }
    }

    document.addEventListener('pointerenter', openDatePicker, true)
    document.addEventListener('pointerdown', openDatePicker, true)

    return () => {
      document.removeEventListener('pointerenter', openDatePicker, true)
      document.removeEventListener('pointerdown', openDatePicker, true)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setSession(null)
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Naeil Platform</p>
          <p className="mt-4 text-2xl font-black">접속 상태를 확인하는 중입니다.</p>
        </div>
      </main>
    )
  }

  if (!session?.authenticated) {
    return <LoginPage onLogin={setSession} />
  }

  const PageComponent = pages[page]
  const userRole = session.role || 'EXECUTIVE'
  const shellTone = executivePages.has(page) ? 'executive-hybrid' : 'ops-light'

  return (
    <div className={`app-light min-h-screen bg-slate-50 ${shellTone}`}>
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        activePage={page}
        onNavigate={setPage}
        username={session.username}
        displayName={session.displayName}
        department={session.department}
        role={userRole}
        onLogout={handleLogout}
        allowedMenuSections={(() => {
          try { return session.allowedMenuSections ? JSON.parse(session.allowedMenuSections) : null }
          catch { return null }
        })()}
      />
      <div className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <ExecutiveHeader username={session.displayName || session.username} />
        {page === 'settings' ? (
          <Settings isExpanded={false} />
        ) : (
          <main className="min-h-[calc(100vh-80px)] bg-slate-50 p-8">
            {PageComponent ? (
              <PageComponent
                onNavigate={setPage}
                username={session.username}
                displayName={session.displayName}
                department={session.department}
                positionName={session.positionName}
                role={userRole}
              />
            ) : (
              <PlatformOverviewPage
                onNavigate={setPage}
                username={session.username}
                displayName={session.displayName}
                department={session.department}
                positionName={session.positionName}
                role={userRole}
              />
            )}
          </main>
        )}
      </div>
    </div>
  )
}
