import { useEffect, useMemo, useState } from 'react'
import { SIDEBAR_MENU_ORDER_KEY, defaultMenuSections } from '../../components/Sidebar'
import { getMenuConfig, saveMenuConfig } from '../../api/settingsApi'

function StatusBadge({ label, color }) {
  const colors = {
    hidden: 'bg-slate-100 text-slate-500',
    private: 'bg-violet-100 text-violet-600',
    deleted: 'bg-red-100 text-red-500',
    bold: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${colors[color] || colors.hidden}`}>
      {label}
    </span>
  )
}

function EditableLabel({ value, originalLabel, onChange, isBold }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || originalLabel)

  function commit() {
    const trimmed = draft.trim()
    onChange(trimmed === originalLabel ? null : trimmed || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full rounded border border-sky-300 px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-sky-400"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        setDraft(value || originalLabel)
        setEditing(true)
      }}
      className="group flex items-center gap-1 text-left"
      title="이름 수정"
    >
      <span className={`text-sm ${isBold ? 'font-black text-slate-950' : 'font-bold'} ${value && value !== originalLabel ? 'text-sky-600' : isBold ? 'text-slate-950' : 'text-slate-800'}`}>
        {value || originalLabel}
      </span>
      {value && value !== originalLabel && (
        <span className="text-[10px] text-slate-400 line-through">{originalLabel}</span>
      )}
      <span className="material-symbols-outlined text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">edit</span>
    </button>
  )
}

function getDefaultOrder() {
  return {
    sections: defaultMenuSections.map((section) => section.id),
    items: Object.fromEntries(defaultMenuSections.map((section) => [section.id, section.items.map((item) => item.id)])),
  }
}

function normalizeOrder(value) {
  const defaults = getDefaultOrder()
  const validSectionIds = new Set(defaults.sections)
  const validItemIds = new Set(defaultMenuSections.flatMap((section) => section.items.map((item) => item.id)))
  const requestedSections = Array.isArray(value?.sections) ? value.sections : []
  const sections = [
    ...requestedSections.filter((id) => validSectionIds.has(id)),
    ...defaults.sections.filter((id) => !requestedSections.includes(id)),
  ]
  const rawItems = value?.items && typeof value.items === 'object' ? value.items : {}
  const assigned = new Set()
  const items = {}

  sections.forEach((sectionId) => {
    const defaultIds = defaults.items[sectionId] || []
    const hasSavedItems = Object.prototype.hasOwnProperty.call(rawItems, sectionId)
    const savedIds = Array.isArray(rawItems[sectionId])
      ? rawItems[sectionId].filter((id) => validItemIds.has(id) && !assigned.has(id))
      : []
    savedIds.forEach((id) => assigned.add(id))
    items[sectionId] = hasSavedItems ? savedIds : defaultIds.filter((id) => !assigned.has(id))
    items[sectionId].forEach((id) => assigned.add(id))
  })

  defaultMenuSections.forEach((section) => {
    section.items.forEach((item) => {
      if (!assigned.has(item.id)) {
        items[section.id] = [...(items[section.id] || []), item.id]
        assigned.add(item.id)
      }
    })
  })

  return { sections, items }
}

function buildOrderedSections(order) {
  const normalized = normalizeOrder(order)
  const sectionById = new Map(defaultMenuSections.map((section) => [section.id, section]))
  const itemById = new Map(defaultMenuSections.flatMap((section) => section.items.map((item) => [item.id, item])))
  return normalized.sections
    .map((sectionId) => {
      const section = sectionById.get(sectionId)
      if (!section) return null
      return {
        ...section,
        items: (normalized.items[sectionId] || []).map((itemId) => itemById.get(itemId)).filter(Boolean),
      }
    })
    .filter(Boolean)
}

function findItem(itemId) {
  if (!itemId) return null
  return defaultMenuSections.flatMap((section) => section.items).find((item) => item.id === itemId) || null
}

function cleanOverrides(overrides) {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) =>
      value.label || value.hidden || value.private || value.deleted || value.bold
    )
  )
}

export default function MenuOrderSettingsPage() {
  const [overrides, setOverrides] = useState({})
  const [order, setOrder] = useState(() => getDefaultOrder())
  const [selectedItemId, setSelectedItemId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    getMenuConfig()
      .then((response) => {
        setOverrides(response.data?.overrides || {})
        setOrder(normalizeOrder(response.data?.order))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sections = useMemo(() => buildOrderedSections(order), [order])
  const selectedItem = findItem(selectedItemId)

  function getOv(id) {
    return overrides[id] || {}
  }

  function setOv(id, patch) {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }))
  }

  function toggleHidden(id) {
    setOv(id, { hidden: !getOv(id).hidden })
  }

  function togglePrivate(id) {
    setOv(id, { private: !getOv(id).private })
  }

  function toggleDeleted(id) {
    setOv(id, { deleted: !getOv(id).deleted })
  }

  function toggleBold(id) {
    setOv(id, { bold: !getOv(id).bold })
  }

  function setLabel(id, label) {
    setOv(id, { label: label || null })
  }

  function moveSelectedItem(targetSectionId) {
    if (!selectedItemId) return
    setOrder((prev) => {
      const next = normalizeOrder(prev)
      const sourceSectionId = Object.keys(next.items).find((sectionId) => next.items[sectionId].includes(selectedItemId))
      if (!sourceSectionId || sourceSectionId === targetSectionId) return next

      return {
        ...next,
        items: Object.fromEntries(
          Object.entries(next.items).map(([sectionId, itemIds]) => {
            const withoutSelected = itemIds.filter((id) => id !== selectedItemId)
            if (sectionId === targetSectionId) return [sectionId, [...withoutSelected, selectedItemId]]
            return [sectionId, withoutSelected]
          })
        ),
      }
    })
  }

  /** 카테고리(섹션) 자체를 위/아래로 이동 */
  function moveSection(sectionId, dir) {
    setOrder((prev) => {
      const next = normalizeOrder(prev)
      const idx = next.sections.indexOf(sectionId)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= next.sections.length) return next
      const sections = [...next.sections]
      ;[sections[idx], sections[target]] = [sections[target], sections[idx]]
      return { ...next, sections }
    })
  }

  /** 카테고리 안에서 메뉴를 위/아래로 이동 */
  function moveItemWithin(sectionId, itemId, dir) {
    setOrder((prev) => {
      const next = normalizeOrder(prev)
      const ids = [...(next.items[sectionId] || [])]
      const idx = ids.indexOf(itemId)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= ids.length) return next
      ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
      return { ...next, items: { ...next.items, [sectionId]: ids } }
    })
  }

  async function handleSave() {
    const clean = cleanOverrides(overrides)
    const cleanOrder = normalizeOrder(order)
    await saveMenuConfig({ overrides: clean, order: cleanOrder })
    localStorage.setItem('menu_config_overrides', JSON.stringify(clean))
    localStorage.setItem(SIDEBAR_MENU_ORDER_KEY, JSON.stringify(cleanOrder))
    window.dispatchEvent(new Event('sidebar:menu-config-updated'))
    window.dispatchEvent(new Event('sidebar:menu-order-updated'))
    const now = new Date()
    setSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 저장됨`)
  }

  function handleReset() {
    setOverrides({})
    setOrder(getDefaultOrder())
    setSelectedItemId('')
    localStorage.removeItem('menu_config_overrides')
    localStorage.removeItem(SIDEBAR_MENU_ORDER_KEY)
    window.dispatchEvent(new Event('sidebar:menu-config-updated'))
    window.dispatchEvent(new Event('sidebar:menu-order-updated'))
    setSavedAt('기본값으로 복원됨')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-sky-400">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Admin Menu Control</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">카테고리 관리</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              이름 수정, 이동, 숨기기, 비공개, 삭제를 저장하면 전체 직원에게 반영됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-xs font-black text-emerald-600">{savedAt}</span>}
            <button
              type="button"
              onClick={() => setShowDeleted((value) => !value)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-xs font-black transition-colors ${showDeleted ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="material-symbols-outlined text-base">delete</span>
              삭제 항목 {showDeleted ? '숨기기' : '표시'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              기본값
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-600 px-5 text-xs font-black text-white shadow-sm hover:bg-sky-500"
            >
              <span className="material-symbols-outlined text-base">save</span>
              저장
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-sky-500">swap_vert</span>
            ▲▼ → 카테고리·메뉴 순서 이동
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-sky-500">ads_click</span>
            메뉴 클릭 → 이동할 카테고리의 여기로 이동
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">edit</span>
            이름 클릭 → 수정
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-amber-500">format_bold</span>
            굵게 → 사이드바 메뉴명 굵은 폰트 강조
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">visibility_off</span>
            숨기기 → 사이드바에서 안 보임
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-violet-400">lock</span>
            비공개 → 대표/임원만 보임
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-red-400">delete</span>
            삭제 → 제거, 복원 가능
          </span>
        </div>
      </header>

      <section className={`rounded-2xl border p-4 shadow-sm ${selectedItem ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">Move Target</p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {selectedItem ? `"${getOv(selectedItem.id).label || selectedItem.label}" 선택됨` : '이동할 메뉴를 먼저 클릭하세요.'}
            </p>
          </div>
          {selectedItem && (
            <button
              type="button"
              onClick={() => setSelectedItemId('')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base">close</span>
              선택 해제
            </button>
          )}
        </div>
      </section>

      {sections.map((section) => {
        const sectionOverride = getOv(section.id)
        const isSectionDeleted = !!sectionOverride.deleted
        if (isSectionDeleted && !showDeleted) return null

        return (
          <div
            key={section.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-opacity ${isSectionDeleted ? 'border-red-200 opacity-50' : 'border-slate-200'}`}
          >
            <div className={`flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 ${isSectionDeleted ? 'bg-red-50' : 'bg-slate-50'}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                  section.group === 'executive' ? 'bg-sky-100 text-sky-600' :
                  section.group === 'staff' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {section.group === 'executive' ? '경영진' : section.group === 'staff' ? '실무진' : '시스템'}
                </span>
                <EditableLabel
                  value={sectionOverride.label}
                  originalLabel={section.title}
                  onChange={(value) => setLabel(section.id, value)}
                  isBold={false}
                />
                {sectionOverride.hidden && <StatusBadge label="숨김" color="hidden" />}
                {sectionOverride.private && <StatusBadge label="비공개" color="private" />}
                {sectionOverride.deleted && <StatusBadge label="삭제됨" color="deleted" />}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => moveSection(section.id, -1)} title="카테고리 위로"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600">
                  <span className="material-symbols-outlined text-base">arrow_upward</span>
                </button>
                <button type="button" onClick={() => moveSection(section.id, 1)} title="카테고리 아래로"
                  className="mr-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600">
                  <span className="material-symbols-outlined text-base">arrow_downward</span>
                </button>
                {selectedItemId && !section.items.some((item) => item.id === selectedItemId) && (
                  <button
                    type="button"
                    onClick={() => moveSelectedItem(section.id)}
                    className="mr-2 inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 text-xs font-black text-sky-600 hover:bg-sky-50"
                  >
                    <span className="material-symbols-outlined text-sm">move_down</span>
                    여기로 이동
                  </button>
                )}
                <button type="button" onClick={() => toggleHidden(section.id)}
                  title={sectionOverride.hidden ? '표시' : '숨기기'}
                  className={`rounded-lg p-2 transition-colors ${sectionOverride.hidden ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{sectionOverride.hidden ? 'visibility' : 'visibility_off'}</span>
                </button>
                <button type="button" onClick={() => togglePrivate(section.id)}
                  title={sectionOverride.private ? '공개' : '비공개'}
                  className={`rounded-lg p-2 transition-colors ${sectionOverride.private ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{sectionOverride.private ? 'lock' : 'lock_open'}</span>
                </button>
                <button type="button" onClick={() => toggleDeleted(section.id)}
                  title={sectionOverride.deleted ? '복원' : '삭제'}
                  className={`rounded-lg p-2 transition-colors ${sectionOverride.deleted ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                  <span className="material-symbols-outlined text-base">{sectionOverride.deleted ? 'restore' : 'delete'}</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {section.items.map((item) => {
                const itemOverride = getOv(item.id)
                const isItemDeleted = !!itemOverride.deleted
                const isItemBold = !!itemOverride.bold
                if (isItemDeleted && !showDeleted) return null

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition-colors ${selectedItemId === item.id ? 'bg-sky-50 ring-1 ring-inset ring-sky-200' : isItemDeleted ? 'bg-red-50 opacity-60' : isItemBold ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="material-symbols-outlined shrink-0 text-base text-slate-400">{item.icon}</span>
                      <EditableLabel
                        value={itemOverride.label}
                        originalLabel={item.label}
                        onChange={(value) => setLabel(item.id, value)}
                        isBold={isItemBold}
                      />
                      {isItemBold && <StatusBadge label="굵게" color="bold" />}
                      {itemOverride.hidden && <StatusBadge label="숨김" color="hidden" />}
                      {itemOverride.private && <StatusBadge label="비공개" color="private" />}
                      {itemOverride.deleted && <StatusBadge label="삭제됨" color="deleted" />}
                      <span className="font-mono text-[10px] text-slate-300">{item.id}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => moveItemWithin(section.id, item.id, -1)} title="위로"
                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-sky-50 hover:text-sky-600">
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                      </button>
                      <button type="button" onClick={() => moveItemWithin(section.id, item.id, 1)} title="아래로"
                        className="mr-1 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-sky-50 hover:text-sky-600">
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => toggleBold(item.id)}
                        title={isItemBold ? '굵게 해제' : '굵게 표시'}
                        className={`rounded-lg p-1.5 transition-colors ${isItemBold ? 'bg-amber-100 text-amber-700' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500'}`}>
                        <span className="material-symbols-outlined text-sm">format_bold</span>
                      </button>
                      <button type="button" onClick={() => toggleHidden(item.id)}
                        title={itemOverride.hidden ? '표시' : '숨기기'}
                        className={`rounded-lg p-1.5 transition-colors ${itemOverride.hidden ? 'bg-slate-200 text-slate-700' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                        <span className="material-symbols-outlined text-sm">{itemOverride.hidden ? 'visibility' : 'visibility_off'}</span>
                      </button>
                      <button type="button" onClick={() => togglePrivate(item.id)}
                        title={itemOverride.private ? '공개' : '비공개'}
                        className={`rounded-lg p-1.5 transition-colors ${itemOverride.private ? 'bg-violet-100 text-violet-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                        <span className="material-symbols-outlined text-sm">{itemOverride.private ? 'lock' : 'lock_open'}</span>
                      </button>
                      <button type="button" onClick={() => toggleDeleted(item.id)}
                        title={itemOverride.deleted ? '복원' : '삭제'}
                        className={`rounded-lg p-1.5 transition-colors ${itemOverride.deleted ? 'bg-red-100 text-red-500' : 'text-slate-300 hover:bg-red-50 hover:text-red-400'}`}>
                        <span className="material-symbols-outlined text-sm">{itemOverride.deleted ? 'restore' : 'delete'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
