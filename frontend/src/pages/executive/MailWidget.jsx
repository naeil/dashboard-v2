import { useState } from 'react'
import { connectDaouMail, getMailFolder } from '../../api/mailApi'

const PAGE_SIZE = 10
const FOLDERS = [
  { id: 'inbox', label: '수신' },
  { id: 'sent', label: '발신' },
]

function formatReceivedDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function MailWidget() {
  const [folder, setFolder] = useState('inbox')
  const [mails, setMails] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [credentials, setCredentials] = useState({ loginId: '', password: '', host: 'imap.daouoffice.com' })

  const loadMails = async (nextPage = 0, nextFolder = folder) => {
    setLoading(true)
    setError('')
    try {
      const response = await getMailFolder({ folder: nextFolder, page: nextPage, size: PAGE_SIZE })
      const rows = Array.isArray(response.data) ? response.data : []
      setMails((current) => (nextPage === 0 ? rows : [...current, ...rows]))
      setPage(nextPage)
      setHasMore(rows.length === PAGE_SIZE)
      setShowConnect(false)
      setHasLoaded(true)
    } catch (err) {
      setHasLoaded(true)
      if (err.response?.status === 401) {
        setError('메일 계정 연결 필요')
        setShowConnect(true)
      } else {
        setError(err.response?.data?.message || '메일을 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const connectMail = async (event) => {
    event.preventDefault()
    if (!credentials.loginId || !credentials.password) {
      setError('메일 ID와 비밀번호를 입력해주세요.')
      return
    }
    setConnecting(true)
    setError('')
    try {
      await connectDaouMail(credentials)
      setCredentials({ loginId: credentials.loginId, password: '', host: credentials.host || 'imap.daouoffice.com' })
      await loadMails(0, folder)
    } catch (err) {
      setError(err.response?.data?.message || '다우오피스 메일 계정 연결에 실패했습니다.')
    } finally {
      setConnecting(false)
    }
  }

  const changeFolder = (nextFolder) => {
    setFolder(nextFolder)
    loadMails(0, nextFolder)
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">다우오피스 메일</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">수신/발신 메일을 대시보드에서 바로 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowConnect((value) => !value)}
            className="inline-flex h-9 items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"
          >
            <span className="material-symbols-outlined text-base">key</span>
            메일 계정 연결
          </button>
          <button
            type="button"
            onClick={() => loadMails(0, folder)}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            새로고침
          </button>
        </div>
      </div>

      {showConnect && (
        <form onSubmit={connectMail} className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="text-xs font-black text-slate-600">메일 서버 주소</span>
            <input
              value={credentials.host}
              onChange={(event) => setCredentials((current) => ({ ...current, host: event.target.value }))}
              placeholder="imap.daouoffice.com"
              className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-600">다우오피스 ID</span>
            <input
              value={credentials.loginId}
              onChange={(event) => setCredentials((current) => ({ ...current, loginId: event.target.value }))}
              placeholder="user@company.daouoffice.com"
              className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-600">비밀번호</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
              placeholder="다우오피스 비밀번호"
              className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={connecting}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60 lg:mt-auto"
          >
            {connecting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
            연결
          </button>
        </form>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {FOLDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => changeFolder(item.id)}
            className={`h-9 rounded border px-4 text-sm font-black ${
              folder === item.id
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
          {error}
        </div>
      )}

      {!error && hasLoaded && mails.length === 0 && !loading && (
        <div className="mt-5 rounded border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
          표시할 이메일이 없습니다.
        </div>
      )}

      <div className="mt-5 divide-y divide-slate-100">
        {mails.map((mail, index) => (
          <article key={`${mail.receivedDate}-${mail.from}-${index}`} className="flex items-start gap-3 py-4">
            <span className={`material-symbols-outlined mt-0.5 text-lg ${mail.isRead ? 'text-slate-300' : 'text-blue-600'}`}>
              {folder === 'sent' ? 'outgoing_mail' : mail.isRead ? 'drafts' : 'mail'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className={`truncate text-sm ${mail.isRead ? 'font-bold text-slate-700' : 'font-black text-slate-950'}`}>
                  {mail.subject || '(제목 없음)'}
                </p>
                <span className="shrink-0 text-xs font-bold text-slate-400">{formatReceivedDate(mail.receivedDate)}</span>
              </div>
              <p className="mt-1 truncate text-xs font-black text-slate-500">{mail.from || '-'}</p>
              <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500">{mail.preview || '-'}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
            불러오는 중
          </span>
        ) : hasMore && mails.length > 0 ? (
          <button
            type="button"
            onClick={() => loadMails(page + 1, folder)}
            className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            더보기
          </button>
        ) : null}
      </div>
    </section>
  )
}
