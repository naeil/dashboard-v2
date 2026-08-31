import { useEffect, useState } from 'react'
import { getMenuConfig } from '../api/settingsApi'
import { getAllowedMenus, parseAccessPermissions } from '../utils/accessPermissions'

const departmentAliases = {
  salesSupport: ['영업지원', '운영', '물류', '생산', 'CS'],
  marketing: ['마케팅', '마케팅팀', '온라인MD', 'MD', '콘텐츠', '광고'],
  accounting: ['회계', '재무', '경리', '정산'],
  sales: ['영업', '해외영업', '수출', '컨설팅', 'B2B'],
}

export const SIDEBAR_MENU_ORDER_KEY = 'sidebar_menu_order_v2'

export const defaultMenuSections = [
  {
    id: 'executive-home',
    title: '대표 홈',
    group: 'executive',
    departments: ['executive'],
    items: [
      { id: 'ceo-dashboard', icon: 'monitoring', label: 'CEO 전략 대시보드', roles: ['EXECUTIVE'] },
      { id: 'cfo-dashboard', icon: 'account_balance', label: 'CFO 재무관리', roles: ['EXECUTIVE'] },
      { id: 'personal-task-board', icon: 'checklist', label: '개인 업무 관리', roles: ['EXECUTIVE'] },
    ],
  },
  {
    id: 'finance-management',
    title: '재무 관리',
    group: 'executive',
    departments: ['manager'],
    items: [
      { id: 'cash-flow', icon: 'account_balance_wallet', label: '현금 흐름', roles: ['EXECUTIVE'] },
      { id: 'payment-approval', icon: 'approval', label: '입출금 결재 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'debts', icon: 'credit_score', label: '대출 / 부채', roles: ['EXECUTIVE'] },
      { id: 'operating-expenses', icon: 'receipt_long', label: '운영 비용', roles: ['EXECUTIVE'] },
      { id: 'support-programs', icon: 'volunteer_activism', label: '지원사업 현황', roles: ['EXECUTIVE'] },
    ],
  },
  {
    id: 'profit-product',
    title: '손익 · 상품 수익성',
    group: 'executive',
    departments: ['manager'],
    items: [
      { id: 'profit-management', icon: 'trending_up', label: 'BEP / 손익 시뮬레이션', roles: ['EXECUTIVE'] },
      { id: 'product-cost', icon: 'calculate', label: '제품 원가 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'customer-intelligence', icon: 'insights', label: '고객 가치 분석', roles: ['EXECUTIVE'] },
    ],
  },
  {
    id: 'operations-management',
    title: '운영 관리',
    group: 'executive',
    departments: ['manager'],
    items: [
      { id: 'work-management', icon: 'assignment', label: '업무 진행 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'employee-performance', icon: 'analytics', label: '직원 성과 분석', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'organization', icon: 'account_tree', label: '조직 관리', roles: ['EXECUTIVE'] },
    ],
  },
  {
    id: 'common',
    title: '공통',
    group: 'staff',
    departments: ['all'],
    items: [
      { id: 'platform', icon: 'apps', label: '업무 홈', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], emphasis: true },
      { id: 'control-tower', icon: 'space_dashboard', label: '종합 상황판', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'weekly-biz-report', icon: 'summarize', label: '주간 업무 보고', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'staff-dashboard', icon: 'dashboard', label: '직원 대시보드', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'staff-work-report', icon: 'assignment_add', label: '업무 보고', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true, personalSuffix: '업무 보고' },
      { id: 'staff-project-status', icon: 'view_timeline', label: '프로젝트 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true, personalSuffix: '프로젝트 현황' },
      { id: 'brand-health', icon: 'storefront', label: '브랜드 사업 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'field-data-input', icon: 'edit_note', label: '실무 입력 (매출·광고비·재고·비용)', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'work-input', icon: 'edit_note', label: '내 업무 입력', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true },
      { id: 'payment-request', icon: 'request_page', label: '지출결의 / 기안서', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
    ],
  },
  {
    id: 'production-management',
    title: '생산 관리',
    group: 'staff',
    departments: ['all'],
    items: [
      { id: 'production-orders', icon: 'factory', label: '발주 관리', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'production-costs', icon: 'price_change', label: '원가 추적', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
    ],
  },
  {
    id: 'channel-sales-management',
    title: '채널 · 판매 관리',
    group: 'staff',
    departments: ['all'],
    items: [
      { id: 'channel-sales', icon: 'leaderboard', label: '실시간 매출', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'channel-operations', icon: 'storefront', label: '채널 운영', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'customer-inquiry', icon: 'forum', label: 'CS 문의', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'channel-credentials', icon: 'encrypted', label: '채널 계정 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'inventory', icon: 'warehouse', label: '재고 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'product-movement', icon: 'inventory', label: '제품 출입고', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'inventory-flow', icon: 'sync_alt', label: '입출고 관리', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'inventory-forecast', icon: 'query_stats', label: '재고 예측', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'partners', icon: 'groups', label: '거래처 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'partner-payment', icon: 'account_balance', label: '입출금 관리', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'settlement-schedule', icon: 'payments', label: '거래처별 정산 예정현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
    ],
  },
  {
    id: 'performance-incentive',
    title: '성과 · 인센티브 관리',
    group: 'staff',
    departments: ['all'],
    items: [
      { id: 'kpi-performance', icon: 'military_tech', label: 'KPI 성과급', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'incentive-online', icon: 'bar_chart', label: '온라인 성과', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'incentive-clients', icon: 'handshake', label: '거래처 성과', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'incentive-summary', icon: 'payments', label: '직원별 예상 인센티브', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
    ],
  }, {
    id: 'settings',
    title: '설정',
    group: 'staff',
    departments: ['all'],
    items: [
      { id: 'channel-api-settings', icon: 'api', label: '채널 API 관리', roles: ['EXECUTIVE', 'MANAGER'] },
    ],
  },

  {
    id: 'marketing',
    title: '마케팅',
    group: 'staff',
    departments: ['marketing'],
    items: [
      { id: 'promotion-margin', icon: 'sell', label: '마케팅 프로젝트', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'promotion-history', icon: 'receipt_long', label: '프로모션 내역', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'ad-performance', icon: 'campaign', label: '광고 성과', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'marketing-agent', icon: 'auto_awesome', label: '마케팅 에이전트', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'blog-auto-publish', icon: 'rss_feed', label: '블로그 자동 배포 AI', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'ai-review-center', icon: 'smart_toy', label: 'AI 고객 인텔리전스 센터', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'cs-auto-reply', icon: 'auto_fix_high', label: 'CS 자동답변', roles: ['EXECUTIVE', 'MANAGER'] },
    ],
  },
  {
    id: 'accounting-sales',
    title: '회계 · 영업',
    group: 'staff',
    departments: ['accounting', 'sales'],
    items: [
      { id: 'consulting-revenue', icon: 'business_center', label: '컨설팅 매출', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'export-pipeline', icon: 'public', label: '수출 파이프라인', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'payroll', icon: 'payments', label: '임금 지급 내역', roles: ['EXECUTIVE', 'MANAGER'] },
      { id: 'quotation', icon: 'receipt', label: '견적서 출력', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
    ],
  },
  {
    id: 'system',
    title: '시스템',
    group: 'system',
    departments: ['all'],
    items: [
      { id: 'platform-admin', icon: 'admin_panel_settings', label: '플랫폼 관리', roles: ['EXECUTIVE'] },
      { id: 'account', icon: 'account_circle', label: '내 계정', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
      { id: 'attendance-admin', icon: 'badge', label: '출퇴근 기록', roles: ['EXECUTIVE'] },
      { id: 'menu-order-settings', icon: 'swap_vert', label: '카테고리 이동', roles: ['EXECUTIVE'] },
      { id: 'settings', icon: 'settings', label: '설정', roles: ['EXECUTIVE'] },
    ],
  },
]

export function getOrderedMenuSections() {
  let order = null
  try {
    order = JSON.parse(localStorage.getItem(SIDEBAR_MENU_ORDER_KEY) || 'null')
  } catch {
    order = null
  }

  const sectionById = new Map(defaultMenuSections.map((section) => [section.id, section]))
  const itemById = new Map(defaultMenuSections.flatMap((section) => section.items.map((item) => [item.id, item])))
  const orderedSectionIds = Array.isArray(order?.sections) ? order.sections.filter((id) => sectionById.has(id)) : []
  const sectionIds = [
    ...orderedSectionIds,
    ...defaultMenuSections.map((section) => section.id).filter((id) => !orderedSectionIds.includes(id)),
  ]
  const savedItems = order?.items && typeof order.items === 'object' ? order.items : {}
  const assignedItemIds = new Set(Object.values(savedItems).flat().filter((id) => itemById.has(id)))

  return sectionIds.map((sectionId) => {
    const section = sectionById.get(sectionId)
    const orderedItemIds = Array.isArray(savedItems[sectionId]) ? savedItems[sectionId] : []
    const itemIds = [
      ...orderedItemIds.filter((id) => itemById.has(id)),
      ...section.items.map((item) => item.id).filter((id) => !assignedItemIds.has(id) && !orderedItemIds.includes(id)),
    ]
    return { ...section, items: itemIds.map((itemId) => itemById.get(itemId)).filter(Boolean) }
  })
}

const roleLabels = {
  EXECUTIVE: '대표 / 임원',
  MANAGER: '관리자',
  EMPLOYEE: '직원',
}

function normalizeDepartment(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase()
}

function matchesDepartment(sectionDepartments, department, role) {
  if (sectionDepartments.includes('all')) return true
  if (role === 'EXECUTIVE') return true
  if (role === 'MANAGER') return !sectionDepartments.includes('executive')
  if (!department) return !sectionDepartments.includes('executive') && !sectionDepartments.includes('manager')

  const normalized = normalizeDepartment(department)
  return sectionDepartments.some((key) => {
    const aliases = departmentAliases[key] || []
    return aliases.some((alias) => normalized.includes(normalizeDepartment(alias)))
  })
}

function isItemAllowed(itemId, allowedMenuIds) {
  if (!Array.isArray(allowedMenuIds)) return true
  return allowedMenuIds.includes(itemId)
}

function MenuLabel({ isExpanded, children }) {
  return (
    <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
      {children}
    </span>
  )
}

function getMenuOverrides() {
  try {
    const saved = localStorage.getItem('menu_config_overrides')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

export function useVisibleMenuSections({ role = 'EXECUTIVE', department, allowedMenuSections = null }) {
  const [, setMenuVersion] = useState(0)

  useEffect(() => {
    const refresh = () => setMenuVersion((v) => v + 1)
    window.addEventListener('storage', refresh)
    window.addEventListener('sidebar:menu-order-updated', refresh)
    window.addEventListener('sidebar:menu-config-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('sidebar:menu-order-updated', refresh)
      window.removeEventListener('sidebar:menu-config-updated', refresh)
    }
  }, [])

  useEffect(() => {
    getMenuConfig()
      .then((response) => {
        const overrides = response.data?.overrides
        const order = response.data?.order
        if (overrides && typeof overrides === 'object') {
          localStorage.setItem('menu_config_overrides', JSON.stringify(overrides))
        }
        if (order && typeof order === 'object') {
          localStorage.setItem(SIDEBAR_MENU_ORDER_KEY, JSON.stringify(order))
        }
        setMenuVersion((value) => value + 1)
      })
      .catch(() => {})
  }, [])

  const allowedMenuIds = role === 'EXECUTIVE'
    ? null
    : getAllowedMenus(parseAccessPermissions(allowedMenuSections))
  const hasItemLevelPermissions = Array.isArray(allowedMenuIds)
  const overrides = getMenuOverrides()

  return getOrderedMenuSections()
    .map((section) => {
      const sectionOverride = overrides[section.id] || {}
      if (sectionOverride.deleted || sectionOverride.hidden) return null
      if (sectionOverride.private && role !== 'EXECUTIVE') return null
      if (!matchesDepartment(section.departments, department, role)) return null

      let items = section.items
        .map((item) => {
          const itemOverride = overrides[item.id] || {}
          if (itemOverride.deleted || itemOverride.hidden) return null
          if (itemOverride.private && role !== 'EXECUTIVE') return null
          const merged = { ...item }
          if (itemOverride.label) merged.label = itemOverride.label
          if (itemOverride.bold) merged.bold = true
          return merged
        })
        .filter(Boolean)
        .filter((item) => item.roles.includes(role) || (hasItemLevelPermissions && isItemAllowed(item.id, allowedMenuIds)))

      if (hasItemLevelPermissions) {
        items = items.filter((item) => isItemAllowed(item.id, allowedMenuIds))
      }
      if (items.length === 0) return null
      const sectionWithOverride = sectionOverride.label ? { ...section, title: sectionOverride.label } : section
      return { ...sectionWithOverride, items }
    })
    .filter(Boolean)
}

export default function Sidebar({
  isExpanded,
  onToggle,
  activePage,
  onNavigate,
  username,
  displayName,
  department,
  role = 'EXECUTIVE',
  onLogout,
  sections = [],
  activeSectionId = null,
}) {
  const personalBaseLabel = displayName || username || '내'

  const activeSection =
    sections.find((section) => section.id === activeSectionId) ||
    sections.find((section) => section.items.some((item) => item.id === activePage)) ||
    sections[0] ||
    null

  return (
    <aside className={`relative z-30 flex h-full shrink-0 flex-col border-r border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-300 ${isExpanded ? 'w-72' : 'w-20'}`}>
      <div className={`flex items-center px-3 py-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
        {isExpanded && activeSection && (
          <span className="truncate px-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{activeSection.title}</span>
        )}
        <button type="button" onClick={onToggle} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950" aria-label={isExpanded ? '사이드바 접기' : '사이드바 펼치기'}>
          <span className="material-symbols-outlined">{isExpanded ? 'menu_open' : 'menu'}</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {activeSection && (
          <div className="space-y-1">
            {activeSection.items.map((item) => {
              const isActive = activePage === item.id
              const isBold = item.bold || item.emphasis
              return (
                <a
                  key={`${activeSection.id}-${item.id}`}
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigate(item.id)
                  }}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${isBold ? 'font-black' : 'font-bold'} ${isActive ? 'bg-sky-500 text-white shadow-sm' : isBold ? 'text-slate-900 hover:bg-slate-100 hover:text-slate-950' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
                >
                  <span className="material-symbols-outlined shrink-0 text-xl">{item.icon}</span>
                  <MenuLabel isExpanded={isExpanded}>{item.personal ? `${personalBaseLabel} / ${item.personalSuffix || item.label}` : item.label}</MenuLabel>
                </a>
              )
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className={`flex rounded-lg bg-slate-50 p-3 ${isExpanded ? 'items-center justify-between gap-3' : 'justify-center'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">
              {(displayName || username || 'A').slice(0, 1).toUpperCase()}
            </div>
            {isExpanded && (
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-950">{displayName || username || 'admin'}</p>
                <p className="text-[11px] font-bold text-slate-500">{department ? `${department} · ${roleLabels[role] || role}` : roleLabels[role] || role}</p>
              </div>
            )}
          </div>
          {isExpanded && (
            <button type="button" onClick={onLogout} className="rounded-lg px-3 py-2 text-xs font-black text-slate-500 transition-colors hover:bg-white hover:text-slate-950">
              로그아웃
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
// build: 1781252773189
