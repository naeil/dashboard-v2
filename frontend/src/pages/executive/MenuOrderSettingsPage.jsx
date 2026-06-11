import { useEffect, useState } from 'react'
import { defaultMenuSections } from '../../components/Sidebar'
import { getMenuConfig, saveMenuConfig } from '../../api/settingsApi'

// ── 상태 배지 ─────────────────────────────────────────────────────

function StatusBadge({ label, color }) {
  const colors = {
    hidden:  'bg-slate-100 text-slate-500',
    private: 'bg-violet-100 text-violet-600',
    deleted: 'bg-red-100 text-red-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${colors[color] || 'bg-slate-100 text-slate-500'}`}>
      {label}
    </span>
  )
}

// ── 인라인 이름 편집 ──────────────────────────────────────────────

function EditableLabel({ value, originalLabel, onChange }) {
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value || originalLabel); setEditing(true) }}
      className="group flex items-center gap-1 text-left"
      title="클릭해서 이름 수정"
    >
      <span className={`text-sm font-bold ${value && value !== originalLabel ? 'text-sky-600' : 'text-slate-800'}`}>
        {value || originalLabel}
      </span>
      {value && value !== originalLabel && (
        <span className="text-[10px] text-slate-400 line-through">{originalLabel}</span>
      )}
      <span className="material-symbols-outlined text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">edit</span>
    </button>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────

export default function MenuOrderSettingsPage() {
  // overrides: { [id]: { label, hidden, private, deleted } }
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    getMenuConfig()
      .then((res) => setOverrides(res.data?.overrides || {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  function setLabel(id, label) {
    setOv(id, { label: label || null })
  }

  async function handleSave() {
    // 빈 오버라이드 정리
    const clean = Object.fromEntries(
      Object.entries(overrides).filter(([, v]) =>
        v.label || v.hidden || v.private || v.deleted
      )
    )
    await saveMenuConfig({ overrides: clean })
    // 사이드바에 변경 알림
    localStorage.setItem('menu_config_overrides', JSON.stringify(clean))
    window.dispatchEvent(new Event('sidebar:menu-config-updated'))
    const now = new Date()
    setSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 저장됨`)
  }

  function handleReset() {
    setOverrides({})
    localStorage.removeItem('menu_config_overrides')
    window.dispatchEvent(new Event('sidebar:menu-config-updated'))
    setSavedAt('기본값으로 복원됨')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-sky-400">progress_activity</span>
      </div>
    )
  }

  const allSections = defaultMenuSections

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Admin Menu Control</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">카테고리 관리</h1>
            <p className="mt-1 text-sm text-slate-500 font-bold">
              이름 수정 · 숨기기 · 비공개 · 삭제. 저장하면 전체 직원에게 즉시 반영됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-xs font-black text-emerald-600">{savedAt}</span>}
            <button
              type="button"
              onClick={() => setShowDeleted((v) => !v)}
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

        {/* 범례 */}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">edit</span>
            이름 클릭 → 수정
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">visibility_off</span>
            숨기기 — 사이드바에서 안 보임
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-violet-400">lock</span>
            비공개 — 대표/임원만 보임
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-red-400">delete</span>
            삭제 — 완전히 제거 (복원 가능)
          </span>
        </div>
      </header>

      {/* 섹션별 카드 */}
      {allSections.map((section) => {
        const sOv = getOv(section.id)
        const isSectionDeleted = !!sOv.deleted
        if (isSectionDeleted && !showDeleted) return null

        return (
          <div key={section.id}
            className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-opacity ${isSectionDeleted ? 'opacity-50 border-red-200' : 'border-slate-200'}`}
          >
            {/* 섹션 헤더 */}
            <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${isSectionDeleted ? 'bg-red-50' : 'bg-slate-50'} border-b border-slate-200`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  section.group === 'executive' ? 'bg-sky-100 text-sky-600' :
                  section.group === 'staff' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {section.group === 'executive' ? '경영진' : section.group === 'staff' ? '실무진' : '시스템'}
                </span>
                <EditableLabel
                  value={sOv.label}
                  originalLabel={section.title}
                  onChange={(v) => setLabel(section.id, v)}
                />
                {sOv.hidden  && <StatusBadge label="숨김"   color="hidden" />}
                {sOv.private && <StatusBadge label="비공개" color="private" />}
                {sOv.deleted && <StatusBadge label="삭제됨" color="deleted" />}
              </div>

              {/* 섹션 액션 버튼 */}
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => toggleHidden(section.id)}
                  title={sOv.hidden ? '표시' : '숨기기'}
                  className={`rounded-lg p-2 transition-colors ${sOv.hidden ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{sOv.hidden ? 'visibility' : 'visibility_off'}</span>
                </button>
                <button type="button" onClick={() => togglePrivate(section.id)}
                  title={sOv.private ? '공개' : '비공개'}
                  className={`rounded-lg p-2 transition-colors ${sOv.private ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{sOv.private ? 'lock' : 'lock_open'}</span>
                </button>
                <button type="button" onClick={() => toggleDeleted(section.id)}
                  title={sOv.deleted ? '복원' : '삭제'}
                  className={`rounded-lg p-2 transition-colors ${sOv.deleted ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                  <span className="material-symbols-outlined text-base">{sOv.deleted ? 'restore' : 'delete'}</span>
                </button>
              </div>
            </div>

            {/* 메뉴 아이템 목록 */}
            <div className="divide-y divide-slate-100">
              {section.items.map((item) => {
                const iOv = getOv(item.id)
                const isItemDeleted = !!iOv.deleted
                if (isItemDeleted && !showDeleted) return null

                return (
                  <div key={item.id}
                    className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${isItemDeleted ? 'bg-red-50 opacity-60' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-base text-slate-400 shrink-0">{item.icon}</span>
                      <EditableLabel
                        value={iOv.label}
                        originalLabel={item.label}
                        onChange={(v) => setLabel(item.id, v)}
                      />
                      {iOv.hidden  && <StatusBadge label="숨김"   color="hidden" />}
                      {iOv.private && <StatusBadge label="비공개" color="private" />}
                      {iOv.deleted && <StatusBadge label="삭제됨" color="deleted" />}
                      <span className="text-[10px] text-slate-300 font-mono">{item.id}</span>
                    </div>

                    {/* 아이템 액션 버튼 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => toggleHidden(item.id)}
                        title={iOv.hidden ? '표시' : '숨기기'}
                        className={`rounded-lg p-1.5 transition-colors ${iOv.hidden ? 'bg-slate-200 text-slate-700' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                        <span className="material-symbols-outlined text-sm">{iOv.hidden ? 'visibility' : 'visibility_off'}</span>
                      </button>
                      <button type="button" onClick={() => togglePrivate(item.id)}
                        title={iOv.private ? '공개' : '비공개'}
                        className={`rounded-lg p-1.5 transition-colors ${iOv.private ? 'bg-violet-100 text-violet-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                        <span className="material-symbols-outlined text-sm">{iOv.private ? 'lock' : 'lock_open'}</span>
                      </button>
                      <button type="button" onClick={() => toggleDeleted(item.id)}
                        title={iOv.deleted ? '복원' : '삭제'}
                        className={`rounded-lg p-1.5 transition-colors ${iOv.deleted ? 'bg-red-100 text-red-500' : 'text-slate-300 hover:bg-red-50 hover:text-red-400'}`}>
                        <span className="material-symbols-outlined text-sm">{iOv.deleted ? 'restore' : 'delete'}</span>
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
