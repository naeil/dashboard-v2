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
import CustomerInquiryPage from './pages/executive/CustomerInquiryPage'
import CustomerIntelligencePage from './pages/executive/CustomerIntelligencePage'
import SettlementSchedulePage from './pages/executive/SettlementSchedulePage'
import IncentiveManagementPage from './pages/executive/IncentiveManagementPage'
import ChannelApiSettingsPage from './pages/executive/ChannelApiSettingsPage'
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
import AIReviewCenterPage from './pages/executive/AIReviewCenterPage'
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
    'customer-inquiry': CustomerInquiryPage,
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
    'incentive-online': IncentiveManagementPage,
    'incentive-clients': IncentiveManagementPage,
    'incentive-summary': IncentiveManagementPage,
    'channel-api-settings': ChannelApiSettingsPage,
    payroll: PayrollPage,
    quotation: QuotationPage,
    'profit-management': ProfitManagementPage,
    'product-cost': ProductCostPage,
    'blog-auto-publish': BlogAutoPublishPage,
    'ai-review-center': AIReviewCenterPage,
    'support-programs': SupportProgramPage,
    'brand-health': BrandHealthPage,
    settings: Settings,
}

  // 모바일 하단 탭 네비게이션 메뉴
const mobileTabs = [
  { id: 'platform', label: '홈', icon: 'apps' },
  { id: 'channel-sales', label: '매출', icon: 'leaderboard' },
  { id: 'settlement-schedule', label: '정산', icon: 'payments' },
  { id: 'inventory', label: '재고', icon: 'warehouse' },
  { id: 'staff-dashboard', label: '더보기', icon: 'menu' },
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
    const [menuOpen, setMenuOpen] = useState(false)
    const PageComponent = pages[activePage] || PlatformOverviewPage

  // 메뉴 외부 클릭 시 닫힘
  useEffect(() => {
        if (!menuOpen) return
        const handler = (e) => {
                if (!e.target.closest('.mobile-drawer')) setMenuOpen(false)
        }
        document.addEventListener('pointerdown', handler)
        return () => document.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  const navItems = [
    { id: 'platform', label: '업무 홈', icon: 'apps' },
    { id: 'ceo-dashboard', label: 'CEO 전략 대시보드', icon: 'monitoring' },
    { id: 'cash-flow', label: '현금 흐름', icon: 'account_balance_wallet' },
    { id: 'channel-sales', label: '실시간 매출', icon: 'leaderboard' },
    { id: 'settlement-schedule', label: '정산 예정', icon: 'payments' },
    { id: 'inventory', label: '재고 현황', icon: 'warehouse' },
    { id: 'receivables', label: '미수금', icon: 'credit_score' },
    { id: 'staff-dashboard', label: '직원 대시보드', icon: 'dashboard' },
    { id: 'staff-work-report', label: '업무 보고', icon: 'assignment_add' },
    { id: 'staff-project-status', label: '프로젝트 현황', icon: 'view_timeline' },
    { id: 'work-management', label: '업무 진행 관리', icon: 'assignment' },
    { id: 'employee-performance', label: '직원 성과 분석', icon: 'analytics' },
    { id: 'channel-operations', label: '채널 운영', icon: 'storefront' },
    { id: 'customer-inquiry', label: 'CS 문의', icon: 'forum' },
    { id: 'incentive-summary', label: '직원 인센티브', icon: 'payments' },
    { id: 'account', label: '내 계정', icon: 'account_circle' },
      ]

  return (
        <div className="app-light flex h-dvh flex-col bg-slate-50 text-slate-900" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* 모바일 상단 헤더 */}
                <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
                          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
                          <button
                                      type="button"
                                      className="mobile-drawer flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                                      onClick={() => setMenuOpen(true)}
                                      aria-label="메뉴 열기"
                                    >
                                    <span className="material-symbols-outlined text-2xl">menu</span>span>
                          </button>button>
                        <div className="text-center">
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600">Naeil Group</p>p>
                                  <p className="text-sm font-black text-slate-950">Business Platform</p>p>
                        </div>div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">
                          {(session?.displayName || session?.username || 'A').slice(0, 1).toUpperCase()}
                        </div>div>
                </header>header>
        
          {/* 모바일 드로어 메뉴 */}
          {menuOpen && (
                  <div className="fixed inset-0 z-50 flex">
                            <div className="mobile-drawer flex h-full w-72 flex-col bg-white shadow-2xl">
                                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                                                      <div>
                                                                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600">Naeil Group</p>p>
                                                                      <p className="text-base font-black text-slate-950">Business Platform</p>p>
                                                      </div>div>
                                                      <button type="button" onClick={() => setMenuOpen(false)}
                                                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                                                                      <span className="material-symbols-outlined">close</span>span>
                                                      </button>button>
                                        </div>div>
                                        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">
                                                        {(session?.displayName || session?.username || 'A').slice(0, 1).toUpperCase()}
                                                      </div>div>
                                                      <div className="min-w-0">
                                                                      <p className="truncate text-sm font-black text-slate-950">{session?.displayName || session?.username}</p>p>
                                                                      <p className="text-xs text-slate-500">{session?.department || ''}</p>p>
                                                      </div>div>
                                        </div>div>
                                        <nav className="flex-1 overflow-y-auto py-2">
                                          {navItems.map((item) => {
                                    const isActive = activePage === item.id
                                                      return (
                                                                          <button key={item.id} type="button"
                                                                                                onClick={() => { setPage(item.id); setMenuOpen(false) }}
                                                                                                className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${isActive ? 'bg-sky-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                                                                                              <span className="material-symbols-outlined shrink-0 text-xl">{item.icon}</span>span>
                                                                                              <span>{item.label}</span>span>
                                                                          </button>button>
                                                                        )
                  })}
                                        </nav>nav>
                                        <div className="border-t border-slate-200 p-4">
                                                      <button type="button"
                                                                        onClick={async () => { await logout(); window.location.reload() }}
                                                                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 text-sm font-black text-slate-600 hover:bg-slate-100">
                                                                      <span className="material-symbols-outlined text-lg">logout</span>span>
                                                                      로그아웃
                                                      </button>button>
                                        </div>div>
                            </div>div>
                            <div className="flex-1 bg-black/40" onClick={() => setMenuOpen(false)} />
                  </div>div>
              )}
        
          {/* 페이지 컨텐츠 */}
              <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '72px' }}>
                      <PageComponent
                                  onNavigate={(id) => { setPage(id); setMenuOpen(false) }}
                                  username={session?.username}
                                  displayName={session?.displayName}
                                  department={session?.department}
                                  positionName={session?.positionName}
                                  role={userRole}
                                  accessPermissions={session?.allowedMenuSections}
                                />
              </main>main>
        
          {/* 하단 고정 탭 네비게이션 */}
              <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                      <div className="grid h-16 grid-cols-5">
                        {mobileTabs.map((tab) => {
                                      const active = activePage === tab.id
                                                    return (
                                                                    <button key={tab.id} type="button"
                                                                                      onClick={() => setPage(tab.id)}
                                                                                      className={`flex flex-col items-center justify-center gap-0.5 rounded-none text-[11px] font-medium transition-colors ${active ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                                                                    <span className={`material-symbols-outlined text-[22px] ${active ? 'filled' : ''}`}>{tab.icon}</span>span>
                                                                                    <span>{tab.label}</span>span>
                                                                    </button>button>
                                                                  )
                        })}
                      </div>div>
              </nav>nav>
        </div>div>
      )
}

export default function App() {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
        const [page, setPage] = useState('platform')
            const [authLoading, setAuthLoading] = useState(true)
                const [session, setSession] = useState(null)
                    const isMobile = useIsMobile()
                      
                        useEffect(() => {
                              const token = getAuthToken()
                                    if (!token) {
                                            setSession(null)
                                                    setAuthLoading(false)
                                                            return
                                    }
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
                                    const handleUnauthorized = () => { setSession(null); setAuthLoading(false) }
                                          window.addEventListener('auth:unauthorized', handleUnauthorized)
                                                return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
                        }, [])
                          
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
                                                                        <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Naeil Platform</p>p>
                                                                        <p className="mt-4 text-2xl font-black">접속 상태를 확인하는 중입니다.</p>p>
                                                              </div>div>
                                                      </main>main>
                                                    )
                                        }
  
    if (!session) return <LoginPage onLogin={handleLogin} />
      
        const userRole = session.role ?? 'EMPLOYEE'
          
            // 모바일에서는 MobileLayout 사용
    if (isMobile) {
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
                            </main>main>
                    </div>div>
              </div>div>
            )
}</button>
