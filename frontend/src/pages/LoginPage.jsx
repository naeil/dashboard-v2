import { useState } from 'react'
import { login } from '../api/authApi'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('change-me-1234')
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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.20),transparent_30%),#020617] px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Naeil Executive</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">경영진 대시보드</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            현금흐름, 손익, 미수금, 재고와 수출 파이프라인을 확인하는 대표 전용 화면입니다.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">아이디</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="h-12 w-full rounded-lg border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition-colors focus:border-sky-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition-colors focus:border-sky-400"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="h-12 w-full rounded-lg bg-sky-400 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  )
}
