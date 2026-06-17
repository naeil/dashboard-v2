import { useState, useEffect, useCallback } from 'react'
import { getChannelCredentials, saveChannelCredentials, syncAllChannels, syncChannel } from '../../api/channelSyncApi'

const CHANNELS = [
  {
    type: 'SMARTSTORE',
    name: '스마트스토어',
    icon: '🛒',
    description: '네이버 스마트스토어 API 연동',
    fields: [
      { key: 'key1', label: 'Client ID', placeholder: '스마트스토어 Client ID 입력', type: 'text' },
      { key: 'key2', label: 'Client Secret', placeholder: '스마트스토어 Client Secret 입력', type: 'password' },
    ],
  },
  {
    type: 'COUPANG',
    name: '쿠팡',
    icon: '📦',
    description: '쿠팡 Wing API 연동',
    fields: [
      { key: 'key1', label: 'Access Key', placeholder: '쿠팡 Access Key 입력', type: 'text' },
      { key: 'key2', label: 'Secret Key', placeholder: '쿠팡 Secret Key 입력', type: 'password' },
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

function ChannelCard({ channel, credential, onSave, onSync, syncing }) {
  const [form, setForm] = useState({ key1: '', key2: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (credential) {
      setForm({
        key1: credential.credentialKey1 || '',
        key2: credential.credentialKey2 ? '****' : '',
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
          {syncing === channel.type ? '동기화 중...' : '지금 동기화'}
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

      {/* Info Banner */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
          <div>
            <strong>자동 동기화 안내:</strong> 매일 새벽 3시에 등록된 모든 채널의 매출 데이터가 자동으로 수집됩니다.
            수집된 데이터는 <strong>온라인 성과 탭</strong>에 자동으로 반영되며 인센티브 계산에 활용됩니다.
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
              syncing={syncing}
            />
          ))}
        </div>
      )}

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
            <div className="text-slate-500 mt-0.5">스마트스토어, 쿠팡, 아임웹</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="font-medium text-slate-700">저장 위치</div>
            <div className="text-slate-500 mt-0.5">온라인 성과 → 자동 저장</div>
          </div>
        </div>
      </div>
    </div>
  )
}
