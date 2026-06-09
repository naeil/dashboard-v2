import { useEffect, useState } from 'react'
import { createInvite, deleteUser, getInvites, getUsers, resetUserPassword, updateMenuPermissions } from '../../api/authApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'

// 섹션별 개별 메뉴 항목 (새 Sidebar 구조와 일치)
const CONFIGURABLE_ITEMS = [
  {
    section: '운영 · 팀관리',
    items: [
      { id: 'work-management',      label: '업무 진행 관리' },
      { id: 'payment-approval',     label: '입출금 결재 관리' },
      { id: 'employee-performance', label: '직원 성과 분석' },
      { id: 'channel-credentials',  label: '채널 계정 관리' },
      { id: 'product-cost',         label: '제품 원가 관리' },
    ],
  },
  {
    section: '영업 지원',
    items: [
      { id: 'channel-operations', label: '채널 운영' },
      { id: 'inventory',          label: '재고 현황' },
      { id: 'product-movement',   label: '제품 출입고' },
      { id: 'partners',           label: '거래처 관리' },
    ],
  },
  {
    section: '마케팅팀',
    items: [
      { id: 'marketing-projects', label: '마케팅 프로젝트' },
      { id: 'ad-performance',     label: '광고 성과' },
      { id: 'marketing-agent',    label: '마케팅 에이전트' },
      { id: 'blog-auto-publish',  label: '블로그 자동 배포 AI' },
    ],
  },
  {
    section: '회계 · 영업팀',
    items: [
      { id: 'consulting-revenue', label: '컨설팅 매출' },
      { id: 'export-pipeline',    label: '수출 파이프라인' },
      { id: 'payroll',            label: '임금 지급 내역' },
    ],
  },
]

const roleLabels = {
  EMPLOYEE: '직원',
  MANAGER: '관리자',
  EXECUTIVE: '대표',
}

const statusLabels = {
  ACTIVE: '활성',
  INVITED: '초대',
  DISABLED: '비활성',
  LEFT: '퇴사',
  BLOCKED: '차단',
  PENDING: '초대 대기',
  ACCEPTED: '가입 완료',
  EXPIRED: '만료',
  CANCELLED: '취소',
}

const getInviteOrigin = () => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '')
  }
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://192.168.0.86:8081'
  }
  return window.location.origin
}

const buildInviteLink = (inviteCode) => `${getInviteOrigin()}/?invite=${encodeURIComponent(inviteCode)}`

function RolePill({ role }) {
  const className = role === 'EXECUTIVE'
    ? 'border-rose-400/30 bg-rose-400/15 text-rose-100'
    : role === 'MANAGER'
      ? 'border-amber-400/30 bg-amber-400/15 text-amber-100'
      : 'border-sky-400/30 bg-sky-400/15 text-sky-100'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{roleLabels[role] || role}</span>
}

function StatusPill({ status }) {
  const className = status === 'ACTIVE' || status === 'ACCEPTED'
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    : status === 'PENDING'
      ? 'border-amber-400/30 bg-amber-400/15 text-amber-100'
      : 'border-slate-500/30 bg-slate-500/15 text-slate-200'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{statusLabels[status] || status}</span>
}

