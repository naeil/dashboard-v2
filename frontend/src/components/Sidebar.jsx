const menuItems = [
  { id: 'summary', icon: 'dashboard', label: '경영 요약' },
  { id: 'cash-flow', icon: 'account_balance_wallet', label: '현금 흐름' },
  { id: 'product-profit', icon: 'inventory_2', label: '제품 손익' },
  { id: 'product-forecast', icon: 'trending_up', label: '제품별 예상 리스크' },
  { id: 'channel-sales', icon: 'leaderboard', label: '채널 매출' },
  { id: 'consulting-revenue', icon: 'business_center', label: '컨설팅 매출' },
  { id: 'receivables', icon: 'request_quote', label: '미수금 관리' },
  { id: 'operating-expenses', icon: 'receipt_long', label: '운영 비용' },
  { id: 'debts', icon: 'credit_score', label: '대출 / 부채' },
  { id: 'inventory', icon: 'warehouse', label: '재고 관리' },
  { id: 'export-pipeline', icon: 'public', label: '수출 파이프라인' },
  { id: 'marketing-status', icon: 'monitoring', label: '마케팅 현황' },
  { id: 'ad-performance', icon: 'campaign', label: '광고 성과' },
  { id: 'partners', icon: 'groups', label: '거래처 관리' },
  { id: 'settings', icon: 'settings', label: '설정' },
]

function MenuLabel({ isExpanded, children }) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
        isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
      }`}
    >
      {children}
    </span>
  )
}

export default function Sidebar({
  isExpanded,
  onToggle,
  activePage,
  onNavigate,
  username,
  onLogout,
}) {
  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-white/10 bg-slate-950 text-slate-300 transition-all duration-300 ${
        isExpanded ? 'w-72' : 'w-20'
      }`}
    >
      <div className={`flex items-center p-5 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
        <div className={`min-w-0 ${isExpanded ? 'block' : 'hidden'}`}>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Naeil Group</p>
          <h1 className="mt-1 truncate text-lg font-black text-white">Executive Dashboard</h1>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isExpanded ? '사이드바 접기' : '사이드바 펼치기'}
        >
          <span className="material-symbols-outlined">{isExpanded ? 'menu_open' : 'menu'}</span>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {menuItems.map((item) => {
          const isActive = activePage === item.id

          return (
            <a
              key={item.id}
              href="#"
              onClick={(event) => {
                event.preventDefault()
                onNavigate(item.id)
              }}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-950/30'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined shrink-0 text-xl">{item.icon}</span>
              <MenuLabel isExpanded={isExpanded}>{item.label}</MenuLabel>
            </a>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className={`flex rounded-lg bg-white/[0.04] p-3 ${isExpanded ? 'items-center justify-between gap-3' : 'justify-center'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400 text-sm font-black text-slate-950">
              {(username || 'A').slice(0, 1).toUpperCase()}
            </div>
            {isExpanded && (
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">{username || '관리자'}</p>
                <p className="text-[11px] font-bold text-slate-500">관리자 계정</p>
              </div>
            )}
          </div>
          {isExpanded && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-3 py-2 text-xs font-black text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
