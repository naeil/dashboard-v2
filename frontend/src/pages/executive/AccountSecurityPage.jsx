import { useState } from 'react'
import { changePassword, logout } from '../../api/authApi'
import { PageHeader, Panel } from './ExecutiveComponents'

export default function AccountSecurityPage({ username, displayName, department, positionName, role }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    if (newPassword !== confirmPassword) {
      setMessage('새 비밀번호가 서로 일치하지 않습니다.')
      return
    }
    setSaving(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => logout().then(() => window.location.reload()), 900)
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-400'

  return (
    <>
      <PageHeader title="내 계정" description="내 로그인 비밀번호와 계정 정보를 관리합니다." />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="계정 정보">
          <div className="space-y-4">
            {[
              ['이름', displayName || '-'],
              ['아이디', username || '-'],
              ['소속', department || '-'],
              ['직급', positionName || '-'],
              ['권한', role || '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="비밀번호 변경" right={message ? <span className="text-xs font-black text-sky-700">{message}</span> : null}>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">현재 비밀번호</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={fieldClass}
                required
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">새 비밀번호</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                className={fieldClass}
                required
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">새 비밀번호 확인</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                className={fieldClass}
                required
              />
            </label>
            <div className="flex justify-end md:col-span-3">
              <button
                type="submit"
                disabled={saving || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                className="h-11 rounded-lg bg-sky-600 px-6 text-sm font-black text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving ? '변경 중' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        </Panel>
      </section>
    </>
  )
}
