import { useEffect, useMemo, useRef, useState } from 'react'
import { buildApiUrl } from '../api/apiBase'
import { authorizedFetch } from '../api/authApi'

const SETTINGS_API_BASE = buildApiUrl('/settings/integrations')

const AUTH_TAB = 'auth'
const COLLECTION_TAB = 'collection'

const UNIT_OPTIONS = [
  { value: 'DAY', label: '일' },
  { value: 'WEEK', label: '주' },
  { value: 'MONTH', label: '개월' },
]

const MARKET_OPTIONS = [
  { value: 'NAVER_SMARTSTORE', label: '스마트스토어' },
  { value: 'COUPANG', label: '쿠팡' },
  { value: 'ELEVEN_STREET', label: '11번가' },
  { value: 'AUCTION', label: '옥션' },
  { value: 'GMARKET', label: '지마켓' },
]

const HISTORY_STATUS_LABELS = {
  RUNNING: '실행 중',
  SUCCESS: '성공',
  FAILED: '실패',
}

const HISTORY_STATUS_STYLES = {
  RUNNING: 'bg-sky-100 text-sky-700',
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
}

const HISTORY_JOB_LABELS = {
  ORDER: '주문 수집',
  INVENTORY: '재고/출고량 수집',
}

function formatSavedAt(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 저장`
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

function formatHistoryMessage(history) {
  if (history.message === 'Backfilled from existing last order collection timestamp') {
    return '직접 또는 설정된 주기마다 실행됩니다.'
  }

  if (history.message === 'Backfilled from existing last inventory collection timestamp') {
    return '설정과 무관하게 24시간마다 자동 실행됩니다.'
  }

  return history.message || '메시지가 없습니다.'
}

function SelectField({ value, onChange, disabled = false, className = '', children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2718%27 height=%2718%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%230f172a%27 stroke-width=%272.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.8rem center',
        backgroundSize: '18px 18px',
      }}
      className={`${className} rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm font-semibold focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'text-slate-900'
      }`}
    >
      {children}
    </select>
  )
}

export default function Settings({ isExpanded }) {
  const isHydratingPlayautoRef = useRef(false)
  const isHydratingOpenMarketRef = useRef(false)

  const [activeTab, setActiveTab] = useState(AUTH_TAB)

  const [playautoKey, setPlayautoKey] = useState('')
  const [playautoEmail, setPlayautoEmail] = useState('')
  const [playautoPassword, setPlayautoPassword] = useState('')

  const [collectionValue, setCollectionValue] = useState('')
  const [collectionUnit, setCollectionUnit] = useState('DAY')
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduleUnit, setScheduleUnit] = useState('DAY')
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(true)

  const [openMarketKey, setOpenMarketKey] = useState('')
  const [selectedMarket, setSelectedMarket] = useState('')

  const [isValidPlayauto, setIsValidPlayauto] = useState(false)
  const [isValidOpenMarket, setIsValidOpenMarket] = useState(false)
  const [isSavingAuth, setIsSavingAuth] = useState(false)
  const [isSavingCollection, setIsSavingCollection] = useState(false)
  const [isRunningOrderCollection, setIsRunningOrderCollection] = useState(false)
  const [authSavedAt, setAuthSavedAt] = useState(null)
  const [collectionSavedAt, setCollectionSavedAt] = useState(null)
  const [lastOrderCollectedAt, setLastOrderCollectedAt] = useState(null)
  const [collectionHistory, setCollectionHistory] = useState([])
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  const loadSettings = async () => {
    try {
      const [response, historyResponse] = await Promise.all([
        authorizedFetch(SETTINGS_API_BASE),
        authorizedFetch(`${SETTINGS_API_BASE}/history?integrationType=PLAYAUTO&limit=10`),
      ])

      if (!response.ok) return

      const settings = await response.json()
      const playauto = settings.find((item) => item.integrationType === 'PLAYAUTO')
      const market = settings.find((item) => item.integrationType !== 'PLAYAUTO')

      if (playauto) {
        isHydratingPlayautoRef.current = true
        setPlayautoKey(playauto.apiKey || '')
        setPlayautoEmail(playauto.email || '')
        setPlayautoPassword(playauto.password || '')
        setCollectionValue(playauto.collectionValue != null ? String(playauto.collectionValue) : '')
        setCollectionUnit(playauto.collectionUnit || 'DAY')
        setScheduleValue(playauto.scheduleValue != null ? String(playauto.scheduleValue) : '')
        setScheduleUnit(playauto.scheduleUnit || 'DAY')
        setAutoCollectEnabled(Boolean(playauto.autoCollectEnabled))
        setIsValidPlayauto(Boolean(playauto.apiKey))
        setAuthSavedAt(playauto.authUpdatedAt ? new Date(playauto.authUpdatedAt) : null)
        setCollectionSavedAt(playauto.collectionUpdatedAt ? new Date(playauto.collectionUpdatedAt) : null)
        setLastOrderCollectedAt(
          playauto.lastOrderCollectedAt ? new Date(playauto.lastOrderCollectedAt) : null,
        )
      }

      if (market) {
        isHydratingOpenMarketRef.current = true
        setSelectedMarket(market.integrationType || '')
        setOpenMarketKey(market.apiKey || '')
        setIsValidOpenMarket(Boolean(market.apiKey))
        if (market.authUpdatedAt && !playauto?.authUpdatedAt) {
          setAuthSavedAt(new Date(market.authUpdatedAt))
        }
      }

      if (historyResponse.ok) {
        const history = await historyResponse.json()
        setCollectionHistory(history || [])
      }
    } catch (error) {
      showToast(error.message || '설정 정보를 불러오지 못했습니다.', 'error')
    }
  }

  useEffect(() => {
    if (isHydratingPlayautoRef.current) {
      isHydratingPlayautoRef.current = false
      return
    }
    setIsValidPlayauto(false)
  }, [playautoKey, playautoEmail, playautoPassword])

  useEffect(() => {
    if (isHydratingOpenMarketRef.current) {
      isHydratingOpenMarketRef.current = false
      return
    }
    setIsValidOpenMarket(false)
  }, [openMarketKey, selectedMarket])

  useEffect(() => {
    let timeoutId
    if (toast) timeoutId = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    loadSettings()
  }, [])

  const applyAuthResponse = (responseBody) => {
    if (responseBody.integrationType === 'PLAYAUTO') {
      isHydratingPlayautoRef.current = true
      setPlayautoKey(responseBody.apiKey || '')
      setPlayautoEmail(responseBody.email || '')
      setPlayautoPassword(responseBody.password || '')
    } else {
      isHydratingOpenMarketRef.current = true
      setSelectedMarket(responseBody.integrationType || '')
      setOpenMarketKey(responseBody.apiKey || '')
    }

    setAuthSavedAt(responseBody.authUpdatedAt ? new Date(responseBody.authUpdatedAt) : new Date())
  }

  const applyCollectionResponse = (responseBody) => {
    setCollectionValue(responseBody.collectionValue != null ? String(responseBody.collectionValue) : '')
    setCollectionUnit(responseBody.collectionUnit || 'DAY')
    setScheduleValue(responseBody.scheduleValue != null ? String(responseBody.scheduleValue) : '')
    setScheduleUnit(responseBody.scheduleUnit || 'DAY')
    setAutoCollectEnabled(Boolean(responseBody.autoCollectEnabled))
    setCollectionSavedAt(
      responseBody.collectionUpdatedAt ? new Date(responseBody.collectionUpdatedAt) : new Date(),
    )
    setLastOrderCollectedAt(
      responseBody.lastOrderCollectedAt ? new Date(responseBody.lastOrderCollectedAt) : null,
    )
  }

  const handleValidate = async (integrationType, apiKey) => {
    if (integrationType !== 'PLAYAUTO' && !integrationType) {
      showToast('마켓을 먼저 선택해주세요.', 'error')
      return
    }
    if (!apiKey) {
      showToast('API Key를 입력해주세요.', 'error')
      return
    }

    try {
      const body = { integrationType, apiKey }
      if (integrationType === 'PLAYAUTO') {
        body.email = playautoEmail
        body.password = playautoPassword
      }

      const response = await authorizedFetch(`${SETTINGS_API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        showToast(errorBody.message || '연동 검증에 실패했습니다.', 'error')
        return
      }

      if (integrationType === 'PLAYAUTO') setIsValidPlayauto(true)
      else setIsValidOpenMarket(true)

      showToast('연동 검증이 완료되었습니다.')
    } catch (error) {
      showToast(error.message || '서버 연결 중 오류가 발생했습니다.', 'error')
    }
  }

  const handleSaveAuth = async () => {
    setIsSavingAuth(true)
    try {
      if (playautoKey || playautoEmail || playautoPassword) {
        const response = await authorizedFetch(`${SETTINGS_API_BASE}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrationType: 'PLAYAUTO',
            apiKey: playautoKey,
            email: playautoEmail,
            password: playautoPassword,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new Error(errorBody.message || 'PlayAuto 인증 정보 저장에 실패했습니다.')
        }

        applyAuthResponse(await response.json())
      }

      if (selectedMarket && openMarketKey) {
        const response = await authorizedFetch(`${SETTINGS_API_BASE}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrationType: selectedMarket,
            apiKey: openMarketKey,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new Error(errorBody.message || '오픈마켓 인증 정보 저장에 실패했습니다.')
        }

        applyAuthResponse(await response.json())
      }

      showToast('인증 정보가 저장되었습니다.')
    } catch (error) {
      showToast(error.message || '인증 정보 저장에 실패했습니다.', 'error')
    } finally {
      setIsSavingAuth(false)
    }
  }

  const handleSaveCollection = async () => {
    setIsSavingCollection(true)
    try {
      const response = await authorizedFetch(`${SETTINGS_API_BASE}/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionUnit,
          collectionValue: Number(collectionValue),
          scheduleUnit,
          scheduleValue: Number(scheduleValue),
          autoCollectEnabled,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.message || '주문 수집 설정 저장에 실패했습니다.')
      }

      applyCollectionResponse(await response.json())
      showToast('주문 수집 설정이 저장되었습니다.')
    } catch (error) {
      showToast(error.message || '주문 수집 설정 저장에 실패했습니다.', 'error')
    } finally {
      setIsSavingCollection(false)
    }
  }

  const handleRunOrderCollection = async () => {
    if (isRunningOrderCollection) return
    setIsRunningOrderCollection(true)
    try {
      const response = await authorizedFetch(`${SETTINGS_API_BASE}/collection/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionUnit,
          collectionValue: Number(collectionValue),
          scheduleUnit,
          scheduleValue: Number(scheduleValue),
          autoCollectEnabled,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.message || '주문 수집 실행에 실패했습니다.')
      }

      await loadSettings()
      showToast('주문 수집이 완료되었습니다.')
    } catch (error) {
      showToast(error.message || '주문 수집 실행에 실패했습니다.', 'error')
    } finally {
      setIsRunningOrderCollection(false)
    }
  }

  const authReady = useMemo(
    () => Boolean(playautoKey && playautoEmail && playautoPassword),
    [playautoKey, playautoEmail, playautoPassword],
  )
  const collectionPeriodReady = useMemo(() => Number(collectionValue) > 0, [collectionValue])
  const scheduleReady = useMemo(() => Number(scheduleValue) > 0, [scheduleValue])
  const collectionReady = useMemo(
    () => Boolean(authReady && collectionPeriodReady && (!autoCollectEnabled || scheduleReady)),
    [authReady, collectionPeriodReady, autoCollectEnabled, scheduleReady],
  )
  const manualCollectionReady = useMemo(
    () => Boolean(authReady && collectionPeriodReady),
    [authReady, collectionPeriodReady],
  )

  const renderTabButton = (tab, label) => {
    const isActive = activeTab === tab
    const savedAt = tab === AUTH_TAB ? authSavedAt : collectionSavedAt
    const isConfigured = Boolean(savedAt)

    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`text-left text-2xl font-black tracking-tight transition-colors ${
          isActive ? 'text-slate-950' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span>{label}</span>
        <span
          className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-xs font-bold ${
            isConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isConfigured ? '저장됨' : '미설정'}
        </span>
        {savedAt && (
          <span className="ml-3 align-middle text-xs font-medium text-slate-400">
            {formatSavedAt(savedAt)}
          </span>
        )}
      </button>
    )
  }

  return (
    <main className={`min-h-screen p-8 transition-all duration-300 ${isExpanded ? 'ml-64' : 'ml-20'}`}>
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl px-6 py-4 font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          <span className="material-symbols-outlined">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">설정</h1>
          <p className="mt-2 text-sm text-slate-500">인증 정보와 주문 수집 설정을 분리해서 관리할 수 있습니다.</p>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 border-b border-slate-200 pb-5">
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-center gap-4">
                {renderTabButton(AUTH_TAB, '인증 정보')}
                <span className="text-3xl font-light text-slate-300">/</span>
                {renderTabButton(COLLECTION_TAB, '수집 설정')}
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              {activeTab === AUTH_TAB
                ? 'PlayAuto와 오픈마켓 연동 정보를 저장합니다.'
                : '주문 수집과 재고/출고량 수집을 각각 관리할 수 있습니다.'}
            </p>

            <div className="mt-3 text-xs font-medium text-slate-400">
              {activeTab === AUTH_TAB
                ? authSavedAt
                  ? `마지막 저장: ${formatSavedAt(authSavedAt)}`
                  : '아직 인증 정보가 저장되지 않았습니다.'
                : collectionSavedAt
                  ? `마지막 저장: ${formatSavedAt(collectionSavedAt)}`
                  : '아직 수집 설정이 저장되지 않았습니다.'}
            </div>
          </div>

          {activeTab === AUTH_TAB && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">PlayAuto 인증 정보</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      API Key, 이메일, 비밀번호를 입력한 뒤 연동 테스트를 진행해주세요.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 text-xs font-bold ${
                      isValidPlayauto ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isValidPlayauto ? '검증 완료' : '미검증'}
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">API Key</label>
                    <input
                      type="password"
                      value={playautoKey}
                      onChange={(event) => setPlayautoKey(event.target.value)}
                      placeholder="PlayAuto API Key"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">Email</label>
                    <input
                      type="email"
                      value={playautoEmail}
                      onChange={(event) => setPlayautoEmail(event.target.value)}
                      placeholder="email@example.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">Password</label>
                    <input
                      type="password"
                      value={playautoPassword}
                      onChange={(event) => setPlayautoPassword(event.target.value)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleValidate('PLAYAUTO', playautoKey)}
                      className="h-[50px] rounded-xl bg-slate-950 px-6 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      연동 테스트
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">오픈마켓 통합</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      오픈마켓 API Key 또는 Access Token을 입력하고 검증해주세요.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 text-xs font-bold ${
                      isValidOpenMarket ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isValidOpenMarket ? '검증 완료' : '미설정'}
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.4fr_280px_auto]">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">API Key / Access Token</label>
                    <input
                      type="password"
                      value={openMarketKey}
                      onChange={(event) => setOpenMarketKey(event.target.value)}
                      placeholder="오픈마켓 Access Token 입력"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">마켓</label>
                    <SelectField
                      value={selectedMarket}
                      onChange={(event) => setSelectedMarket(event.target.value)}
                      className="w-full"
                    >
                      <option value="">마켓 선택</option>
                      {MARKET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleValidate(selectedMarket, openMarketKey)}
                      className="h-[50px] rounded-xl bg-slate-950 px-6 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      연동 테스트
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleSaveAuth}
                  disabled={isSavingAuth || (!authReady && !(selectedMarket && openMarketKey))}
                  className={`rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                    isSavingAuth || (!authReady && !(selectedMarket && openMarketKey))
                      ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                      : 'bg-slate-950 text-white hover:bg-slate-800'
                  }`}
                >
                  {isSavingAuth ? '저장 중...' : '인증 정보 저장'}
                </button>
              </div>
            </div>
          )}

          {activeTab === COLLECTION_TAB && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">주문 수집</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      주문 수집 기간 기준으로 수동 실행할 수 있고, 자동 수집을 켜면 저장한 주기로 스케줄러가 주문을 수집합니다.
                    </p>
                  </div>

                  <label className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={autoCollectEnabled}
                      onChange={(event) => setAutoCollectEnabled(event.target.checked)}
                      disabled={isRunningOrderCollection}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span>주문 자동 수집 사용</span>
                  </label>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-5">
                    <label className="mb-3 block text-sm font-semibold text-slate-600">주문 수집 기간</label>
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="number"
                        min="1"
                        value={collectionValue}
                        onChange={(event) => setCollectionValue(event.target.value)}
                        disabled={isRunningOrderCollection}
                        placeholder="값을 입력하세요"
                        className={`w-32 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
                          isRunningOrderCollection ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''
                        }`}
                      />
                      <SelectField
                        value={collectionUnit}
                        onChange={(event) => setCollectionUnit(event.target.value)}
                        disabled={isRunningOrderCollection}
                        className="w-32"
                      >
                        {UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                      <button
                        type="button"
                        onClick={handleRunOrderCollection}
                        disabled={isRunningOrderCollection || !manualCollectionReady}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                          isRunningOrderCollection || !manualCollectionReady
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-slate-950 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isRunningOrderCollection ? '수집 중...' : '수집 실행'}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">예: 3일, 2주, 6개월</p>
                  </div>

                  <div className="rounded-2xl bg-white p-5">
                    <label className="mb-3 block text-sm font-semibold text-slate-600">주문 수집 주기</label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        min="1"
                        value={scheduleValue}
                        onChange={(event) => setScheduleValue(event.target.value)}
                        disabled={!autoCollectEnabled || isRunningOrderCollection}
                        placeholder="값을 입력하세요"
                        className={`w-32 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
                          autoCollectEnabled && !isRunningOrderCollection
                            ? 'bg-white text-slate-900'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      />
                      <SelectField
                        value={scheduleUnit}
                        onChange={(event) => setScheduleUnit(event.target.value)}
                        disabled={!autoCollectEnabled || isRunningOrderCollection}
                        className="w-32"
                      >
                        {UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      {autoCollectEnabled
                        ? '예: 1일마다, 1주마다, 1개월마다'
                        : '자동 수집을 켜야 주기 설정이 적용됩니다.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <div className="text-xl font-bold text-slate-900">최근 수집 실행 이력</div>
                </div>

                <div className="mt-4 space-y-3">
                  {collectionHistory.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                      아직 저장된 수집 실행 이력이 없습니다.
                    </div>
                  ) : (
                    collectionHistory.map((history) => (
                      <div key={history.id} className="rounded-xl border border-slate-200 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">
                                {HISTORY_JOB_LABELS[history.jobType] || history.jobType}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                  HISTORY_STATUS_STYLES[history.status] || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {HISTORY_STATUS_LABELS[history.status] || history.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">{formatHistoryMessage(history)}</p>
                          </div>

                          <div className="shrink-0 text-xs text-slate-400">
                            <div>
                              마지막 실행:{' '}
                              {history.finishedAt
                                ? formatDateTime(new Date(history.finishedAt))
                                : history.startedAt
                                  ? formatDateTime(new Date(history.startedAt))
                                  : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleSaveCollection}
                  disabled={isSavingCollection || isRunningOrderCollection || !collectionReady}
                  className={`rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                    isSavingCollection || isRunningOrderCollection || !collectionReady
                      ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                      : 'bg-slate-950 text-white hover:bg-slate-800'
                  }`}
                >
                  {isSavingCollection ? '저장 중...' : '주문 수집 설정 저장'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
