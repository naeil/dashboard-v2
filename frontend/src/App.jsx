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
import CustomerIntelligencePage from './pages/executive/CustomerIntelligencePage'
import SettlementSchedulePage from './pages/executive/SettlementSchedulePage'
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
import MenuOrderSettingsPage from './pages/executive/MenuOrderSettingsPage'
import OperatingExpensesPage from './pages/executive/OperatingExpensesPage'
import OrganizationManagementPage from './pages/executive/OrganizationManagementPage'
import PartnerManagementPage from './pages/executive/PartnerManagementPage'
import PartnerPaymentLedgerPage from './pages/executive/PartnerPaymentLedgerPage'
import PayrollPage from './pages/executive/PayrollPage'
import QuotationPage from './pages/executive/QuotationPage'
import PlatformAdminPage from './pages/executive/PlatformAdminPage'
import ProfitManagementPage from './pages/executive/ProfitManagementPage'
import ProductCostPage from './pages/executive/ProductCostPage'
import PromotionHistoryPage from './pages/executive/PromotionHistoryPage'
import PromotionMarginPage from './pages/executive/PromotionMarginPage'
import SupportProgramPage from './pages/executive/SupportProgramPage'
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
import { LOGIN_MODES } from './utils/loginModes'

const pages = {
  platform: PlatformOverviewPage,
  'platform-admin': PlatformAdminPage,
  organization: OrganizationManagementPage,
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
  'customer-intelligence': CustomerIntelligencePage,
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
  'menu-order-settings': MenuOrderSettingsPage,
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
  'promotion-margin': PromotionMarginPage,
  'promotion-history': PromotionHistoryPage,
  'marketing-agent': MarketingAgentPage,
  'ad-performance': AdPerformancePage,
  partners: PartnerManagementPage,
  'partner-payment': PartnerPaymentLedgerPage,
  'settlement-schedule': SettlementSchedulePage,
  payroll: PayrollPage,
  'quotation': QuotationPage,
  'profit-management': ProfitManagementPage,
  'product-cost': ProductCostPage,
  'blog-auto-publish': BlogAutoPublishPage,
  'support-programs': SupportProgramPage,
  'brand-health': BrandHealthPage,
  settings: Settings,
}

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
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return isMobile
}

