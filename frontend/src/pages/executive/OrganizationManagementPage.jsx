import { useEffect, useMemo, useState } from 'react'
import {
  getInvites,
  getPositionPermissionTemplates,
  getUsers,
  savePositionPermissionTemplate,
} from '../../api/authApi'
import { defaultMenuSections } from '../../components/Sidebar'
import {
  DEFAULT_FEATURE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  getAllowedMenus,
  parseAccessPermissions,
  serializeAccessPermissions,
} from '../../utils/accessPermissions'
import { getPositionTitleOptions, normalizePositionTitle } from '../../utils/positionTitles'
import EmployeeManagementPage from './EmployeeManagementPage'
import { PageHeader, Panel } from './ExecutiveComponents'

const TEAM_STORAGE_KEY = 'organization_team_drafts_v1'

const tabs = [
  { id: 'overview', label: '조직 개요' },
  { id: 'employees', label: '직원 관리' },
  { id: 'teams', label: '조직/팀 관리' },
  { id: 'roles', label: '직급/권한 관리' },
]

const featurePermissionItems = [
  { id: FEATURE_PERMISSIONS.CREATE_INVITE, label: '직원 초대', description: '직원 초대 링크를 생성할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.RESET_PASSWORD, label: '비밀번호 초기화', description: '다른 직원의 비밀번호를 초기화할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.MANAGE_PERMISSIONS, label: '권한 관리', description: '메뉴 접근과 기능 권한을 조정할 수 있습니다.' },
  { id: FEATURE_PERMISSIONS.DELETE_USERS, label: '직원 비활성화', description: '직원 계정을 퇴사 처리할 수 있습니다.' },
]

const menuSections = defaultMenuSections.map((section) => ({
  id: section.id,
  title: section.title,
  items: section.items.map((item) => ({ id: item.id, label: item.label, icon: item.icon })),
}))
const allMenuIds = menuSections.flatMap((section) => section.items.map((item) => item.id))

function loadStoredTeams() {
  try {
    const saved = localStorage.getItem(TEAM_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveStoredTeams(teams) {
  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teams))
}

function StatCard({ icon, tone = 'sky', label, value, helper }) {
  const toneClass = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }[tone]

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <span className={`material-symbols-outlined grid h-16 w-16 place-items-center rounded-full text-3xl ${toneClass}`}>{icon}</span>
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          {helper && <p className="mt-2 text-sm font-bold text-slate-400">{helper}</p>}
        </div>
      </div>
    </article>
  )
}

function OrganizationTabs({ activeTab, onChange }) {
  return (
    <div className="mb-6 border-b border-slate-200">
      <div className="flex flex-wrap gap-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`border-b-4 px-1 pb-4 text-sm font-black transition-colors ${activeTab === tab.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Overview({ users, invites, positions, teamCount, onNavigateTab }) {
  const activeUsers = users.filter((user) => user.status === 'ACTIVE')
  const pendingInvites = invites.filter((invite) => invite.status === 'PENDING')
  const managerCount = users.filter((user) => user.role === 'MANAGER' || user.role === 'EXECUTIVE').length

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="groups" label="전체 직원" value={`${users.length}명`} helper={`활성 ${activeUsers.length}명`} />
        <StatCard icon="group_work" tone="emerald" label="활성 팀" value={`${teamCount}개`} helper="부서 기준 + 생성 팀" />
        <StatCard icon="workspace_premium" tone="violet" label="직급" value={`${positions.length}개`} helper="현재 직원/초대 기준" />
        <StatCard icon="lock" tone="amber" label="초대 대기" value={`${pendingInvites.length}건`} helper={`관리 권한 ${managerCount}명`} />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          ['직원 관리', '직원 초대, 계정 상태, 비밀번호 초기화와 직원별 권한을 관리합니다.', 'employees', 'manage_accounts'],
          ['조직/팀 관리', '팀 생성, 팀장 지정, 팀원 구성을 관리합니다.', 'teams', 'account_tree'],
          ['직급/권한 관리', '직급별 기능 권한과 사이드바 메뉴 접근 범위를 설정합니다.', 'roles', 'admin_panel_settings'],
        ].map(([title, description, tab, icon]) => (
          <Panel key={tab} title={title}>
            <span className="material-symbols-outlined mb-4 grid h-12 w-12 place-items-center rounded-full bg-sky-50 text-2xl text-sky-600">{icon}</span>
            <p className="min-h-20 text-sm font-bold leading-6 text-slate-500">{description}</p>
            <button type="button" onClick={() => onNavigateTab(tab)} className="mt-5 h-11 w-full rounded-lg border border-sky-200 text-sm font-black text-sky-600 hover:bg-sky-50">
              바로가기
            </button>
          </Panel>
        ))}
      </section>
    </div>
  )
}

