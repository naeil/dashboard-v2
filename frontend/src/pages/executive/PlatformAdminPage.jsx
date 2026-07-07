import { useEffect, useState } from 'react'
import { PageHeader, Panel } from './ExecutiveComponents'
import {
  createNotice,
  deleteNotice,
  getPublicLoginBanner,
  listNotices,
  updateLoginBanner,
} from '../../api/siteContentApi'

function AdminStat({ icon, label, value, helper, tone = 'sky' }) {
  const toneClass = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }[tone]

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <span className={'material-symbols-outlined grid h-14 w-14 place-items-center rounded-full text-3xl ' + toneClass}>{icon}</span>
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-2 text-sm font-bold text-slate-400">{helper}</p>
        </div>
      </div>
    </article>
  )
}

const tenantRows = [
  { name: '내일그룹', plan: '운영', status: 'ACTIVE', users: 1 },
  { name: '신규 고객사', plan: '준비', status: 'PENDING', users: 0 },
]

function LoginScreenAdminPanel() {
  const [notices, setNotices] = useState([])
  const [loadingNotices, setLoadingNotices] = useState(true)
  const [bannerImage, setBannerImage] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [savingBanner, setSavingBanner] = useState(false)
  const [category, setCategory] = useState('NOTICE')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const loadNotices = () => {
    setLoadingNotices(true)
    listNotices()
      .then((response) => setNotices(Array.isArray(response.data) ? response.data : []))
      .catch(() => setNotices([]))
      .finally(() => setLoadingNotices(false))
  }

  useEffect(() => {
    loadNotices()
    getPublicLoginBanner()
      .then((data) => setBannerImage(data?.imageData || ''))
      .catch(() => setBannerImage(''))
  }, [])

  const handleBannerFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBannerPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSaveBanner = async () => {
    if (!bannerPreview) return
    setSavingBanner(true)
    setMessage('')
    try {
      await updateLoginBanner(bannerPreview)
      setBannerImage(bannerPreview)
      setBannerPreview('')
      setMessage('배너 이미지가 저장되었습니다.')
    } catch (saveError) {
      setMessage(saveError.message || '배너 저장에 실패했습니다.')
    } finally {
      setSavingBanner(false)
    }
  }

  const handleCreateNotice = async () => {
    if (!title.trim()) {
      setMessage('제목을 입력하세요.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      await createNotice({ category, title: title.trim(), content })
      setTitle('')
      setContent('')
      loadNotices()
      setMessage('등록되었습니다.')
    } catch (createError) {
      setMessage(createError.message || '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteNotice = async (id) => {
    try {
      await deleteNotice(id)
      loadNotices()
    } catch (deleteError) {
      setMessage(deleteError.message || '삭제에 실패했습니다.')
    }
  }

  return (
    <Panel title="로그인 화면 관리">
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-black text-slate-500">배너 이미지</p>
          <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
            {(bannerPreview || bannerImage) ? (
              <img src={bannerPreview || bannerImage} alt="배너 미리보기" className="h-32 w-full object-cover" />
            ) : (
              <div className="flex h-32 w-full items-center justify-center bg-slate-50 text-xs font-bold text-slate-400">
                등록된 배너 이미지가 없습니다.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={handleBannerFileChange} className="text-xs font-bold text-slate-600" />
            <button
              type="button"
              onClick={handleSaveBanner}
              disabled={!bannerPreview || savingBanner}
              className="shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200"
            >
              {savingBanner ? '저장 중...' : '배너 저장'}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="mb-2 text-xs font-black text-slate-500">공지사항 / 업데이트 등록</p>
          <div className="space-y-2">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700">
              <option value="NOTICE">공지사항</option>
              <option value="UPDATE">업데이트</option>
            </select>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="제목"
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="내용 (선택)"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
            />
            <button
              type="button"
              onClick={handleCreateNotice}
              disabled={submitting}
              className="w-full rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>

        {message && <p className="text-xs font-bold text-sky-600">{message}</p>}

        <div className="border-t border-slate-100 pt-5">
          <p className="mb-2 text-xs font-black text-slate-500">등록된 목록</p>
          {loadingNotices && <p className="text-xs font-bold text-slate-400">불러오는 중...</p>}
          {!loadingNotices && notices.length === 0 && (
            <p className="text-xs font-bold text-slate-400">등록된 항목이 없습니다.</p>
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {notices.map((notice) => (
              <div key={notice.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-700">
                    {'[' + (notice.category === 'UPDATE' ? '업데이트' : '공지사항') + '] ' + notice.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNotice(notice.id)}
                  className="shrink-0 text-xs font-black text-rose-500 hover:text-rose-600"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

export default function PlatformAdminPage({ onNavigate }) {
  return (
    <>
      <PageHeader
        title="플랫폼 관리"
        description="플랫폼 관리자 콘솔입니다. 테넌트, 관리자 계정, 시스템 상태를 한 화면에서 확인합니다."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStat icon="domain" label="테넌트" value="1곳" helper="운영 중인 고객사" />
        <AdminStat icon="admin_panel_settings" tone="violet" label="플랫폼 관리자" value="1명" helper="관리자 계정" />
        <AdminStat icon="monitor_heart" tone="emerald" label="시스템 상태" value="정상" helper="API / DB 기동 중" />
        <AdminStat icon="lock_clock" tone="amber" label="보안 작업" value="0건" helper="대기 중인 승인 없음" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Panel title="테넌트 관리" right={<button type="button" className="text-xs font-black text-sky-600">+ 테넌트 생성</button>}>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {['고객사', '상태', '플랜', '사용자', '관리'].map((header) => (
                      <th key={header} className="px-4 py-3 text-xs font-black text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantRows.map((tenant) => (
                    <tr key={tenant.name}>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{tenant.name}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{tenant.status}</span></td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-600">{tenant.plan}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-600">{tenant.users}명</td>
                      <td className="px-4 py-3"><button type="button" className="text-xs font-black text-sky-600">열기</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <LoginScreenAdminPanel />
        </div>

        <div className="space-y-6">
          <Panel title="관리자 작업">
            <div className="space-y-3">
              {[
                ['조직 관리 열기', 'account_tree', () => onNavigate?.('organization')],
                ['직원 관리 열기', 'manage_accounts', () => onNavigate?.('organization')],
                ['시스템 설정 열기', 'settings', () => onNavigate?.('settings')],
              ].map(([label, icon, action]) => (
                <button key={label} type="button" onClick={action} className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50">
                  <span className="inline-flex items-center gap-3 text-sm font-black text-slate-800">
                    <span className="material-symbols-outlined text-sky-600">{icon}</span>
                    {label}
                  </span>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="운영 메모">
            <p className="text-sm font-bold leading-6 text-slate-500">
              계정은 account_scope로 플랫폼/테넌트를 구분하고 account_level로 관리자/매니저/직원을 구분합니다.
              현재 플랫폼 관리자 로그인은 /api/auth/login, 사용자 로그인은 /api/auth/tenant-login을 사용합니다.
            </p>
          </Panel>
        </div>
      </section>
    </>
  )
}
