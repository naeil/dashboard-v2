import { useEffect, useState } from 'react'
import { getAdCredentials, saveAdCredentials } from '../../api/adCredentialApi'

const PLATFORMS = [
  {
    id: 'NAVER_SA',
    label: '네이버 검색광고',
    fields: [
      { key: 'customer_id', label: 'Customer ID' },
      { key: 'access_license', label: 'Access License' },
      { key: 'secret_key', label: 'Secret Key' },
    ],
  },
  {
    id: 'NAVER_API',
    label: '네이버 공식 API',
    fields: [
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client Secret' },
    ],
  },
  {
    id: 'META',
    label: '메타 광고',
    fields: [
      { key: 'app_id', label: 'App ID' },
      { key: 'app_secret', label: 'App Secret' },
      { key: 'access_token', label: 'Access Token' },
      { key: 'ad_account_id', label: 'Ad Account ID' },
    ],
  },
]

const fieldClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

export default function AdApiSettingsPage() {
  const [credentials, setCredentials] = useState({})
  const [forms, setForms] = useState({})
  const [saving, setSaving] = useState({})
  const [testResult, setTestResult] = useState({})

  useEffect(() => {
    getAdCredentials().then(res => {
      const data = res.data
      setCredentials(data)
      const initialForms = {}
      PLATFORMS.forEach(p => {
        initialForms[p.id] = {}
        p.fields.forEach(f => {
          initialForms[p.id][f.key] = data[p.id]?.[f.key] || ''
        })
      })
      setForms(initialForms)
    }).catch(console.error)
  }, [])

  const handleSave = async (platformId) => {
    setSaving(s => ({ ...s, [platformId]: true }))
    try {
      await saveAdCredentials(platformId, forms[platformId])
      setTestResult(r => ({ ...r, [platformId]: '저장 완료!' }))
      setTimeout(() => setTestResult(r => ({ ...r, [platformId]: '' })), 3000)
    } catch (e) {
      setTestResult(r => ({ ...r, [platformId]: '저장 실패: ' + e.message }))
    } finally {
      setSaving(s => ({ ...s, [platformId]: false }))
    }
  }

  const handleTest = (platformId) => {
    setTestResult(r => ({ ...r, [platformId]: '연결 테스트 중...' }))
    setTimeout(() => {
      setTestResult(r => ({ ...r, [platformId]: '연결 테스트 기능은 준비 중입니다.' }))
    }, 1000)
  }

  const updateField = (platformId, fieldKey, value) => {
    setForms(f => ({ ...f, [platformId]: { ...f[platformId], [fieldKey]: value } }))
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-black text-slate-950">광고 API 연동 설정</h1>
      <p className="text-sm text-slate-500">광고 플랫폼 API 인증 정보를 등록합니다. 저장된 키는 암호화되어 보관됩니다.</p>

      <div className="space-y-6">
        {PLATFORMS.map((platform) => (
          <div key={platform.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-950">{platform.label}</h2>
              {testResult[platform.id] && (
                <span className={`text-xs font-black ${testResult[platform.id].includes('완료') ? 'text-emerald-600' : testResult[platform.id].includes('실패') ? 'text-red-600' : 'text-blue-600'}`}>
                  {testResult[platform.id]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {platform.fields.map((field) => (
                <label key={field.key}>
                  <span className="mb-1 block text-xs font-black text-slate-500">{field.label}</span>
                  <input
                    type={field.key.includes('secret') || field.key.includes('token') ? 'password' : 'text'}
                    value={forms[platform.id]?.[field.key] || ''}
                    onChange={(e) => updateField(platform.id, field.key, e.target.value)}
                    className={fieldClass}
                    placeholder={`${field.label} 입력`}
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleSave(platform.id)}
                disabled={saving[platform.id]}
                className="h-9 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {saving[platform.id] ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => handleTest(platform.id)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
              >
                연결 테스트
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
