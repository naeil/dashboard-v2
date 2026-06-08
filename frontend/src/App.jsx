import { useEffect, useState } from 'react'
import ExecutiveHeader from './components/ExecutiveHeader'
import Sidebar from './components/Sidebar'
import AccountSecurityPage from './pages/executive/AccountSecurityPage'
import AdPerformancePage from './pages/executive/AdPerformancePage'
import AttendanceAdminPage from './pages/executive/AttendanceAdminPage'
import BrandHealthPage from './pages/executive/BrandHealthPage'
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
import StaffProjectStatusPage from './pages/staff/StaffProjectStatusPage'
import StaffWorkReportPage from './pages/staff/StaffWorkReportPage'
import { getAuthToken, getSession, logout } from './api/authApi'

const pages = {
  platform: PlatformOverviewPage,
  'staff-dashboard': StaffDashboardPage,
  'staff-work-report': StaffWorkReportPage,
  'staff-project-status': StaffProjectStatusPage,
  account: AccountSecurityPage,
  'attendance-admin': AttendanceAdminPage,
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
  'brand-health': BrandHealthPage,
}

const executivePages = new Set(['summary', 'employee-performance', 'cash-flow', 'receivables', 'operating-expenses', 'debts'])
const mobilePageIds = new Set(['platform', 'staff-dashboard', 'staff-work-report', 'staff-project-status', 'account'])
const mobileTabs = [
  { id: 'platform', label: '홈', icon: 'apps' },
  { id: 'staff-dashboard', label: '대시보드', icon: 'dashboard' },
  { id: 'staff-work-report', label: '업무보고', icon: 'assignment_add' },
  { id: 'staff-project-status', label: '프로젝트', icon: 'view_timeline' },
  { id: 'account', label: '계정', icon: 'account_circle' },
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return isMobile
}

function MobileShell({ page, setPage, pages, session, userRole, onLogout }) {
  const activePage = mobilePageIds.has(page) ? page : 'platform'
  const PageComponent = pages[activePage] || PlatformOverviewPage

  const pageProps = {
    onNavigate: (nextPage) => setPage(mobilePageIds.has(nextPage) ? nextPage : 'platform'),
    username: session.username,
    displayName: session.displayName,
    department: session.department,
    positionName: session.positionName,
    role: userRole,
    mobile: true,
  }

  return (
    <div className="app-light min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">Naeil Group</p>
            <h1 className="mt-0.5 truncate text-base font-black text-slate-950">Mobile Dashboard</h1>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
              {session.displayName || session.username} · {session.department || userRole}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="min-h-[calc(100vh-64px)] px-3 pb-24 pt-3">
        <div className="mobile-page-scope">
          <PageComponent {...pageProps} />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="grid h-16 grid-cols-5">
          {mobileTabs.map((tab) => {
            const active = activePage === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPage(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-black transition-colors ${active ? 'text-sky-700' : 'text-slate-400'}`}
              >
                <span className={`material-symbols-outlined text-[22px] ${active ? 'filled' : ''}`}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [page, setPage] = useState('platform')
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const isMobile = useIsMobile()

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

  if (isMobile) {
    return (
      <MobileShell
        page={page}
        setPage={setPage}
        pages={pages}
        session={session}
        userRole={userRole}
        onLogout={handleLogout}
      />
    )
  }

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
