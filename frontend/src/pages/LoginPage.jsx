import { useState } from 'react'
import { login } from '../api/authApi'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const session = await login(username, password)
      onLogin(session)
    } catch (submitError) {
      setError(submitError.message || '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.14),_transparent_30%)]" />

      <section className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">Test Access</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">대시보드 로그인</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            테스트 배포 환경 보호를 위해 관리자 계정으로 로그인한 뒤 대시보드에 접근할 수 있습니다.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              submitting || !username || !password
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'bg-slate-950 text-white hover:bg-slate-800'
            }`}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  )
}