function MenuPermissionModal({ user, onClose, onSaved }) {
  const parseExisting = (raw) => {
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }

  const existing = parseExisting(user.allowed_menu_sections)
  // 기존 섹션 타이틀 형식(구 버전)은 무시하고 새 항목 ID 형식만 사용
  const existingIds = Array.isArray(existing) && existing.some((v) => v.includes('-')) ? existing : null
  const [useCustom, setUseCustom] = useState(existingIds !== null)
  const [selected, setSelected] = useState(existingIds || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allIds = CONFIGURABLE_ITEMS.flatMap((g) => g.items.map((i) => i.id))

  const toggleItem = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  const toggleSection = (group) => {
    const ids = group.items.map((i) => i.id)
    const allChecked = ids.every((id) => selected.includes(id))
    setSelected((prev) =>
      allChecked ? prev.filter((s) => !ids.includes(s)) : [...new Set([...prev, ...ids])]
    )
  }

  const selectAll = () => setSelected(allIds)
  const clearAll  = () => setSelected([])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await updateMenuPermissions(user.id, useCustom ? selected : null)
      onSaved()
      onClose()
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message
      setError(msg ? `[${status}] ${msg}` : `저장 실패 (${status || err?.message || 'network error'})`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-sky-400">메뉴 권한 설정</p>
            <p className="mt-1 text-lg font-black text-white">{user.display_name || user.username}</p>
            <p className="text-xs font-bold text-slate-500">{user.department || ''} {user.position_name || ''}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 모드 선택 */}
        <div className="mb-4 flex gap-3">
          {[
            { val: false, title: '부서 기반 자동', desc: '소속 부서에 맞는 메뉴 자동 표시' },
            { val: true,  title: '개별 직접 설정', desc: '허용할 메뉴를 항목별로 지정' },
          ].map(({ val, title, desc }) => (
            <label
              key={String(val)}
              className={`flex flex-1 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${useCustom === val ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/10 hover:border-white/20'}`}
            >
              <input type="radio" name="mode" checked={useCustom === val} onChange={() => setUseCustom(val)} className="mt-0.5 accent-sky-400" />
              <div>
                <p className="text-sm font-black text-white">{title}</p>
                <p className="text-xs font-bold text-slate-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* 항목별 선택 */}
        {useCustom && (
          <div className="mb-4 rounded-xl border border-white/10 p-4">
            {/* 전체 선택/해제 */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black text-slate-400">허용할 메뉴 선택</span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs font-black text-sky-400 hover:text-sky-300">전체 선택</button>
                <span className="text-slate-600">·</span>
                <button type="button" onClick={clearAll}  className="text-xs font-black text-slate-400 hover:text-white">전체 해제</button>
              </div>
            </div>

            <div className="space-y-4">
              {CONFIGURABLE_ITEMS.map((group) => {
                const groupIds = group.items.map((i) => i.id)
                const checkedCount = groupIds.filter((id) => selected.includes(id)).length
                const allChecked = checkedCount === groupIds.length
                const someChecked = checkedCount > 0 && !allChecked

                return (
                  <div key={group.section}>
                    {/* 섹션 헤더 (전체 토글) */}
                    <label className="mb-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked }}
                        onChange={() => toggleSection(group)}
                        className="h-4 w-4 accent-sky-400"
                      />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{group.section}</span>
                      <span className="ml-auto text-xs font-bold text-slate-600">{checkedCount}/{groupIds.length}</span>
                    </label>

                    {/* 개별 항목 */}
                    <div className="ml-3 space-y-1 border-l border-white/10 pl-4">
                      {group.items.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={selected.includes(item.id)}
                            onChange={() => toggleItem(item.id)}
                            className="h-4 w-4 accent-sky-400"
                          />
                          <span className="text-sm font-bold text-white">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-3 text-xs font-bold text-slate-500">
              공통(업무홈·실시간매출·내업무입력·지출결의) · 시스템 섹션은 항상 표시됩니다.
            </p>
          </div>
        )}

        {error && <p className="mb-3 text-xs font-black text-rose-400">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-black text-slate-400 hover:text-white">
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmployeeManagementPage() {
  const [users, setUsers] = useState([])
  const [invites, setInvites] = useState([])
  const [message, setMessage] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [permissionUser, setPermissionUser] = useState(null)
  const [form, setForm] = useState({
    displayName: '',
    department: '',
    positionName: '',
    role: 'EMPLOYEE',
  })

  const load = async () => {
    const [userRes, inviteRes] = await Promise.all([getUsers(), getInvites()])
    setUsers(userRes.data || [])
    setInvites(inviteRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const copyInviteLink = async (inviteCode) => {
    const link = buildInviteLink(inviteCode)
    await navigator.clipboard?.writeText(link)
    setCopiedCode(inviteCode)
    setMessage(`초대 링크를 복사했습니다: ${link}`)
  }

  const submit = async (event) => {
    event.preventDefault()
    const response = await createInvite(form)
    const inviteCode = response.data.inviteCode
    setMessage(`초대 링크: ${buildInviteLink(inviteCode)}`)
    setForm({ displayName: '', department: '', positionName: '', role: 'EMPLOYEE' })
    await load()
  }

  const submitPasswordReset = async (event) => {
    event.preventDefault()
    if (!selectedUser) {
      setMessage('비밀번호를 초기화할 계정을 선택하세요.')
      return
    }
    setResetting(true)
    try {
      await resetUserPassword(selectedUser.id, { newPassword })
      setMessage(`${selectedUser.display_name || selectedUser.username} 계정 비밀번호를 변경했습니다.`)
      setNewPassword('')
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setResetting(false)
    }
  }

  const removeUser = async (user) => {
    const ok = window.confirm(`${user.display_name || user.username} 계정을 삭제 처리할까요? 삭제된 직원은 로그인할 수 없습니다.`)
    if (!ok) return
    try {
      await deleteUser(user.id)
      setMessage(`${user.display_name || user.username} 계정을 삭제 처리했습니다.`)
      if (selectedUser?.id === user.id) {
        setSelectedUser(null)
        setNewPassword('')
      }
      if (permissionUser?.id === user.id) {
        setPermissionUser(null)
      }
      await load()
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '직원 삭제 처리에 실패했습니다.')
    }
  }

  return (
    <>
      {permissionUser && (
        <MenuPermissionModal
          user={permissionUser}
          onClose={() => setPermissionUser(null)}
          onSaved={load}
        />
      )}
      <PageHeader title="직원 관리" description="직원 초대 링크를 만들고 가입 상태와 권한을 확인합니다." />

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <Panel title="직원 초대 생성" right={message ? <span className="max-w-xl truncate text-xs font-black text-emerald-300">{message}</span> : null}>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">직원 이름</span>
              <input required value={form.displayName} onChange={(event) => setValue('displayName', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">소속</span>
              <input value={form.department} onChange={(event) => setValue('department', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">직무</span>
              <input value={form.positionName} onChange={(event) => setValue('positionName', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-slate-400">권한</span>
              <select value={form.role} onChange={(event) => setValue('role', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400">
                <option value="EMPLOYEE">직원</option>
                <option value="MANAGER">관리자</option>
                <option value="EXECUTIVE">대표</option>
              </select>
            </label>
            <button type="submit" className="h-11 w-full rounded-lg bg-sky-400 px-6 text-sm font-black text-slate-950 hover:bg-sky-300">
              초대 링크 생성
            </button>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs font-bold leading-5 text-slate-400">
              생성된 링크를 직원에게 전달하세요. 링크가 localhost로 시작하면 같은 PC에서만 열립니다. 직원에게 보내려면 회사 내부 서버 IP나 도메인으로 접속한 뒤 링크를 생성해야 합니다.
            </p>
          </form>
        </Panel>

        <Panel title="직원 계정">
          <DataTable
            rows={users}
            rowKey={(row) => row.id}
            columns={[
              { key: 'display_name', label: '이름', render: (row) => <span className="font-black text-white">{row.display_name}</span> },
              { key: 'username', label: '아이디' },
              { key: 'department', label: '소속', render: (row) => row.department || '-' },
              { key: 'position_name', label: '직무', render: (row) => row.position_name || '-' },
              { key: 'role', label: '권한', render: (row) => <RolePill role={row.role} /> },
              { key: 'status', label: '상태', render: (row) => <StatusPill status={row.status} /> },
              {
                key: 'actions',
                label: '관리',
                searchable: false,
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(row)
                        setNewPassword('')
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-400/30 px-2 text-xs font-black text-sky-100 transition-colors hover:bg-sky-400/10"
                    >
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      비밀번호 초기화
                    </button>
                    {row.role !== 'EXECUTIVE' && (
                      <button
                        type="button"
                        onClick={() => setPermissionUser(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-400/30 px-2 text-xs font-black text-violet-200 transition-colors hover:bg-violet-400/10"
                      >
                        <span className="material-symbols-outlined text-sm">tune</span>
                        메뉴 권한
                      </button>
                    )}
                    {row.role !== 'EXECUTIVE' && row.status !== 'LEFT' && (
                      <button
                        type="button"
                        onClick={() => removeUser(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-400/30 px-2 text-xs font-black text-rose-200 transition-colors hover:bg-rose-400/10"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        삭제
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      </section>

      <Panel
        title="계정 비밀번호 초기화"
        right={selectedUser ? <span className="text-xs font-black text-sky-200">{selectedUser.display_name || selectedUser.username} 선택됨</span> : null}
      >
        <form onSubmit={submitPasswordReset} className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_260px_140px]">
          <div className="rounded-lg border border-white/10 bg-slate-950 px-4 py-3">
            <p className="text-xs font-bold text-slate-500">선택 계정</p>
            <p className="mt-1 text-sm font-black text-white">
              {selectedUser ? `${selectedUser.display_name || '-'} / ${selectedUser.username}` : '직원 계정 표에서 초기화할 계정을 선택하세요.'}
            </p>
          </div>
          <label>
            <span className="mb-1 block text-xs font-bold text-slate-400">새 비밀번호</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              placeholder="8자 이상"
              className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!selectedUser || newPassword.length < 8 || resetting}
              className="h-11 w-full rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {resetting ? '변경 중' : '변경'}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="초대 링크 현황">
        <DataTable
          rows={invites}
          rowKey={(row) => row.id}
          columns={[
            { key: 'invite_code', label: '초대 코드', render: (row) => <span className="font-black text-sky-100">{row.invite_code}</span> },
            {
              key: 'invite_link',
              label: '가입 링크',
              searchable: false,
              render: (row) => (
                <button
                  type="button"
                  onClick={() => copyInviteLink(row.invite_code)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-400/30 px-2 text-xs font-black text-sky-100 transition-colors hover:bg-sky-400/10"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  {copiedCode === row.invite_code ? '복사됨' : '링크 복사'}
                </button>
              ),
            },
            { key: 'display_name', label: '이름' },
            { key: 'department', label: '소속', render: (row) => row.department || '-' },
            { key: 'position_name', label: '직무', render: (row) => row.position_name || '-' },
            { key: 'role', label: '권한', render: (row) => <RolePill role={row.role} /> },
            { key: 'status', label: '상태', render: (row) => <StatusPill status={row.status} /> },
            { key: 'expires_at', label: '만료일', render: (row) => row.expires_at ? String(row.expires_at).slice(0, 10) : '-' },
          ]}
        />
      </Panel>
    </>
  )
}
