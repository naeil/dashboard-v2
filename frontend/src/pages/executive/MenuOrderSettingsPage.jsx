import { useMemo, useState } from 'react'
import {
  defaultMenuSections,
  getOrderedMenuSections,
  SIDEBAR_MENU_ORDER_KEY,
} from '../../components/Sidebar'

function toEditableSections() {
  return getOrderedMenuSections().map((section) => ({
    id: section.id,
    title: section.title,
    group: section.group,
    items: section.items.map((item) => ({
      id: item.id,
      icon: item.icon,
      label: item.label,
      roles: item.roles,
    })),
  }))
}

function moveItem(list, index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list
  const next = [...list]
  const temp = next[index]
  next[index] = next[nextIndex]
  next[nextIndex] = temp
  return next
}

function saveMenuOrder(sections) {
  const payload = {
    sections: sections.map((section) => section.id),
    items: Object.fromEntries(sections.map((section) => [
      section.id,
      section.items.map((item) => item.id),
    ])),
  }
  localStorage.setItem(SIDEBAR_MENU_ORDER_KEY, JSON.stringify(payload))
  window.dispatchEvent(new Event('sidebar:menu-order-updated'))
}

const groupLabels = {
  executive: '경영진',
  staff: '실무진',
  system: '시스템',
}

export default function MenuOrderSettingsPage() {
  const [sections, setSections] = useState(toEditableSections)
  const [savedAt, setSavedAt] = useState('')
  const [dragging, setDragging] = useState(null)

  const defaultCount = useMemo(
    () => defaultMenuSections.reduce((sum, section) => sum + section.items.length, 0),
    [],
  )

  const moveSection = (index, direction) => {
    setSections((prev) => moveItem(prev, index, direction))
  }

  const moveMenu = (sectionId, index, direction) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section
      return { ...section, items: moveItem(section.items, index, direction) }
    }))
  }

  const dropSection = (targetSectionId) => {
    if (dragging?.type !== 'section' || dragging.sectionId === targetSectionId) return
    setSections((prev) => {
      const fromIndex = prev.findIndex((section) => section.id === dragging.sectionId)
      const toIndex = prev.findIndex((section) => section.id === targetSectionId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setDragging(null)
  }

  const dropMenu = (targetSectionId, targetIndex = null) => {
    if (dragging?.type !== 'menu') return
    setSections((prev) => {
      const movedItem = prev
        .find((section) => section.id === dragging.sectionId)
        ?.items.find((item) => item.id === dragging.itemId)
      if (!movedItem) return prev

      return prev.map((section) => {
        const withoutDragged = section.items.filter((item) => item.id !== dragging.itemId)
        if (section.id !== targetSectionId) {
          return { ...section, items: withoutDragged }
        }

        const insertIndex = targetIndex == null
          ? withoutDragged.length
          : Math.max(0, Math.min(targetIndex, withoutDragged.length))
        const nextItems = [...withoutDragged]
        nextItems.splice(insertIndex, 0, movedItem)
        return { ...section, items: nextItems }
      })
    })
    setDragging(null)
  }

  const handleSave = () => {
    saveMenuOrder(sections)
    const now = new Date()
    setSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 저장됨`)
  }

  const handleReset = () => {
    localStorage.removeItem(SIDEBAR_MENU_ORDER_KEY)
    window.dispatchEvent(new Event('sidebar:menu-order-updated'))
    setSections(defaultMenuSections.map((section) => ({
      id: section.id,
      title: section.title,
      group: section.group,
      items: section.items.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: item.label,
        roles: item.roles,
      })),
    })))
    setSavedAt('기본 순서로 복원됨')
    setDragging(null)
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Admin Menu Control</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">카테고리 이동 설정</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              대표 관리자 계정에서 사이드바 카테고리와 메뉴 순서를 직접 조정합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-xs font-black text-emerald-600">{savedAt}</span>}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              기본값
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-black text-white shadow-sm hover:bg-sky-500"
            >
              <span className="material-symbols-outlined text-base">save</span>
              순서 저장
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">카테고리 순서</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            카테고리를 마우스로 끌어 순서를 바꿀 수 있습니다.
          </p>
          <div className="mt-4 space-y-2">
            {sections.map((section, index) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => setDragging({ type: 'section', sectionId: section.id })}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropSection(section.id)}
                className={`cursor-grab rounded-xl border p-3 active:cursor-grabbing ${
                  dragging?.type === 'section' && dragging.sectionId === section.id
                    ? 'border-sky-300 bg-sky-50 opacity-70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="material-symbols-outlined text-base text-slate-400">drag_indicator</span>
                    <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{section.title}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                      {groupLabels[section.group] || section.group} · {section.items.length}개 메뉴
                    </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => moveSection(index, -1)}
                      disabled={index === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                      title="위로 이동"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, 1)}
                      disabled={index === sections.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                      title="아래로 이동"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">메뉴 순서</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  메뉴를 마우스로 끌어 같은 카테고리 안에서 정렬하거나 다른 카테고리로 이동할 수 있습니다.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                기본 메뉴 {defaultCount}개
              </span>
            </div>
          </div>

          {sections.map((section) => (
            <section
              key={section.id}
              onDragOver={(event) => {
                if (dragging?.type === 'menu') event.preventDefault()
              }}
              onDrop={() => dropMenu(section.id)}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                dragging?.type === 'menu' ? 'border-sky-200 ring-1 ring-sky-100' : 'border-slate-200'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{groupLabels[section.group] || section.group}</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{section.title}</h3>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                  {section.items.length}개
                </span>
              </div>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {section.items.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragging({ type: 'menu', sectionId: section.id, itemId: item.id })}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(event) => {
                      if (dragging?.type === 'menu') event.preventDefault()
                    }}
                    onDrop={(event) => {
                      event.stopPropagation()
                      dropMenu(section.id, index)
                    }}
                    className={`flex cursor-grab items-center gap-3 px-4 py-3 active:cursor-grabbing ${
                      dragging?.type === 'menu' && dragging.itemId === item.id
                        ? 'bg-sky-50 opacity-70'
                        : 'bg-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base text-slate-300">drag_indicator</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400">{item.id}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveMenu(section.id, index, -1)}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="위로 이동"
                      >
                        <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMenu(section.id, index, 1)}
                        disabled={index === section.items.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="아래로 이동"
                      >
                        <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                      </button>
                    </div>
                  </div>
                ))}
                {section.items.length === 0 && (
                  <div className="bg-slate-50 px-4 py-8 text-center text-sm font-black text-slate-400">
                    메뉴를 이 카테고리로 끌어오세요.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
