import { useEffect, useMemo, useState } from 'react'
import {
  createInvite,
  deleteInvite,
  deleteUser,
  getInvites,
  getPositionPermissionTemplates,
  getUsers,
  resetUserPassword,
  updateMenuPermissions,
} from '../../api/authApi'
import { defaultMenuSections } from '../../components/Sidebar'
import {
  DEFAULT_FEATURE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  getAllowedMenus,
  isFeatureAllowed,
  parseAccessPermissions,
  serializeAccessPermissions,
} from '../../utils/accessPermissions'
import { getPositionTitleOptions } from '../../utils/positionTitles'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'

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

const featurePermissionItems = [
  { id: FEATURE_PERMISSIONS.CREATE_INVITE, icon: 'person_add', label: '직원 초대', description: '직원 초대 링크를 생성할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.RESET_PASSWORD, icon: 'lock_reset', label: '비밀번호 초기화', description: '다른 직원의 비밀번호를 초기화할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.MANAGE_PERMISSIONS, icon: 'tune', label: '권한 관리', description: '메뉴 접근과 기능 권한을 조정할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.DELETE_USERS, icon: 'person_remove', label: '직원 비활성화', description: '직원 계정을 퇴사 처리할 수 있습니다.' },
]

const menuSections = defaultMenuSections.map((section) => ({
  id: section.id,
  title: section.title,
  items: section.items.map((item) => ({ id: item.id, icon: item.icon, label: item.label })),
}))
const allMenuIds = menuSections.flatMap((section) => section.items.map((item) => item.id))

function getInviteOrigin() {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '')
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'http://192.168.0.86:8081'
  return window.location.origin
}

const buildInviteLink = (inviteCode) => `${getInviteOrigin()}/?invite=${encodeURIComponent(inviteCode)}`

function RolePill({ role }) {
  const className = role === 'EXECUTIVE'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : role === 'MANAGER'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-sky-200 bg-sky-50 text-sky-700'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{roleLabels[role] || role}</span>
}

function StatusPill({ status }) {
  const className = status === 'ACTIVE' || status === 'ACCEPTED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'PENDING'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{statusLabels[status] || status}</span>
}