function MobileLayout({ activePage, setPage, session, userRole }) {
  const PageComponent = pages[activePage] || PlatformOverviewPage
  return (
    <div className="app-light flex h-screen flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 overflow-y-auto pb-16">
        <PageComponent
          onNavigate={setPage}
          username={session?.username}
          displayName={session?.displayName}
          department={session?.department}
          positionName={session?.positionName}
          role={userRole}
          accessPermissions={session?.allowedMenuSections}
        />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2">
        <div className="grid h-16 grid-cols-5">
          {mobileTabs.map((tab) => {
            const active = activePage === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPage(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium transition-colors ${active ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
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
    getSession()
      .then((data) => {
        if (data?.authenticated) {
          setSession(data)
        } else {
          setSession(null)
        }
      })
      .catch(() => setSession(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (!token && !authLoading) setSession(null)
  }, [authLoading])

  useEffect(() => {
    const openDatePicker = (event) => {
      const input = event.target?.closest?.('[data-date-trigger]')?.querySelector?.('input[type="date"]')
      if (input) {
        try { input.showPicker?.() } catch {}
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
    setPage('platform')
  }

  const handleLogin = (nextSession) => {
    setSession(nextSession)
    setPage(nextSession?.loginSurface === LOGIN_MODES.PLATFORM ? 'platform-admin' : 'platform')
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

  if (!session) return <LoginPage onLogin={handleLogin} />

  const userRole = session.role ?? 'EMPLOYEE'
  if (isMobile && mobilePageIds.has(page)) {
    return <MobileLayout activePage={page} setPage={setPage} session={session} userRole={userRole} />
  }

  const PageComponent = pages[page] || PlatformOverviewPage
  return (
    <div className="app-light flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded((value) => !value)}
        username={session.username}
        displayName={session.displayName}
        department={session.department}
        role={userRole}
        onLogout={handleLogout}
        allowedMenuSections={session.allowedMenuSections}
      />
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <ExecutiveHeader
          username={session.username}
          displayName={session.displayName}
          session={session}
          onLogout={handleLogout}
          onNavigate={setPage}
          userRole={userRole}
        />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <PageComponent
            onNavigate={setPage}
            username={session.username}
            displayName={session.displayName}
            department={session.department}
            positionName={session.positionName}
            role={userRole}
            accessPermissions={session.allowedMenuSections}
          />
        </main>
      </div>
    </div>
  )
}
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
import CustomerIntelligencePage from './pages/executive/CustomerIntelligencePage'
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
import MenuOrderSettingsPage from './pages/executive/MenuOrderSettingsPage'
import OperatingExpensesPage from './pages/executive/OperatingExpensesPage'
import OrganizationManagementPage from './pages/executive/OrganizationManagementPage'
import PartnerManagementPage from './pages/executive/PartnerManagementPage'
import PartnerPaymentLedgerPage from './pages/executive/PartnerPaymentLedgerPage'
import PayrollPage from './pages/executive/PayrollPage'
import QuotationPage from './pages/executive/QuotationPage'
import PlatformAdminPage from './pages/executive/PlatformAdminPage'
import ProfitManagementPage from './pages/executive/ProfitManagementPage'
import ProductCostPage from './pages/executive/ProductCostPage'
import PromotionHistoryPage from './pages/executive/PromotionHistoryPage'
import PromotionMarginPage from './pages/executive/PromotionMarginPage'
import SupportProgramPage from './pages/executive/SupportProgramPage'
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
import { LOGIN_MODES } from './utils/loginModes'

const pages = {
  platform: PlatformOverviewPage,
  'platform-admin': PlatformAdminPage,
  organization: OrganizationManagementPage,
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
  'customer-intelligence': CustomerIntelligencePage,
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
  'menu-order-settings': MenuOrderSettingsPage,
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
  'promotion-margin': PromotionMarginPage,
  'promotion-history': PromotionHistoryPage,
  'marketing-agent': MarketingAgentPage,
  'ad-performance': AdPerformancePage,
  partners: PartnerManagementPage,
  'partner-payment': PartnerPaymentLedgerPage,
  payroll: PayrollPage,
  'quotation': QuotationPage,
  'profit-management': ProfitManagementPage,
  'product-cost': ProductCostPage,
  'blog-auto-publish': BlogAutoPublishPage,
  'support-programs': SupportProgramPage,
  'brand-health': BrandHealthPage,
  settings: Settings,
}

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
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return isMobile
}

function MobileLayout({ activePage, setPage, session, userRole }) {
  const PageComponent = pages[activePage] || PlatformOverviewPage
  return (
    <div className="app-light flex h-screen flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 overflow-y-auto pb-16">
        <PageComponent
          onNavigate={setPage}
          username={session?.username}
          displayName={session?.displayName}
          department={session?.department}
          positionName={session?.positionName}
          role={userRole}
          accessPermissions={session?.allowedMenuSections}
        />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2">
        <div className="grid h-16 grid-cols-5">
          {mobileTabs.map((tab) => {
            const active = activePage === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPage(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium transition-colors ${active ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
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
    getSession()
      .then((data) => {
        if (data?.authenticated) {
          setSession(data)
        } else {
          setSession(null)
        }
      })
      .catch(() => setSession(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (!token && !authLoading) setSession(null)
  }, [authLoading])

  useEffect(() => {
    const openDatePicker = (event) => {
      const input = event.target?.closest?.('[data-date-trigger]')?.querySelector?.('input[type="date"]')
      if (input) {
        try { input.showPicker?.() } catch {}
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
    setPage('platform')
  }

  const handleLogin = (nextSession) => {
    setSession(nextSession)
    setPage(nextSession?.loginSurface === LOGIN_MODES.PLATFORM ? 'platform-admin' : 'platform')
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

  if (!session) return <LoginPage onLogin={handleLogin} />

  const userRole = session.role ?? 'EMPLOYEE'
  if (isMobile && mobilePageIds.has(page)) {
    return <MobileLayout activePage={page} setPage={setPage} session={session} userRole={userRole} />
  }

  const PageComponent = pages[page] || PlatformOverviewPage
  return (
    <div className="app-light flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded((value) => !value)}
        username={session.username}
        displayName={session.displayName}
        department={session.department}
        role={userRole}
        onLogout={handleLogout}
        allowedMenuSections={session.allowedMenuSections}
      />
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <ExecutiveHeader
          username={session.username}
          displayName={session.displayName}
          session={session}
          onLogout={handleLogout}
          onNavigate={setPage}
          userRole={userRole}
        />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <PageComponent
            onNavigate={setPage}
            username={session.username}
            displayName={session.displayName}
            department={session.department}
            positionName={session.positionName}
            role={userRole}
            accessPermissions={session.allowedMenuSections}
          />
        </main>
      </div>
    </div>
  )
}
