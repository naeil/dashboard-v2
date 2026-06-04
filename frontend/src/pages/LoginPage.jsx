import { useEffect, useState } from 'react'
import { login, previewInvite, registerWithInvite } from '../api/authApi'

function getInitialInviteCode() {
  const params = new URLSearchParams(window.location.search)
  const queryInvite = params.get('invite') || params.get('inviteCode')
  const pathInvite = window.location.pathname.match(/^\/invite\/([^/?#]+)/)?.[1]
  return (queryInvite || pathInvite || '').trim().toUpperCase()
}

export default function LoginPage({ onLogin }) {
  const initialInviteCode = getInitialInviteCode()
  const [mode, setMode] = useState(initialInviteCode ? 'register' : 'login')
  const [username, setUsername] = useState(initialInviteCode ? '' : 'admin')
  const [password, setPassword] = useState(initialInviteCode ? '' : 'change-me-1234')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [inviteInfo, setInviteInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialInviteCode) return
    setMode('register')
    setPassword('')
    setInviteCode(initialInviteCode)
  }, [initialInviteCode])

  useEffect(() => {
    if (mode !== 'register' || !inviteCode || inviteCode.length < 6) return

    let active = true
    previewInvite(inviteCode)
      .then((info) => {
        if (!active) return
        setInviteInfo(info)
        setUsername(info.displayName || '')
        setError('')
      })
      .catch((inviteError) => {
        if (!active) return
        setInviteInfo(null)
        setError(inviteError.message || '초대 정보를 확인하지 못했습니다.')
      })

    return () => {
      active = false
    }
  }, [inviteCode, mode])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const session = mode === 'login'
        ? await login(username, password)
        : await registerWithInvite({ inviteCode, username, password })
      onLogin(session)
    } catch (submitError) {
      setError(submitError.message || (mode === 'login' ? '로그인에 실패했습니다.' : '가입에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_30%),#f8fafc] px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Naeil Platform</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{isRegister ? '직원 가입' : '회사 업무 플랫폼'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {isRegister
              ? '초대받은 개인 이름으로 계정을 만들고 로그인합니다.'
              : '직원 업무, 결재, 공유 현황, 대표자 대시보드를 권한별로 관리합니다.'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setUsername('admin')
              setPassword('change-me-1234')
              setError('')
            }}
            className={`h-10 rounded-md text-sm font-black transition-colors ${mode === 'login' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setUsername('')
              setPassword('')
              setError('')
            }}
            className={`h-10 rounded-md text-sm font-black transition-colors ${mode === 'register' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
          >
            직원 가입
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">초대 코드</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="NAEIL-ABC123"
                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              {inviteInfo && (
                <span className="mt-2 block text-xs font-bold text-sky-600">
                  초대 대상: {inviteInfo.department ? `${inviteInfo.department} / ` : ''}{inviteInfo.displayName}
                </span>
              )}
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{isRegister ? '개인 이름' : '아이디'}</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder={isRegister ? '이름 입력' : ''}
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            {isRegister && <span className="mt-2 block text-xs font-bold text-slate-500">이 이름이 로그인 아이디로 사용됩니다.</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            {isRegister && <span className="mt-2 block text-xs font-bold text-slate-500">8자 이상으로 설정하세요.</span>}
          </label>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password || (isRegister && !inviteCode)}
            className="h-12 w-full rounded-lg bg-sky-500 text-sm font-black text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? '처리 중...' : isRegister ? '가입 완료' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  )
}