function buildDepartmentTeams(users) {
  const map = new Map()
  users.forEach((user) => {
    const key = user.department || '미배정'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(user)
  })
  return [...map.entries()].map(([name, members], index) => ({
    id: `department-${index}-${name}`,
    name,
    parent: '대표',
    leaderId: members.find((member) => member.role === 'MANAGER')?.id || members[0]?.id || '',
    description: `${name} 구성원 기준으로 자동 생성된 팀입니다.`,
    memberIds: members.map((member) => member.id),
    source: 'department',
  }))
}

function TeamsPage({ users }) {
  const [storedTeams, setStoredTeams] = useState(() => loadStoredTeams())
  const departmentTeams = useMemo(() => buildDepartmentTeams(users), [users])
  const teams = useMemo(() => [...departmentTeams, ...storedTeams], [departmentTeams, storedTeams])
  const [selectedId, setSelectedId] = useState('')
  const selected = teams.find((team) => team.id === selectedId) || teams[0]
  const [draft, setDraft] = useState(selected || null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!selectedId && teams[0]) setSelectedId(teams[0].id)
  }, [selectedId, teams])

  useEffect(() => {
    setDraft(selected ? { ...selected, memberIds: selected.memberIds || [] } : null)
  }, [selected])

  const createTeam = () => {
    const team = {
      id: `custom-${Date.now()}`,
      name: `새 팀 ${storedTeams.length + 1}`,
      parent: '대표',
      leaderId: '',
      description: '',
      memberIds: [],
      source: 'custom',
    }
    const next = [...storedTeams, team]
    setStoredTeams(next)
    saveStoredTeams(next)
    setSelectedId(team.id)
    setMessage('새 팀을 생성했습니다. 정보를 입력한 뒤 저장하세요.')
  }

  const updateDraft = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  const toggleMember = (id) => {
    setDraft((prev) => {
      const memberIds = prev.memberIds || []
      return {
        ...prev,
        memberIds: memberIds.includes(id) ? memberIds.filter((item) => item !== id) : [...memberIds, id],
      }
    })
  }

  const saveTeam = () => {
    if (!draft?.name?.trim()) {
      setMessage('팀명을 입력하세요.')
      return
    }
    const copy = draft.source === 'department' ? { ...draft, id: `custom-${Date.now()}`, source: 'custom' } : draft
    const next = draft.source === 'department'
      ? [...storedTeams, copy]
      : storedTeams.map((team) => (team.id === draft.id ? draft : team))
    setStoredTeams(next)
    saveStoredTeams(next)
    setSelectedId(copy.id)
    setMessage('팀 변경사항을 저장했습니다.')
  }

  const removeTeam = () => {
    if (!draft || draft.source !== 'custom') {
      setMessage('부서 기준 팀은 삭제할 수 없습니다.')
      return
    }
    const next = storedTeams.filter((team) => team.id !== draft.id)
    setStoredTeams(next)
    saveStoredTeams(next)
    setSelectedId(departmentTeams[0]?.id || next[0]?.id || '')
    setMessage('팀을 삭제했습니다.')
  }

  if (!draft) {
    return (
      <Panel title="조직/팀 관리">
        <button type="button" onClick={createTeam} className="h-11 rounded-lg bg-sky-500 px-4 text-sm font-black text-white">팀 생성</button>
      </Panel>
    )
  }

  const memberMap = new Map(users.map((user) => [user.id, user]))
  const members = (draft.memberIds || []).map((id) => memberMap.get(id)).filter(Boolean)

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
      <Panel title="팀 목록" right={<button type="button" onClick={createTeam} className="text-xs font-black text-sky-600">+ 팀 생성</button>}>
        <div className="space-y-3">
          {teams.map((team) => (
            <button key={team.id} type="button" onClick={() => setSelectedId(team.id)} className={`flex w-full items-center justify-between rounded-lg border p-4 text-left ${selected?.id === team.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span>
                <span className="block text-sm font-black text-slate-900">{team.name}</span>
                <span className="mt-1 block text-xs font-bold text-slate-400">구성원 {(team.memberIds || []).length}명</span>
              </span>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="팀 정보 및 구성 관리" right={message ? <span className="text-xs font-black text-emerald-600">{message}</span> : null}>
        <div className="grid gap-4">
          <label><span className="mb-2 block text-xs font-black text-slate-500">팀명</span><input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" /></label>
          <label><span className="mb-2 block text-xs font-black text-slate-500">상위 조직</span><input value={draft.parent || ''} onChange={(event) => updateDraft('parent', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" /></label>
          <label>
            <span className="mb-2 block text-xs font-black text-slate-500">팀장</span>
            <select value={draft.leaderId || ''} onChange={(event) => updateDraft('leaderId', Number(event.target.value) || '')} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">팀장 선택</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.display_name || user.username}</option>)}
            </select>
          </label>
          <label><span className="mb-2 block text-xs font-black text-slate-500">팀 설명</span><textarea value={draft.description || ''} onChange={(event) => updateDraft('description', event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold" /></label>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="mb-3 text-sm font-black text-slate-900">팀 구성원 ({members.length}명)</h3>
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 md:grid-cols-2">
            {users.map((user) => (
              <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={(draft.memberIds || []).includes(user.id)} onChange={() => toggleMember(user.id)} className="h-4 w-4 accent-sky-500" />
                <span className="text-sm font-bold text-slate-800">{user.display_name || user.username}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={removeTeam} className="h-11 rounded-lg border border-rose-200 px-5 text-sm font-black text-rose-600">삭제</button>
          <button type="button" onClick={saveTeam} className="h-11 flex-1 rounded-lg bg-sky-500 px-5 text-sm font-black text-white hover:bg-sky-600">변경사항 저장</button>
        </div>
      </Panel>

      <Panel title="조직 구조 미리보기">
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><span className="material-symbols-outlined text-sky-600">account_tree</span><span className="font-black">대표</span></div>
          {teams.slice(0, 10).map((team) => (
            <div key={team.id} className="ml-6 flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="font-bold text-slate-700">{team.name}</span>
              <span className="text-xs font-black text-slate-400">{(team.memberIds || []).length}명</span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  )
}

function RolesPage({ users, positions, permissionTemplates, onReload }) {
  const [localPositions, setLocalPositions] = useState([])
  const templatePositions = useMemo(
    () => permissionTemplates.map((template) => template.position_name || template.positionName).filter(Boolean),
    [permissionTemplates],
  )
  const positionList = useMemo(
    () => [...new Set([...positions, ...templatePositions, ...localPositions])].filter(Boolean),
    [positions, templatePositions, localPositions],
  )
  const [selected, setSelected] = useState(positionList[0] || '직원')
  const [permissionGroupName, setPermissionGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [features, setFeatures] = useState(DEFAULT_FEATURE_PERMISSIONS)
  const [selectedMenus, setSelectedMenus] = useState(allMenuIds)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const members = useMemo(
    () => users.filter((user) => (user.position_name || '직원') === selected),
    [users, selected],
  )

  useEffect(() => {
    if (!positionList.includes(selected)) setSelected(positionList[0] || '직원')
  }, [positionList, selected])

  useEffect(() => {
    const savedTemplate = permissionTemplates.find((template) => (template.position_name || template.positionName) === selected)
    const memberSource = members.find((member) => member.allowed_menu_sections)
    const access = parseAccessPermissions(savedTemplate?.permission_payload || savedTemplate?.permissionPayload || memberSource?.allowed_menu_sections)
    setPermissionGroupName(savedTemplate?.permission_group_name || savedTemplate?.permissionGroupName || access.permissionGroupName || `${selected} 권한`)
    setDescription(savedTemplate?.description || `${selected} 직급의 기능 권한과 메뉴 접근 범위를 관리합니다.`)
    setFeatures(access.features?.length ? access.features : DEFAULT_FEATURE_PERMISSIONS)
    setSelectedMenus(getAllowedMenus(access) || allMenuIds)
  }, [selected, users, members, permissionTemplates])

  const createPosition = () => {
    const name = normalizePositionTitle(window.prompt('새 직급명을 입력하세요.') || '')
    if (!name) return
    setLocalPositions((prev) => [...new Set([...prev, name])])
    setSelected(name)
    setMessage('새 직급을 추가했습니다. 권한을 저장하면 직원이 없어도 템플릿으로 관리됩니다.')
  }

  const toggleFeature = (id) => setFeatures((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  const toggleMenu = (id) => setSelectedMenus((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  const toggleSection = (section) => {
    const ids = section.items.map((item) => item.id)
    const allChecked = ids.every((id) => selectedMenus.includes(id))
    setSelectedMenus((prev) => allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  const saveRolePermissions = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = serializeAccessPermissions({ menus: selectedMenus, features })
      const response = await savePositionPermissionTemplate({
        positionName: selected,
        permissionGroupName,
        description,
        sections: payload,
      })
      await onReload()
      const updatedUsers = Number(response.data?.updatedUsers || 0)
      setMessage(`${selected} 직급 권한 템플릿을 저장했습니다. 기존 직원 ${updatedUsers}명에게 적용했습니다.`)
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '권한 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
      <Panel title="직급 목록" right={<button type="button" onClick={createPosition} className="text-xs font-black text-sky-600">+ 직급 생성</button>}>
        <div className="space-y-3">
          {positionList.map((position) => {
            const count = users.filter((user) => (user.position_name || '직원') === position).length
            return (
              <button key={position} type="button" onClick={() => setSelected(position)} className={`flex w-full items-center justify-between rounded-lg border p-4 text-left ${selected === position ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span><span className="block text-sm font-black text-slate-900">{position}</span><span className="mt-1 block text-xs font-bold text-emerald-600">메뉴 설정 가능</span></span>
                <span className="text-sm font-black text-slate-400">{count}명</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title="직급 정보 및 권한 설정" right={message ? <span className="max-w-md truncate text-xs font-black text-emerald-600">{message}</span> : null}>
        <div className="grid gap-4">
          <label><span className="mb-2 block text-xs font-black text-slate-500">권한 그룹 이름</span><input value={permissionGroupName} onChange={(event) => setPermissionGroupName(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" /></label>
          <label><span className="mb-2 block text-xs font-black text-slate-500">설명</span><input value={description} onChange={(event) => setDescription(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" /></label>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {featurePermissionItems.map((permission) => {
            const checked = features.includes(permission.id)
            return (
            <button key={permission.id} type="button" role="switch" aria-checked={checked} onClick={() => toggleFeature(permission.id)} className={`rounded-lg border p-4 text-left transition-colors ${checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-800">{permission.label}</span>
                <span className={`relative h-[22px] w-10 rounded-full p-[3px] transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </span>
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{permission.description}</p>
            </button>
            )
          })}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">메뉴 접근 설정</h3>
            <div className="flex gap-2 text-xs font-black">
              <button type="button" onClick={() => setSelectedMenus(allMenuIds)} className="text-sky-600">전체 선택</button>
              <button type="button" onClick={() => setSelectedMenus([])} className="text-slate-500">전체 해제</button>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            {menuSections.map((section) => {
              const sectionIds = section.items.map((item) => item.id)
              const checkedCount = sectionIds.filter((id) => selectedMenus.includes(id)).length
              return (
                <div key={section.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <label className="mb-2 flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={checkedCount === sectionIds.length} onChange={() => toggleSection(section)} className="h-4 w-4 accent-sky-500" />
                    <span className="text-xs font-black text-slate-600">{section.title}</span>
                    <span className="ml-auto text-xs font-bold text-slate-400">{checkedCount}/{sectionIds.length}</span>
                  </label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {section.items.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-2 hover:bg-sky-50">
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
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => setSelectedMenus(allMenuIds)} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-black text-slate-600">초기화</button>
          <button type="button" onClick={saveRolePermissions} disabled={saving} className="h-11 flex-1 rounded-lg bg-sky-500 px-5 text-sm font-black text-white hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400">
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </Panel>

      <Panel title={`이 직급에 속한 직원 (${members.length}명)`}>
        <div className="space-y-3">
          {members.slice(0, 10).map((member) => (
            <div key={member.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0">
              <span><span className="block text-sm font-black text-slate-900">{member.display_name}</span><span className="text-xs font-bold text-slate-400">{member.username}</span></span>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-600">{member.department || '-'}</span>
            </div>
          ))}
          {members.length === 0 && <p className="text-sm font-bold text-slate-400">해당 직급 직원이 없습니다.</p>}
        </div>
      </Panel>
    </section>
  )
}

export default function OrganizationManagementPage(props) {
  const [activeTab, setActiveTab] = useState('overview')
  const [users, setUsers] = useState([])
  const [invites, setInvites] = useState([])
  const [permissionTemplates, setPermissionTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [userRes, inviteRes, templateRes] = await Promise.all([
        getUsers(),
        getInvites(),
        getPositionPermissionTemplates(),
      ])
      setUsers(userRes.data || [])
      setInvites(inviteRes.data || [])
      setPermissionTemplates(templateRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const templatePositionRows = useMemo(
    () => permissionTemplates.map((template) => ({ position_name: template.position_name || template.positionName })),
    [permissionTemplates],
  )
  const positions = useMemo(() => getPositionTitleOptions([...users, ...invites, ...templatePositionRows]), [users, invites, templatePositionRows])
  const teamCount = useMemo(() => new Set(users.map((user) => user.department || '미배정')).size + loadStoredTeams().length, [users])

  const titles = {
    overview: '조직 관리',
    employees: '직원 관리',
    teams: '조직/팀 관리',
    roles: '직급/권한 관리',
  }
  const descriptions = {
    overview: '직원, 팀, 직급 및 권한을 한 곳에서 관리할 수 있습니다.',
    employees: '직원 초대, 계정 상태, 직급, 비밀번호 초기화 및 메뉴 접근 현황을 관리할 수 있습니다.',
    teams: '팀 생성, 조직 구조 관리, 팀장 지정 및 팀원 구성을 관리할 수 있습니다.',
    roles: '직급을 생성하고 기능 권한과 메뉴 접근 범위를 설정할 수 있습니다.',
  }

  return (
    <>
      <PageHeader
        title={titles[activeTab]}
        description={descriptions[activeTab]}
        actions={
          <div className="flex gap-3">
            <button type="button" onClick={() => setActiveTab('employees')} className="inline-flex h-11 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-600">
              <span className="material-symbols-outlined text-lg">person_add</span>
              직원 초대
            </button>
            <button type="button" onClick={() => setActiveTab('roles')} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              직급 생성
            </button>
          </div>
        }
      />

      <OrganizationTabs activeTab={activeTab} onChange={setActiveTab} />

      {loading && (
        <Panel title="불러오는 중">
          <p className="text-sm font-bold text-slate-500">조직 정보를 불러오고 있습니다.</p>
        </Panel>
      )}

      {!loading && activeTab === 'overview' && (
        <Overview users={users} invites={invites} positions={positions} teamCount={teamCount} onNavigateTab={setActiveTab} />
      )}
      {!loading && activeTab === 'employees' && <EmployeeManagementPage {...props} embedded />}
      {!loading && activeTab === 'teams' && <TeamsPage users={users} />}
      {!loading && activeTab === 'roles' && (
        <RolesPage
          users={users}
          positions={positions}
          permissionTemplates={permissionTemplates}
          onReload={load}
        />
      )}
    </>
  )
}
