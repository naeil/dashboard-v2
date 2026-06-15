import { useEffect, useState } from 'react'
import { adminLogin, checkUsernameAvailability, previewInvite, registerWithInvite, tenantLogin } from '../api/authApi'
import { LOGIN_MODES, requiresCompanyCode } from '../utils/loginModes'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%&*])[A-Za-z0-9!@#$%&*]{8,16}$/

function getInitialInviteCode() {
  const params = new URLSearchParams(window.location.search)
  const queryInvite = params.get('invite') || params.get('inviteCode')
  const pathInvite = window.location.pathname.match(/^\/invite\/([^/?#]+)/)?.[1]
  return (queryInvite || pathInvite || '').trim().toUpperCase()
}

export default function LoginPage({ onLogin }) {
  const initialInviteCode = getInitialInviteCode()
  const [mode, setMode] = useState(initialInviteCode ? 'register' : 'login')
  const [loginMode, setLoginMode] = useState(LOGIN_MODES.TENANT)
  const [companyCode, setCompanyCode] = useState('')
  const [username, setUsername] = useState(initialInviteCode ? '' : 'admin')
  const [password, setPassword] = useState(initialInviteCode ? '' : '123456789')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [inviteInfo, setInviteInfo] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [usernameCheckStatus, setUsernameCheckStatus] = useState('idle')
  const [usernameCheckMessage, setUsernameCheckMessage] = useState('')
  const [checkedUsername, setCheckedUsername] = useState('')

  useEffect(() => {
    if (!initialInviteCode) return
    setMode('register')
    setPassword('')
    setPasswordConfirm('')
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
        setUsernameCheckStatus('idle')
        setUsernameCheckMessage('')
        setCheckedUsername('')
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

  const isRegister = mode === 'register'
  const passwordChecks = [
    { id: 'length', label: '8자 이상 16자 이하', passed: password.length >= 8 && password.length <= 16 },
    { id: 'upper', label: '영문 대문자 1개 이상', passed: /[A-Z]/.test(password) },
    { id: 'lower', label: '영문 소문자 1개 이상', passed: /[a-z]/.test(password) },
    { id: 'special', label: '특수문자 !@#$%&* 1개 이상', passed: /[!@#$%&*]/.test(password) },
  ]
  const passwordValid = PASSWORD_PATTERN.test(password)
  const passwordMismatch = isRegister && passwordConfirm.length > 0 && password !== passwordConfirm
  const usernameCheckPassed = !isRegister || (usernameCheckStatus === 'available' && checkedUsername === username.trim())
  const canSubmit = !submitting
    && Boolean(username.trim())
    && Boolean(password)
    && (isRegister || !requiresCompanyCode(loginMode) || Boolean(companyCode.trim()))
    && (!isRegister || (inviteCode && usernameCheckPassed && passwordValid && passwordConfirm && password === passwordConfirm))

  const handleUsernameChange = (event) => {
    const nextUsername = event.target.value
    setUsername(nextUsername)
    if (isRegister) {
      setUsernameCheckStatus('idle')
      setUsernameCheckMessage('')
      setCheckedUsername('')
    }
  }

  const checkUsername = async () => {
    const normalizedUsername = username.trim()
    if (!normalizedUsername) {
      setUsernameCheckStatus('error')
      setUsernameCheckMessage('아이디를 입력하세요.')
      return
    }

    setUsernameCheckStatus('checking')
    setUsernameCheckMessage('')
    try {
      const result = await checkUsernameAvailability(normalizedUsername, inviteCode)
      setCheckedUsername(normalizedUsername)
      setUsernameCheckStatus(result.available ? 'available' : 'taken')
      setUsernameCheckMessage(result.message || (result.available ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.'))
    } catch (checkError) {
      setCheckedUsername('')
      setUsernameCheckStatus('error')
      setUsernameCheckMessage(checkError.message || '아이디 중복 확인에 실패했습니다.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isRegister && (usernameCheckStatus !== 'available' || checkedUsername !== username.trim())) {
      setError('아이디 중복 체크를 완료하세요.')
      return
    }
    if (isRegister && !passwordValid) {
      setError('비밀번호 조건을 확인하세요.')
      return
    }
    if (isRegister && password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const session = isRegister
        ? await registerWithInvite({ inviteCode, username: username.trim(), password })
        : loginMode === LOGIN_MODES.PLATFORM
          ? await adminLogin(username.trim(), password)
          : await tenantLogin(companyCode.trim(), username.trim(), password)
      onLogin({ ...session, loginSurface: isRegister ? LOGIN_MODES.TENANT : loginMode })
    } catch (submitError) {
      setError(submitError.message || (isRegister ? '가입에 실패했습니다.' : '로그인에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="mb-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">NAEIL ERP PLATFORM</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            {isRegister ? '회원 가입' : '로그인'}
          </h1>
          <p className="mt-4 text-base font-bold leading-7 text-slate-500">
            {isRegister
              ? '초대받은 직원 계정을 생성하고 플랫폼을 이용할 수 있습니다.'
              : '직원 업무, 결재, 공유 현황을 역할별로 효율적으로 관리하세요.'}
          </p>
        </div>

        {!isRegister && (
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode(LOGIN_MODES.TENANT)
                setError('')
              }}
              className={`flex h-12 items-center justify-center gap-2 rounded-md text-sm font-black transition-colors ${loginMode === LOGIN_MODES.TENANT ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
            >
              <span className="material-symbols-outlined text-xl">person</span>
              사용자 로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode(LOGIN_MODES.PLATFORM)
                setError('')
              }}
              className={`flex h-12 items-center justify-center gap-2 rounded-md text-sm font-black transition-colors ${loginMode === LOGIN_MODES.PLATFORM ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
            >
              <span className="material-symbols-outlined text-xl">shield_person</span>
              관리자 로그인
            </button>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">초대 코드</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="NAEIL-ABC123"
                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              {inviteInfo && (
                <span className="mt-2 block text-sm font-bold text-sky-600">
                  초대 대상: {inviteInfo.department ? `${inviteInfo.department} / ` : ''}{inviteInfo.displayName}
                </span>
              )}
            </label>
          )}

          {!isRegister && requiresCompanyCode(loginMode) && (
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">회사 코드</span>
              <input
                type="text"
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value.toUpperCase())}
                autoComplete="organization"
                placeholder="5자리 회사 코드를 입력하세요"
                maxLength={5}
                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold uppercase text-slate-950 outline-none transition-colors placeholder:normal-case placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">아이디</span>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              autoComplete="username"
              placeholder="아이디를 입력하세요"
              className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            {isRegister && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className={`text-sm font-bold ${
                  usernameCheckStatus === 'available'
                    ? 'text-emerald-600'
                    : usernameCheckStatus === 'taken' || usernameCheckStatus === 'error'
                      ? 'text-rose-600'
                      : 'text-slate-500'
                }`}
                >
                  {usernameCheckMessage || '중복 체크 후 이 아이디로 로그인합니다.'}
                </span>
                <button
                  type="button"
                  onClick={checkUsername}
                  disabled={!username.trim() || usernameCheckStatus === 'checking'}
                  className="h-9 shrink-0 rounded-lg border border-sky-200 px-3 text-sm font-black text-sky-600 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  {usernameCheckStatus === 'checking' ? '확인 중...' : '중복 체크'}
                </button>
              </div>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">비밀번호</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="비밀번호를 입력하세요"
                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 pr-12 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {isRegister && (
              <div className="mt-2 grid gap-1 text-sm font-bold sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <span key={check.id} className={check.passed ? 'text-emerald-600' : password ? 'text-rose-600' : 'text-slate-500'}>
                    {check.passed ? '✓' : '•'} {check.label}
                  </span>
                ))}
              </div>
            )}
          </label>

          {isRegister && (
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">비밀번호 확인</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
                placeholder="비밀번호를 다시 입력하세요"
                className={`h-12 w-full rounded-lg border bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 ${
                  passwordMismatch
                    ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
                }`}
              />
              {passwordMismatch && <span className="mt-2 block text-sm font-bold text-rose-600">비밀번호가 일치하지 않습니다.</span>}
            </label>
          )}

          {!isRegister && (
            <div className="text-right">
              <button type="button" className="text-sm font-black text-sky-600 hover:text-sky-700">
                비밀번호 찾기
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-base font-bold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-lg bg-sky-500 text-base font-black text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? '처리 중...' : isRegister ? '가입 완료' : '로그인'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((value) => (value === 'login' ? 'register' : 'login'))
            setError('')
            setPasswordConfirm('')
          }}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-sky-500 text-base font-black text-sky-600 transition-colors hover:bg-sky-50"
        >
          <span className="material-symbols-outlined">{isRegister ? 'login' : 'person_add'}</span>
          {isRegister ? '로그인으로 돌아가기' : '회원가입'}
        </button>
      </section>
    </main>
  )
}