function InviteEmployeeDrawer({ open, onClose, onCreated, positionOptions }) {
  const [form, setForm] = useState({
    displayName: '',
    department: '',
    positionName: '',
    role: 'EMPLOYEE',
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async (event, keepOpen = false) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await createInvite(form)
      const inviteCode = response.data.inviteCode
      setMessage(`초대 링크: ${buildInviteLink(inviteCode)}`)
      setForm({ displayName: '', department: '', positionName: '', role: 'EMPLOYEE' })
      await onCreated()
      if (!keepOpen) onClose()
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '초대 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/55" onClick={onClose}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-8 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-950">직원 초대</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">새 직원을 초대하고 기본 직급 및 접근 권한을 지정하세요.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form className="grid gap-7 lg:grid-cols-[1fr_320px]" onSubmit={submit}>
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">이름 *</span>
              <input required value={form.displayName} onChange={(event) => setValue('displayName', event.target.value)} placeholder="예) 홍길동" className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">소속 팀 *</span>
              <input required value={form.department} onChange={(event) => setValue('department', event.target.value)} placeholder="팀을 입력하세요" className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">직급 *</span>
              <select required value={form.positionName} onChange={(event) => setValue('positionName', event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm font-black outline-none focus:border-sky-400">
                <option value="">직급을 선택하세요</option>
                {positionOptions.map((position) => <option key={position} value={position}>{position}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">연락처 (선택)</span>
              <input placeholder="예) 010-1234-5678" className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
          </div>

          <div className="space-y-5 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div>
              <p className="mb-3 text-sm font-black text-slate-800">기본 권한 템플릿</p>
              <div className="space-y-3">
                {[
                  ['EMPLOYEE', '일반 직원', '업무에 필요한 기본 메뉴에 접근할 수 있습니다.'],
                  ['MANAGER', '팀 리더', '팀 관리 및 구성원 관리 권한을 포함합니다.'],
                ].map(([role, label, description]) => (
                  <label key={role} className={`block cursor-pointer rounded-lg border p-4 ${form.role === role ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="role" checked={form.role === role} onChange={() => setValue('role', role)} className="mt-1 h-4 w-4 accent-sky-500" />
                      <span>
                        <span className="block text-sm font-black text-slate-900">{label}</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-black text-slate-800">접근 가능 메뉴</p>
              <div className="flex flex-wrap gap-2">
                {['대시보드', '업무보고', '조직/팀 관리 (읽기)', '공지사항', '내 정보'].map((item) => (
                  <span key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">{item}</span>
                ))}
              </div>
            </div>
          </div>

          {message && <p className="lg:col-span-2 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700">{message}</p>}

          <div className="lg:col-span-2 mt-4 flex gap-3 border-t border-slate-200 pt-5">
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-lg border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50">취소</button>
            <button type="submit" disabled={saving} className="h-12 flex-1 rounded-lg bg-sky-500 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200">초대 저장</button>
            <button type="button" onClick={(event) => submit(event, true)} disabled={saving} className="h-12 flex-1 rounded-lg border border-sky-200 text-sm font-black text-sky-600 hover:bg-sky-50 disabled:text-slate-300">초대 후 계속 추가</button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function MenuPermissionModal({ user, onClose, onSaved }) {
  const access = parseAccessPermissions(user.allowed_menu_sections)
  const [selectedMenus, setSelectedMenus] = useState(getAllowedMenus(access) || allMenuIds)
  const [features, setFeatures] = useState(access.features?.length ? access.features : DEFAULT_FEATURE_PERMISSIONS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleMenu = (id) => setSelectedMenus((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  const toggleFeature = (id) => setFeatures((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  const toggleSection = (section) => {
    const ids = section.items.map((item) => item.id)
    const allChecked = ids.every((id) => selectedMenus.includes(id))
    setSelectedMenus((prev) => allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await updateMenuPermissions(user.id, serializeAccessPermissions({ menus: selectedMenus, features }))
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '권한 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-sky-600">메뉴 권한 설정</p>
            <p className="mt-1 text-xl font-black text-slate-950">{user.display_name || user.username}</p>
            <p className="text-sm font-bold text-slate-500">{user.department || ''} {user.position_name || ''}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {featurePermissionItems.map((permission) => {
            const checked = features.includes(permission.id)
            return (
            <button key={permission.id} type="button" role="switch" aria-checked={checked} onClick={() => toggleFeature(permission.id)} className={`rounded-lg border p-4 text-left transition-colors ${checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                  <span className="material-symbols-outlined text-sky-600">{permission.icon}</span>
                  {permission.label}
                </span>
                <span className={`relative h-[22px] w-10 rounded-full p-[3px] transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">{permission.description}</p>
            </button>
            )
          })}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">메뉴 접근 설정</h3>
          <div className="flex gap-3 text-xs font-black">
            <button type="button" onClick={() => setSelectedMenus(allMenuIds)} className="text-sky-600">전체 선택</button>
            <button type="button" onClick={() => setSelectedMenus([])} className="text-slate-500">전체 해제</button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          {menuSections.map((section) => {
            const sectionIds = section.items.map((item) => item.id)
            const checkedCount = sectionIds.filter((id) => selectedMenus.includes(id)).length
            const checked = checkedCount === sectionIds.length
            return (
              <div key={section.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <label className="mb-2 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={() => toggleSection(section)} className="h-4 w-4 accent-sky-500" />
                  <span className="text-sm font-black text-slate-700">{section.title}</span>
                  <span className="ml-auto text-xs font-bold text-slate-400">{checkedCount}/{sectionIds.length}</span>
                </label>
                <div className="grid gap-2 md:grid-cols-2">
                  {section.items.map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 hover:bg-sky-50">
                      <input type="checkbox" checked={selectedMenus.includes(item.id)} onChange={() => toggleMenu(item.id)} className="h-4 w-4 accent-sky-500" />
                      <span className="material-symbols-outlined text-base text-slate-400">{item.icon}</span>
                      <span className="text-sm font-bold text-slate-800">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {error && <p className="mt-4 text-sm font-black text-rose-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-lg border border-slate-200 text-sm font-black text-slate-600">취소</button>
          <button type="button" onClick={save} disabled={saving} className="h-11 flex-1 rounded-lg bg-sky-500 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmployeeManagementPage({ accessPermissions, embedded = false }) {
  const parsedAccess = parseAccessPermissions(accessPermissions)
  const canCreateInvite = isFeatureAllowed(parsedAccess, FEATURE_PERMISSIONS.CREATE_INVITE)
  const canResetPassword = isFeatureAllowed(parsedAccess, FEATURE_PERMISSIONS.RESET_PASSWORD)
  const canManagePermissions = isFeatureAllowed(parsedAccess, FEATURE_PERMISSIONS.MANAGE_PERMISSIONS)
  const canDeleteUsers = isFeatureAllowed(parsedAccess, FEATURE_PERMISSIONS.DELETE_USERS)
  const [users, setUsers] = useState([])
  const [invites, setInvites] = useState([])
  const [message, setMessage] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [permissionUser, setPermissionUser] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [permissionTemplates, setPermissionTemplates] = useState([])
  const [deletingInviteId, setDeletingInviteId] = useState(null)

  const templatePositionRows = useMemo(
    () => permissionTemplates.map((template) => ({ position_name: template.position_name || template.positionName })),
    [permissionTemplates],
  )
  const positionOptions = useMemo(() => getPositionTitleOptions(users, [...invites, ...templatePositionRows]), [users, invites, templatePositionRows])

  const load = async () => {
    const [userRes, inviteRes, templateRes] = await Promise.all([
      getUsers(),
      getInvites(),
      getPositionPermissionTemplates(),
    ])
    setUsers(userRes.data || [])
    setInvites(inviteRes.data || [])
    setPermissionTemplates(templateRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const copyInviteLink = async (inviteCode) => {
    const link = buildInviteLink(inviteCode)
    await navigator.clipboard?.writeText(link)
    setCopiedCode(inviteCode)
    setMessage(`초대 링크를 복사했습니다: ${link}`)
  }

  const removeInvite = async (invite) => {
    if (invite.status === 'ACCEPTED') {
      setMessage('이미 가입 완료된 초대는 삭제할 수 없습니다.')
      return
    }

    const ok = window.confirm(`${invite.display_name || '초대'} 초대 링크를 삭제할까요?`)
    if (!ok) return

    setDeletingInviteId(invite.id)
    try {
      await deleteInvite(invite.id)
      setMessage(`${invite.display_name || '초대'} 초대 링크를 삭제했습니다.`)
      if (copiedCode === invite.invite_code) setCopiedCode('')
      await load()
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '초대 링크 삭제에 실패했습니다.')
    } finally {
      setDeletingInviteId(null)
    }
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
    const ok = window.confirm(`${user.display_name || user.username} 계정을 퇴사 처리할까요?`)
    if (!ok) return
    try {
      await deleteUser(user.id)
      setMessage(`${user.display_name || user.username} 계정을 퇴사 처리했습니다.`)
      if (selectedUser?.id === user.id) setSelectedUser(null)
      if (permissionUser?.id === user.id) setPermissionUser(null)
      await load()
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '직원 비활성화에 실패했습니다.')
    }
  }

  const inviteButton = canCreateInvite ? (
    <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-600">
      <span className="material-symbols-outlined text-lg">person_add</span>
      직원 초대
    </button>
  ) : null

  return (
    <>
      <InviteEmployeeDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} onCreated={load} positionOptions={positionOptions} />
      {permissionUser && <MenuPermissionModal user={permissionUser} onClose={() => setPermissionUser(null)} onSaved={load} />}

      {!embedded && (
        <PageHeader
          title="직원 관리"
          description="직원 초대, 계정 상태, 직급, 비밀번호 초기화 및 메뉴 접근 현황을 관리할 수 있습니다."
        />
      )}

      {message && <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700">{message}</div>}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Panel title="전체 직원"><p className="text-3xl font-black text-slate-950">{users.length}명</p></Panel>
        <Panel title="활성 직원"><p className="text-3xl font-black text-slate-950">{users.filter((user) => user.status === 'ACTIVE').length}명</p></Panel>
        <Panel title="초대 대기"><p className="text-3xl font-black text-slate-950">{invites.filter((invite) => invite.status === 'PENDING').length}건</p></Panel>
        <Panel title="관리자 권한"><p className="text-3xl font-black text-slate-950">{users.filter((user) => user.role === 'MANAGER' || user.role === 'EXECUTIVE').length}명</p></Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="직원 목록" right={inviteButton}>
          <DataTable
            rows={users}
            rowKey={(row) => row.id}
            columns={[
              { key: 'display_name', label: '이름', render: (row) => <span className="font-black text-slate-950">{row.display_name}</span> },
              { key: 'username', label: '아이디' },
              { key: 'department', label: '팀', render: (row) => row.department || '-' },
              { key: 'position_name', label: '직급', render: (row) => row.position_name || '-' },
              { key: 'role', label: '계정 유형', render: (row) => <RolePill role={row.role} /> },
              { key: 'status', label: '상태', render: (row) => <StatusPill status={row.status} /> },
              {
                key: 'actions',
                label: '관리',
                searchable: false,
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    {canResetPassword && (
                      <button type="button" onClick={() => { setSelectedUser(row); setNewPassword('') }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 px-2 text-xs font-black text-sky-600 hover:bg-sky-50">
                        <span className="material-symbols-outlined text-sm">lock_reset</span>
                        초기화
                      </button>
                    )}
                    {canManagePermissions && row.role !== 'EXECUTIVE' && (
                      <button type="button" onClick={() => setPermissionUser(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 px-2 text-xs font-black text-violet-600 hover:bg-violet-50">
                        <span className="material-symbols-outlined text-sm">tune</span>
                        권한
                      </button>
                    )}
                    {canDeleteUsers && row.role !== 'EXECUTIVE' && row.status !== 'LEFT' && (
                      <button type="button" onClick={() => removeUser(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-600 hover:bg-rose-50">
                        <span className="material-symbols-outlined text-sm">person_remove</span>
                        비활성화
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <div className="space-y-6">
          <Panel title="비밀번호 초기화">
            <form onSubmit={submitPasswordReset} className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-slate-500">선택 계정</p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {selectedUser ? `${selectedUser.display_name || '-'} / ${selectedUser.username}` : '직원 목록에서 계정을 선택하세요.'}
                </p>
              </div>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} placeholder="새 비밀번호 8자 이상" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
              <button type="submit" disabled={!canResetPassword || !selectedUser || newPassword.length < 8 || resetting} className="h-11 w-full rounded-lg bg-sky-500 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400">
                {resetting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </Panel>

          <Panel title="초대 링크 현황">
            <div className="space-y-3">
              {invites.slice(0, 6).map((invite) => (
                <div key={invite.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{invite.display_name}</p>
                      <p className="text-xs font-bold text-slate-500">{invite.department || '-'} · {invite.position_name || '-'}</p>
                    </div>
                    <StatusPill status={invite.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyInviteLink(invite.invite_code)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 px-2 text-xs font-black text-sky-600 hover:bg-sky-50">
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      {copiedCode === invite.invite_code ? '복사됨' : '링크 복사'}
                    </button>
                    {canCreateInvite && invite.status !== 'ACCEPTED' && (
                      <button
                        type="button"
                        onClick={() => removeInvite(invite)}
                        disabled={deletingInviteId === invite.id}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:border-slate-200 disabled:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        {deletingInviteId === invite.id ? '삭제 중' : '삭제'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {invites.length === 0 && <p className="text-sm font-bold text-slate-400">초대 내역이 없습니다.</p>}
            </div>
          </Panel>
        </div>
      </section>
    </>
  )
}
