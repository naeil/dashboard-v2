const sectionIcons = {
  'executive-home': 'monitoring',
  'finance-management': 'account_balance',
  'profit-product': 'trending_up',
  'operations-management': 'assignment',
  common: 'apps',
  'channel-sales-management': 'storefront',
  'performance-incentive': 'bar_chart',
  settings: 'api',
  marketing: 'campaign',
  'accounting-sales': 'business_center',
  system: 'admin_panel_settings',
}

export default function TopNav({ sections = [], activeSectionId, onSelectSection }) {
  return (
    <header className="z-40 flex h-14 shrink-0 items-stretch border-b border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center border-r border-slate-100 px-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">Naeil Group</p>
          <p className="-mt-0.5 text-sm font-black leading-tight text-slate-950">Business Platform</p>
        </div>
      </div>
      <nav className="flex flex-1 items-stretch gap-0.5 overflow-x-auto px-2" aria-label="주요 카테고리">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelectSection(section.id)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] transition-colors ${
                isActive ? 'font-black text-sky-600' : 'font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="material-symbols-outlined text-lg">{sectionIcons[section.id] || 'folder'}</span>
              <span>{section.title}</span>
              {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-500" />}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
