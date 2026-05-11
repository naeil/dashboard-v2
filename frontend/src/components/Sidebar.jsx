import { useMemo, useState } from 'react'

const menuItems = [
  { id: 'dashboard', icon: 'dashboard', label: '개요' },
  { id: 'sales', icon: 'leaderboard', label: '매출 현황' },
  { id: 'customers', icon: 'groups', label: '고객 관리', comingSoon: true },
  { id: 'marketing', icon: 'campaign', label: '마케팅', comingSoon: true },
  {
    id: 'products',
    icon: 'inventory_2',
    label: '상품 관리',
    children: [
      { id: 'products-inventory', label: '재고 관리' },
      { id: 'products-costs', label: '비용 관리' },
    ],
  },
]

function MenuLabel({ isExpanded, children, className = '' }) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
        isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
      } ${className}`}
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
  const [openMenus, setOpenMenus] = useState({ products: true })

  const productsActive = useMemo(
    () => activePage === 'products' || activePage === 'products-inventory' || activePage === 'products-costs',
    [activePage]
  )

  const toggleSubmenu = (menuId) => {
    setOpenMenus((prev) => ({ ...prev, [menuId]: !prev[menuId] }))
  }

  const handleMenuClick = (event, item) => {
    event.preventDefault()
    if (item.comingSoon) return
    onNavigate(item.id)
  }

  const renderComingSoonBadge = () =>
    isExpanded ? (
      <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">준비중</span>
    ) : null

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-full flex-col bg-slate-100 shadow-sm transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
    >
      <div
        className={`flex items-center border-b border-transparent p-6 ${
          isExpanded ? 'justify-between' : 'justify-center'
        }`}
      >
        <div
          className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
            isExpanded ? 'w-auto opacity-100' : 'hidden w-0 opacity-0'
          }`}
        >
          <span className="text-xl font-bold text-slate-900">Naeil Dashboard</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200"
        >
          <span className="material-symbols-outlined">{isExpanded ? 'menu_open' : 'menu'}</span>
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {menuItems.map((item) => {
          if (!item.children) {
            const isActive = activePage === item.id
            const isDisabled = Boolean(item.comingSoon)

            return (
              <a
                key={item.id}
                href="#"
                onClick={(event) => handleMenuClick(event, item)}
                className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-r-4 border-slate-900 bg-slate-200/50 font-bold text-slate-900'
                    : isDisabled
                      ? 'cursor-default text-slate-400'
                      : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">{item.icon}</span>
                <div
                  className={`flex min-w-0 flex-1 items-center ${
                    isExpanded ? 'ml-3 justify-between gap-2' : 'ml-0'
                  }`}
                >
                  <MenuLabel isExpanded={isExpanded}>{item.label}</MenuLabel>
                  {isDisabled && renderComingSoonBadge()}
                </div>
              </a>
            )
          }

          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (!isExpanded) {
                    onToggle()
                    return
                  }
                  toggleSubmenu(item.id)
                }}
                className={`flex w-full items-center space-x-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  productsActive
                    ? 'bg-slate-200/50 font-bold text-slate-900'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined shrink-0">{item.icon}</span>
                <MenuLabel isExpanded={isExpanded} className="flex-1 text-left">
                  {item.label}
                </MenuLabel>
                {isExpanded && (
                  <span className="material-symbols-outlined text-base">
                    {openMenus[item.id] ? 'expand_less' : 'expand_more'}
                  </span>
                )}
              </button>

              {isExpanded && openMenus[item.id] && (
                <div className="ml-6 space-y-1 border-l border-slate-300/70 pl-3">
                  {item.children.map((child) => {
                    const childActive = activePage === child.id
                    return (
                      <a
                        key={child.id}
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          onNavigate(child.id)
                        }}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          childActive
                            ? 'bg-white font-bold text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {child.label}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 p-4">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('settings')
          }}
          className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            activePage === 'settings'
              ? 'border-r-4 border-slate-900 bg-slate-200/50 font-bold text-slate-900'
              : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined shrink-0">settings</span>
          <MenuLabel isExpanded={isExpanded} className={isExpanded ? 'ml-3' : ''}>
            설정
          </MenuLabel>
        </a>

        <div
          className={`flex rounded-lg bg-white/70 p-3 transition-all duration-300 ${
            isExpanded ? 'items-center justify-between gap-3' : 'justify-center overflow-hidden'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {(username || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <p className="text-xs font-bold text-slate-900">{username || '관리자'}</p>
              <p className="text-[10px] text-slate-500">테스트 배포 계정</p>
            </div>
          </div>

          {isExpanded && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
