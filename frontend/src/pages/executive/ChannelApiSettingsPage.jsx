import { useState, useEffect, useCallback } from 'react'
import { getChannelCredentials, saveChannelCredentials, syncAllChannels, syncChannel, syncDailyAll, syncDailyChannel, getOfflineSheetConfig, saveOfflineSheetConfig, pullOfflineSheet } from '../../api/channelSyncApi'

/* 오프라인 발주 구글시트 — 링크 저장 + 서버 직접 수집(매일 22:05 자동) */
function OfflineSheetSection() {
  const [sheetUrl, setSheetUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    getOfflineSheetConfig().then((c) => {
      setSavedUrl(c.sheetUrl || null)
      if (c.sheetUrl) setSheetUrl(c.sheetUrl)
    }).catch(() => {})
  }, [])

  const saveAndPull = async () => {
    setBusy(true)
    setResult(null)
    try {
      if (sheetUrl.trim() && sheetUrl.trim() !== savedUrl) {
        const saved = await saveOfflineSheetConfig(sheetUrl.trim())
        setSavedUrl('https://docs.google.com/spreadsheets/d/' + saved.sheetId + '/edit')
      }
      const res = await pullOfflineSheet()
      setResult(res)
    } catch (e) {
      setResult({ success: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            오프라인 발주 시트 → 실시간 매출 반영
          </h3>
          <p className="mt-0.5 text-xs text-amber-700">
            구글시트 링크를 저장하면 서버가 매일 22:05 자동으로 5개 탭(스토어·연구소·초이스·제로데이·냉장고)을 수집합니다.
            시트는 "링크가 있는 모든 사용자 보기" 공유 상태여야 합니다. 링크가 바뀌면 여기만 바꾸면 됩니다.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/... 시트 링크 붙여넣기"
          className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-400 focus:outline-none"
        />
        <button
          onClick={saveAndPull}
          disabled={busy || !sheetUrl.trim()}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[18px]${busy ? ' animate-spin' : ''}`}>{busy ? 'refresh' : 'download'}</span>
          {busy ? '수집 중...' : '저장하고 지금 당겨오기'}
        </button>
      </div>
      {result && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.success ? (
            <>
              <p className="font-semibold">수집 완료 — {result.ingested}행 반영{result.skipped > 0 ? `, ${result.skipped}행 제외` : ''}</p>
              {result.tabs && <p className="mt-1">{Object.entries(result.tabs).map(([t, v]) => `${t}: ${v}`).join(' · ')}</p>}
              {result.warning && <p className="mt-1 font-semibold text-amber-700">{result.warning}</p>}
            </>
          ) : (
            <p className="font-semibold">{result.message || '수집에 실패했습니다.'}</p>
          )}
        </div>
      )}
    </div>
  )
}

const CHANNELS = [
  {
    type: 'SMARTSTORE',
    name: '스마트스토어 (하이프리)',
    icon: '🛒',
    description: '하이프리 계정 — 네이버 커머스API 연동',
    fields: [
      { key: 'key1', label: 'Client ID', placeholder: '하이프리 계정 Client ID 입력', type: 'text' },
      { key: 'key2', label: 'Client Secret', placeholder: '하이프리 계정 Client Secret 입력', type: 'password' },
    ],
  },
  {
    type: 'SMARTSTORE_2',
    name: '스마트스토어 (국민한상)',
    icon: '🛒',
    description: '국민한상 계정 — 네이버 커머스API 연동',
    fields: [
      { key: 'key1', label: 'Client ID', placeholder: '국민한상 계정 Client ID 입력', type: 'text' },
      { key: 'key2', label: 'Client Secret', placeholder: '국민한상 계정 Client Secret 입력', type: 'password' },
    ],
  },
  {
    type: 'COUPANG',
    name: '쿠팡',
    icon: '📦',
    description: '쿠팡 Wing OpenAPI 연동 (Wing → 판매자정보 → 오픈API 키 발급)',
    fields: [
      { key: 'key1', label: 'Access Key', placeholder: '쿠팡 Access Key 입력', type: 'text' },
      { key: 'key2', label: 'Secret Key', placeholder: '쿠팡 Secret Key 입력', type: 'password' },
      { key: 'key3', label: '업체코드 (Vendor ID)', placeholder: 'A로 시작하는 업체코드 (예: A00123456)', type: 'text' },
    ],
  },
  {
    type: 'ELEVENST',
    name: '11번가',
    icon: '🛍️',
    description: '11번가 오픈API 연동 (셀러오피스 → 오픈API 키 발급)',
    fields: [
      { key: 'key1', label: 'OpenAPI Key', placeholder: '11번가 오픈API 키 입력', type: 'password' },
    ],
  },
  {
    type: 'IMWEB',
    name: '아임웹 (자사몰)',
    icon: '🏪',
    description: '아임웹 자사몰 API 연동',
    fields: [
      { key: 'key1', label: 'API Key', placeholder: '아임웹 API Key 입력', type: 'text' },
      { key: 'key2', label: 'Secret Key', placeholder: '아임웹 Secret Key 입력', type: 'password' },
    ],
  },
]

const STATUS_COLOR = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  ERROR: 'bg-red-100 text-red-700',
}

function formatDateTime(dt) {
  if (!dt) return '-'
  return new Date(dt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

function ChannelCard({ channel, credential, onSave, onSync, onDailySync, syncing }) {
  const [form, setForm] = useState({ key1: '', key2: '', key3: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (credential) {
      setForm({
        key1: credential.credentialKey1 || '',
        key2: credential.credentialKey2 ? '****' : '',
        key3: credential.credentialKey3 || '',
        isActive: credential.isActive !== false,
      })
    }
  }, [credential])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(channel.type, {
        key1: form.key1.includes('****') ? null : form.key1,
        key2: form.key2.includes('****') ? null : form.key2,
        key3: form.key3 && !form.key3.includes('****') ? form.key3 : null,
        isActive: form.isActive,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const lastSyncStatus = credential?.lastSyncStatus
  const badgeClass = STATUS_COLOR[lastSyncStatus] || 'bg-slate-100 text-slate-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{channel.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{channel.name}</h3>
            <p className="text-sm text-slate-500">{channel.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300"
            />
            활성화
          </label>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {channel.fields.map(field => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
            <div className="relative">
              <input
                type={field.type === 'password' && !showSecret ? 'password' : 'text'}
                value={form[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              {field.type === 'password' && (
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">{showSecret ? 'visibility_off' : 'visibility'}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
        </button>
        <button
          onClick={() => onSync(channel.type)}
          disabled={syncing === channel.type || !credential?.credentialKey1}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <span className={'material-symbols-outlined text-[16px]' + (syncing === channel.type ? ' animate-spin' : '')}>{syncing === channel.type ? 'refresh' : 'sync'}</span>
          {syncing === channel.type ? '동기화 중...' : '월 동기화'}
        </button>
        <button
          onClick={() => onDailySync(channel.type)}
          disabled={syncing !== null || !credential?.credentialKey1}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          title="선택한 기간의 일별 매출을 수집해 CFO·CEO 대시보드에 반영합니다"
        >
          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          일별 수집
        </button>
      </div>

      {credential && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span>마지막 동기화: {formatDateTime(credential.lastSyncAt)}</span>
            {lastSyncStatus && (
              <span className={`rounded-full px-2 py-0.5 font-medium ${badgeClass}`}>{lastSyncStatus}</span>
            )}
          </div>
          {credential.lastSyncMessage && (
            <p className="mt-1 text-slate-500 truncate">{credential.lastSyncMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}


export default function ChannelApiSettingsPage() {
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [dailyFrom, setDailyFrom] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dailyTo, setDailyTo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  const loadCredentials = useCallback(async () => {
    try {
      const data = await getChannelCredentials()
      setCredentials(data)
    } catch (e) {
      console.error('Failed to load credentials:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCredentials()
  }, [loadCredentials])

  const handleSave = async (channelType, payload) => {
    await saveChannelCredentials(channelType, payload)
    await loadCredentials()
  }

  const handleSyncOne = async (channelType) => {
    setSyncing(channelType)
    setSyncResult(null)
    try {
      const result = await syncChannel(channelType, selectedMonth)
      setSyncResult({ channel: channelType, ...result })
      await loadCredentials()
    } catch (e) {
      setSyncResult({ channel: channelType, success: false, message: e.message })
    } finally {
      setSyncing(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncing('ALL')
    setSyncResult(null)
    try {
      const result = await syncAllChannels(selectedMonth)
      setSyncResult({ channel: 'ALL', success: true, results: result.results })
      await loadCredentials()
    } catch (e) {
      setSyncResult({ channel: 'ALL', success: false, message: e.message })
    } finally {
      setSyncing(null)
    }
  }

  const handleDailySyncOne = async (channelType) => {
    setSyncing(channelType)
    setSyncResult(null)
    try {
      const result = await syncDailyChannel(channelType, dailyFrom, dailyTo)
      setSyncResult({ channel: channelType, ...result })
      await loadCredentials()
    } catch (e) {
      setSyncResult({ channel: channelType, success: false, message: e.message })
    } finally {
      setSyncing(null)
    }
  }

  const handleDailySyncAll = async () => {
    setSyncing('ALL_DAILY')
    setSyncResult(null)
    try {
      const result = await syncDailyAll(dailyFrom, dailyTo)
      setSyncResult({ channel: 'ALL', success: true, results: result.results })
      await loadCredentials()
    } catch (e) {
      setSyncResult({ channel: 'ALL', success: false, message: e.message })
    } finally {
      setSyncing(null)
    }
  }

  const getCredentialFor = (channelType) => credentials.find(c => c.channelType === channelType)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">채널 API 관리</h1>
          <p className="text-sm text-slate-500 mt-1">쇼핑몰 채널별 API 인증정보를 등록하고 매출 데이터를 자동으로 수집합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
          />
          <button
            onClick={handleSyncAll}
            disabled={syncing !== null}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px]${syncing === 'ALL' ? ' animate-spin' : ''}`}>
              {syncing === 'ALL' ? 'refresh' : 'sync'}
            </span>
            {syncing === 'ALL' ? '전체 동기화 중...' : '전체 채널 동기화'}
          </button>
        </div>
      </div>

      {/* 일별 수집 (CFO/CEO 대시보드 반영) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              일별 매출 수집 → CFO·CEO 대시보드 반영
            </h3>
            <p className="mt-0.5 text-xs text-emerald-700">
              기간을 선택해 일별 매출을 수집합니다 (최대 62일). 수집 데이터는 실무 입력의 매출 항목(자동수집)으로 저장됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dailyFrom}
              onChange={e => setDailyFrom(e.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
            />
            <span className="text-sm text-emerald-700">~</span>
            <input
              type="date"
              value={dailyTo}
              onChange={e => setDailyTo(e.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
            />
            <button
              onClick={handleDailySyncAll}
              disabled={syncing !== null}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              <span className={`material-symbols-outlined text-[18px]${syncing === 'ALL_DAILY' ? ' animate-spin' : ''}`}>
                {syncing === 'ALL_DAILY' ? 'refresh' : 'download'}
              </span>
              {syncing === 'ALL_DAILY' ? '수집 중...' : '전체 채널 일별 수집'}
            </button>
          </div>
        </div>
      </div>

      {/* 오프라인 발주 시트 직접 수집 */}
      <OfflineSheetSection />

      {/* Info Banner */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
          <div>
            <strong>자동 동기화 안내:</strong> 매일 새벽 3시에 등록된 모든 채널의 매출 데이터가 자동으로 수집됩니다 (최근 4일 일별 매출 포함).
            수집된 데이터는 <strong>CFO 재무관리 · CEO 전략 대시보드 · 온라인 성과</strong>에 자동 반영됩니다.
            자동수집 채널은 실무 입력에서 같은 채널 매출을 수기로 입력하지 마세요 (이중집계 방지).
          </div>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${syncResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {syncResult.success ? 'check_circle' : 'error'}
            </span>
            <div>
              {syncResult.results ? (
                <div>
                  <strong>전체 동기화 완료</strong>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(syncResult.results).map(([ch, res]) => (
                      <li key={ch}>{ch}: {res.success ? `✓ ${(res.salesAmount || 0).toLocaleString()}원` : `✗ ${res.message}`}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span>{syncResult.channel}: {syncResult.message}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Channel Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map(channel => (
            <ChannelCard
              key={channel.type}
              channel={channel}
              credential={getCredentialFor(channel.type)}
              onSave={handleSave}
              onSync={handleSyncOne}
              onDailySync={handleDailySyncOne}
              syncing={syncing}
            />
          ))}
        </div>
      )}

      {/* 네이버 IP 등록 안내 */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
        <h3 className="text-sm font-semibold text-sky-800 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">lan</span>
          스마트스토어 필수 설정 — API 호출 IP 등록
        </h3>
        <p className="text-sm text-sky-700">
          커머스API센터(apicenter.commerce.naver.com) → 내 애플리케이션 → <strong>API 호출 IP</strong>에 아래 서버 IP 대역을 등록해야
          인증이 통과됩니다 (미등록 시 <code>GW.IP_NOT_ALLOWED</code> 오류).
        </p>
        <div className="mt-2 flex gap-2">
          <code className="rounded bg-white px-2 py-1 text-sm text-sky-800 border border-sky-200">74.220.52.0/24</code>
          <code className="rounded bg-white px-2 py-1 text-sm text-sky-800 border border-sky-200">74.220.60.0/24</code>
        </div>
        <p className="mt-2 text-xs text-sky-600">
          대역(/24) 입력이 안 되는 경우 고정 IP(Render Dedicated IP) 추가가 필요합니다 — 관리자에게 문의.
        </p>
      </div>

      {/* 지마켓/옥션 (ESM) 안내 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">pending_actions</span>
          지마켓 · 옥션 (ESM) — API 키 발급 신청 필요
        </h3>
        <p className="text-sm text-amber-700">
          지마켓/옥션은 ESM Trading API 키를 <strong>이메일 심사</strong>로 발급합니다. 아래 내용을 담아
          <strong> etapihelp@gmail.com</strong>으로 신청하세요. 키가 발급되면 이 화면에 연동 카드가 추가됩니다.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-amber-700 list-disc pl-5">
          <li>필요 API 범위: 주문 조회 (RequestOrders)</li>
          <li>ESM PLUS 마스터 ID (ESM+ 로그인 계정)</li>
          <li>서비스 URL: https://naeil-dashboard.vercel.app</li>
          <li>최근 3개월 매출 규모</li>
        </ul>
      </div>

      {/* Schedule Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-sky-600">schedule</span>
          자동 동기화 스케줄
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="font-medium text-slate-700">실행 주기</div>
            <div className="text-slate-500 mt-0.5">매일 새벽 3:00 AM</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="font-medium text-slate-700">수집 대상</div>
            <div className="text-slate-500 mt-0.5">스마트스토어, 쿠팡, 11번가, 아임웹</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="font-medium text-slate-700">저장 위치</div>
            <div className="text-slate-500 mt-0.5">CFO·CEO 대시보드 + 온라인 성과</div>
          </div>
        </div>
      </div>
    </div>
  )
}
