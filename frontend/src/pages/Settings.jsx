import { useEffect, useMemo, useRef, useState } from 'react'
import { buildApiUrl } from '../api/apiBase'
import { authorizedFetch } from '../api/authApi'
import { AI_PROVIDER_CONFIGS, getAiProviderConfig, isAiProviderReady } from '../utils/aiProviderCatalog'
import { groupExternalIntegrations } from '../utils/externalIntegrationGroups'

const SETTINGS_API_BASE = buildApiUrl('/settings/integrations')
const AI_SETTINGS_API_BASE = buildApiUrl('/settings/ai')

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

const MARKET_TYPE_VALUES = new Set(MARKET_OPTIONS.map((option) => option.value))

const EXTERNAL_INTEGRATION_IDS = [
  'naver-search',
  'naver-blog',
  'naver-ad',
  'meta-ad',
  'daou-mail',
]

const createExternalState = (value) => Object.fromEntries(
  EXTERNAL_INTEGRATION_IDS.map((id) => [id, value]),
)

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

const KST_TIME_ZONE = 'Asia/Seoul'

const savedAtKstFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimeKstFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toKstDate(value) {
  if (!value) return null
  if (value instanceof Date) return value

  const normalizedValue =
    typeof value === 'string' && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value
  const parsedDate = new Date(normalizedValue)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function formatSavedAtKst(value) {
  const date = toKstDate(value)
  return date ? savedAtKstFormatter.format(date) : '-'
}

function formatDateTimeKst(value) {
  const date = toKstDate(value)
  return date ? dateTimeKstFormatter.format(date) : '-'
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

  const [naverSearchClientId, setNaverSearchClientId] = useState('')
  const [naverSearchClientSecret, setNaverSearchClientSecret] = useState('')
  const [naverBlogClientId, setNaverBlogClientId] = useState('')
  const [naverBlogClientSecret, setNaverBlogClientSecret] = useState('')
  const [naverBlogAccessToken, setNaverBlogAccessToken] = useState('')
  const [naverBlogId, setNaverBlogId] = useState('')
  const [naverAdCustomerId, setNaverAdCustomerId] = useState('')
  const [naverAdAccessLicense, setNaverAdAccessLicense] = useState('')
  const [naverAdSecretKey, setNaverAdSecretKey] = useState('')
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [metaAdAccountId, setMetaAdAccountId] = useState('')
  const [daouMailHost, setDaouMailHost] = useState('imap.daouoffice.com')
  const [daouMailUsername, setDaouMailUsername] = useState('')
  const [daouMailPassword, setDaouMailPassword] = useState('')
  const [selectedExternalIntegration, setSelectedExternalIntegration] = useState('naver-search')
  const [isNaverExpanded, setIsNaverExpanded] = useState(true)
  const [externalValidationStatus, setExternalValidationStatus] = useState(() => createExternalState('idle'))
  const [externalValidationMessage, setExternalValidationMessage] = useState(() => createExternalState(''))
  const [externalDirty, setExternalDirty] = useState(() => createExternalState(false))
  const [aiSettings, setAiSettings] = useState([])
  const [selectedAiProvider, setSelectedAiProvider] = useState('OPENAI')
  const [aiDisplayName, setAiDisplayName] = useState('OpenAI 기본')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiOrganizationId, setAiOrganizationId] = useState('')
  const [aiProjectId, setAiProjectId] = useState('')
  const [aiModelName, setAiModelName] = useState(getAiProviderConfig('OPENAI').models[0])
  const [aiValidationStatus, setAiValidationStatus] = useState('idle')
  const [aiValidationMessage, setAiValidationMessage] = useState('')
  const [aiDirty, setAiDirty] = useState(false)
  const [isValidatingAi, setIsValidatingAi] = useState(false)
  const [isSavingAi, setIsSavingAi] = useState(false)

  const [isValidPlayauto, setIsValidPlayauto] = useState(false)
  const [isValidOpenMarket, setIsValidOpenMarket] = useState(false)
  const [isSavingAuth, setIsSavingAuth] = useState(false)
  const [isSavingCollection, setIsSavingCollection] = useState(false)
  const [isRunningOrderCollection, setIsRunningOrderCollection] = useState(false)
  const [isSyncingShops, setIsSyncingShops] = useState(false)
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
      const [response, historyResponse, aiResponse] = await Promise.all([
        authorizedFetch(SETTINGS_API_BASE),
        authorizedFetch(`${SETTINGS_API_BASE}/history?integrationType=PLAYAUTO&limit=10`),
        authorizedFetch(AI_SETTINGS_API_BASE),
      ])

      if (!response.ok) return

      const settings = await response.json()
      const playauto = settings.find((item) => item.integrationType === 'PLAYAUTO')
      const market = settings.find((item) => MARKET_TYPE_VALUES.has(item.integrationType))
      const naverSearch = settings.find((item) => item.integrationType === 'NAVER_SEARCH')
      const naverBlog = settings.find((item) => item.integrationType === 'NAVER_BLOG')
      const naverAd = settings.find((item) => item.integrationType === 'NAVER_AD')
      const metaAds = settings.find((item) => item.integrationType === 'META_ADS')
      const daouMail = settings.find((item) => item.integrationType === 'DAOU_MAIL')

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
        setAuthSavedAt(toKstDate(playauto.authUpdatedAt))
        setCollectionSavedAt(toKstDate(playauto.collectionUpdatedAt))
        setLastOrderCollectedAt(toKstDate(playauto.lastOrderCollectedAt))
      }

      if (market) {
        isHydratingOpenMarketRef.current = true
        setSelectedMarket(market.integrationType || '')
        setOpenMarketKey(market.apiKey || '')
        setIsValidOpenMarket(Boolean(market.apiKey))
        if (market.authUpdatedAt && !playauto?.authUpdatedAt) {
          setAuthSavedAt(toKstDate(market.authUpdatedAt))
        }
      }

      if (naverSearch) {
        setNaverSearchClientId(naverSearch.apiKey || '')
        setNaverSearchClientSecret(naverSearch.password || '')
      }

      if (naverBlog) {
        setNaverBlogClientId(naverBlog.apiKey || '')
        setNaverBlogClientSecret(naverBlog.password || '')
        setNaverBlogAccessToken(naverBlog.email || '')
        setNaverBlogId(naverBlog.extraValue || '')
      }

      if (naverAd) {
        setNaverAdCustomerId(naverAd.apiKey || '')
        setNaverAdAccessLicense(naverAd.email || '')
        setNaverAdSecretKey(naverAd.password || '')
      }

      if (metaAds) {
        setMetaAccessToken(metaAds.apiKey || '')
        setMetaAdAccountId(metaAds.email || '')
      }

      if (daouMail) {
        setDaouMailHost(daouMail.apiKey || 'imap.daouoffice.com')
        setDaouMailUsername(daouMail.email || '')
        setDaouMailPassword(daouMail.password || '')
      }

      if (historyResponse.ok) {
        const history = await historyResponse.json()
        setCollectionHistory(history || [])
      }

      if (aiResponse.ok) {
        const savedAiSettings = await aiResponse.json()
        setAiSettings(savedAiSettings || [])
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
    const provider = getAiProviderConfig(selectedAiProvider)
    const saved = aiSettings.find((setting) => setting.provider === selectedAiProvider)
    setAiDisplayName(saved?.displayName || `${provider.label} 기본`)
    setAiModelName(saved?.modelName || provider.models[0])
    setAiApiKey('')
    setAiOrganizationId('')
    setAiProjectId('')
    setAiValidationStatus(saved?.validatedAt ? 'saved' : 'idle')
    setAiValidationMessage(saved?.validatedAt ? '저장된 인증 정보가 있습니다. 변경하려면 새 API Key를 입력 후 다시 테스트해주세요.' : '')
    setAiDirty(false)
  }, [selectedAiProvider, aiSettings])

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
    } else if (responseBody.integrationType === 'NAVER_SEARCH') {
      setNaverSearchClientId(responseBody.apiKey || '')
      setNaverSearchClientSecret(responseBody.password || '')
    } else if (responseBody.integrationType === 'NAVER_BLOG') {
      setNaverBlogClientId(responseBody.apiKey || '')
      setNaverBlogClientSecret(responseBody.password || '')
      setNaverBlogAccessToken(responseBody.email || '')
      setNaverBlogId(responseBody.extraValue || '')
    } else if (responseBody.integrationType === 'NAVER_AD') {
      setNaverAdCustomerId(responseBody.apiKey || '')
      setNaverAdAccessLicense(responseBody.email || '')
      setNaverAdSecretKey(responseBody.password || '')
    } else if (responseBody.integrationType === 'META_ADS') {
      setMetaAccessToken(responseBody.apiKey || '')
      setMetaAdAccountId(responseBody.email || '')
    } else if (responseBody.integrationType === 'DAOU_MAIL') {
      setDaouMailHost(responseBody.apiKey || 'imap.daouoffice.com')
      setDaouMailUsername(responseBody.email || '')
      setDaouMailPassword(responseBody.password || '')
    } else {
      isHydratingOpenMarketRef.current = true
      setSelectedMarket(responseBody.integrationType || '')
      setOpenMarketKey(responseBody.apiKey || '')
    }

    setAuthSavedAt(toKstDate(responseBody.authUpdatedAt) || new Date())
  }

  const saveAuthPayload = async (payload, fallbackMessage) => {
    const response = await authorizedFetch(`${SETTINGS_API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.message || fallbackMessage)
    }

    applyAuthResponse(await response.json())
  }

  const markExternalCredentialChanged = (integrationId, setter, value) => {
    setter(value)
    setExternalDirty((current) => ({ ...current, [integrationId]: true }))
    setExternalValidationStatus((current) => ({ ...current, [integrationId]: 'idle' }))
    setExternalValidationMessage((current) => ({ ...current, [integrationId]: '' }))
  }

  const markAiChanged = (setter, value) => {
    setter(value)
    setAiDirty(true)
    setAiValidationStatus('idle')
    setAiValidationMessage('')
  }

  const getAiValidationPayload = () => ({
    provider: selectedAiProvider,
    displayName: aiDisplayName,
    modelName: aiModelName,
    apiKey: aiApiKey,
    organizationId: aiOrganizationId,
    projectId: aiProjectId,
  })

  const handleValidateAi = async () => {
    const provider = getAiProviderConfig(selectedAiProvider)
    if (!isAiProviderReady(selectedAiProvider, { apiKey: aiApiKey })) {
      showToast(`${provider.label} API Key를 입력해주세요.`, 'error')
      return
    }

    setIsValidatingAi(true)
    setAiValidationStatus('checking')
    setAiValidationMessage('AI 인증 정보를 확인하고 있습니다.')
    try {
      const response = await authorizedFetch(`${AI_SETTINGS_API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAiValidationPayload()),
      })
      const responseBody = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = responseBody.message || 'AI 인증 정보 검증에 실패했습니다.'
        setAiValidationStatus('error')
        setAiValidationMessage(message)
        showToast(message, 'error')
        return
      }

      setAiValidationStatus('success')
      setAiValidationMessage(responseBody.message || 'AI 인증 정보가 확인되었습니다.')
      showToast('AI 인증 테스트가 완료되었습니다.')
    } catch (error) {
      const message = error.message || 'AI 인증 테스트 중 오류가 발생했습니다.'
      setAiValidationStatus('error')
      setAiValidationMessage(message)
      showToast(message, 'error')
    } finally {
      setIsValidatingAi(false)
    }
  }

  const handleSaveAi = async () => {
    if (aiValidationStatus !== 'success') {
      showToast('AI 인증 테스트를 먼저 완료해주세요.', 'error')
      return
    }

    setIsSavingAi(true)
    try {
      const response = await authorizedFetch(AI_SETTINGS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAiValidationPayload()),
      })
      const responseBody = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responseBody.message || 'AI 설정 저장에 실패했습니다.')
      }

      setAiSettings((current) => {
        const others = current.filter((setting) => setting.provider !== responseBody.provider)
        return [...others, responseBody]
      })
      setAiValidationStatus('saved')
      setAiValidationMessage('AI 설정이 저장되었습니다. API Key는 암호화되어 보관됩니다.')
      setAiDirty(false)
      setAiApiKey('')
      showToast('AI 설정이 저장되었습니다.')
    } catch (error) {
      showToast(error.message || 'AI 설정 저장에 실패했습니다.', 'error')
    } finally {
      setIsSavingAi(false)
    }
  }

  const getExternalValidationPayload = (integrationId) => {
    switch (integrationId) {
      case 'naver-search':
        return {
          integrationType: 'NAVER_SEARCH',
          apiKey: naverSearchClientId,
          password: naverSearchClientSecret,
        }
      case 'naver-blog':
        return {
          integrationType: 'NAVER_BLOG',
          apiKey: naverBlogClientId,
          email: naverBlogAccessToken,
          password: naverBlogClientSecret,
          extraValue: naverBlogId,
        }
      case 'naver-ad':
        return {
          integrationType: 'NAVER_AD',
          apiKey: naverAdCustomerId,
          email: naverAdAccessLicense,
          password: naverAdSecretKey,
        }
      case 'meta-ad':
        return {
          integrationType: 'META_ADS',
          apiKey: metaAccessToken,
          email: metaAdAccountId,
        }
      case 'daou-mail':
        return {
          integrationType: 'DAOU_MAIL',
          apiKey: daouMailHost,
          email: daouMailUsername,
          password: daouMailPassword,
        }
      default:
        return null
    }
  }

  const handleValidateExternal = async () => {
    const integrationId = selectedExternalIntegration
    const payload = getExternalValidationPayload(integrationId)
    const integration = externalIntegrations.find((item) => item.id === integrationId)

    if (!payload || !integration?.configured) {
      showToast('필수 인증 정보를 모두 입력해주세요.', 'error')
      return
    }

    setExternalValidationStatus((current) => ({ ...current, [integrationId]: 'checking' }))
    setExternalValidationMessage((current) => ({ ...current, [integrationId]: '연결을 확인하고 있습니다.' }))

    try {
      const response = await authorizedFetch(`${SETTINGS_API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responseBody = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = responseBody.message || '인증 정보 검증에 실패했습니다.'
        setExternalValidationStatus((current) => ({ ...current, [integrationId]: 'error' }))
        setExternalValidationMessage((current) => ({ ...current, [integrationId]: message }))
        showToast(message, 'error')
        return
      }

      setExternalValidationStatus((current) => ({ ...current, [integrationId]: 'success' }))
      setExternalValidationMessage((current) => ({ ...current, [integrationId]: '현재 입력값으로 연동할 수 있습니다.' }))
      showToast('외부 서비스 연동 검증이 완료되었습니다.')
    } catch (error) {
      const message = error.message || '서버 연결 중 오류가 발생했습니다.'
      setExternalValidationStatus((current) => ({ ...current, [integrationId]: 'error' }))
      setExternalValidationMessage((current) => ({ ...current, [integrationId]: message }))
      showToast(message, 'error')
    }
  }

  const applyCollectionResponse = (responseBody) => {
    setCollectionValue(responseBody.collectionValue != null ? String(responseBody.collectionValue) : '')
    setCollectionUnit(responseBody.collectionUnit || 'DAY')
    setScheduleValue(responseBody.scheduleValue != null ? String(responseBody.scheduleValue) : '')
    setScheduleUnit(responseBody.scheduleUnit || 'DAY')
    setAutoCollectEnabled(Boolean(responseBody.autoCollectEnabled))
    setCollectionSavedAt(toKstDate(responseBody.collectionUpdatedAt) || new Date())
    setLastOrderCollectedAt(toKstDate(responseBody.lastOrderCollectedAt))
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
    const hasPlayautoInput = Boolean(playautoKey || playautoEmail || playautoPassword)
    const hasOpenMarketInput = Boolean(selectedMarket || openMarketKey)
    const unvalidatedExternalId = EXTERNAL_INTEGRATION_IDS.find(
      (id) => externalDirty[id] && externalValidationStatus[id] !== 'success',
    )

    if (hasPlayautoInput && !isValidPlayauto) {
      showToast('PlayAuto 연동 테스트를 먼저 완료해주세요.', 'error')
      return
    }
    if (hasOpenMarketInput && !isValidOpenMarket) {
      showToast('오픈마켓 연동 테스트를 먼저 완료해주세요.', 'error')
      return
    }
    if (unvalidatedExternalId) {
      setSelectedExternalIntegration(unvalidatedExternalId)
      showToast('변경한 외부 서비스의 연동 테스트를 먼저 완료해주세요.', 'error')
      return
    }

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

      for (const integrationId of EXTERNAL_INTEGRATION_IDS.filter((id) => externalDirty[id])) {
        const payload = getExternalValidationPayload(integrationId)
        const integration = externalIntegrations.find((item) => item.id === integrationId)
        await saveAuthPayload(
          payload,
          `${integration?.group || '외부 서비스'} ${integration?.name || ''} 인증 정보 저장에 실패했습니다.`,
        )
        setExternalDirty((current) => ({ ...current, [integrationId]: false }))
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

  const handleSyncShops = async () => {
    if (isSyncingShops) return
    setIsSyncingShops(true)
    try {
      const response = await authorizedFetch(`${SETTINGS_API_BASE}/shops/sync`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.message || '쇼핑몰 정보 업데이트에 실패했습니다.')
      }

      await loadSettings()
      showToast('쇼핑몰 정보를 업데이트했습니다.')
    } catch (error) {
      showToast(error.message || '쇼핑몰 정보 업데이트에 실패했습니다.', 'error')
    } finally {
      setIsSyncingShops(false)
    }
  }

  const authReady = useMemo(
    () => Boolean(playautoKey && playautoEmail && playautoPassword),
    [playautoKey, playautoEmail, playautoPassword],
  )
  const externalIntegrations = [
    {
      id: 'naver-search',
      integrationType: 'NAVER_SEARCH',
      group: 'NAVER',
      name: '검색 API',
      description: '검색 결과와 키워드 데이터를 조회합니다.',
      icon: 'search',
      configured: Boolean(naverSearchClientId && naverSearchClientSecret),
    },
    {
      id: 'naver-blog',
      integrationType: 'NAVER_BLOG',
      group: 'NAVER',
      name: '블로그 API',
      description: 'NAVER 공식 글쓰기 API 지원이 종료되어 현재 인증 테스트와 자동 발행을 사용할 수 없습니다.',
      icon: 'article',
      configured: Boolean(naverBlogClientId && naverBlogClientSecret && naverBlogAccessToken && naverBlogId),
    },
    {
      id: 'naver-ad',
      integrationType: 'NAVER_AD',
      group: 'NAVER',
      name: '검색 광고 API',
      description: '네이버 광고 계정과 성과 데이터를 연결합니다.',
      icon: 'campaign',
      configured: Boolean(naverAdCustomerId && naverAdAccessLicense && naverAdSecretKey),
    },
    {
      id: 'meta-ad',
      integrationType: 'META_ADS',
      group: 'META',
      name: '광고 API',
      description: 'Meta 광고 계정과 캠페인 데이터를 연결합니다.',
      icon: 'ads_click',
      configured: Boolean(metaAccessToken && metaAdAccountId),
    },
    {
      id: 'daou-mail',
      integrationType: 'DAOU_MAIL',
      group: 'MAIL',
      name: '다우오피스 메일',
      description: '업무 메일을 수신하고 대시보드에 표시합니다.',
      icon: 'mail',
      configured: Boolean(daouMailHost && daouMailUsername && daouMailPassword),
    },
  ]
  const groupedExternalIntegrations = groupExternalIntegrations(externalIntegrations)
  const selectedIntegration = externalIntegrations.find((item) => item.id === selectedExternalIntegration) || externalIntegrations[0]
  const configuredIntegrationCount = externalIntegrations.filter((item) => item.configured).length
  const selectedExternalStatus = externalValidationStatus[selectedExternalIntegration]
  const selectedExternalMessage = externalValidationMessage[selectedExternalIntegration]
  const selectedAiConfig = getAiProviderConfig(selectedAiProvider)
  const selectedSavedAiSetting = aiSettings.find((setting) => setting.provider === selectedAiProvider)
  const aiCanValidate = isAiProviderReady(selectedAiProvider, { apiKey: aiApiKey }) && Boolean(aiModelName)
  const aiCanSave = aiValidationStatus === 'success' && aiDirty && !isSavingAi
  const hasDirtyExternalIntegration = EXTERNAL_INTEGRATION_IDS.some((id) => externalDirty[id])
  const hasUnvalidatedExternalChange = EXTERNAL_INTEGRATION_IDS.some(
    (id) => externalDirty[id] && externalValidationStatus[id] !== 'success',
  )
  const hasPlayautoInput = Boolean(playautoKey || playautoEmail || playautoPassword)
  const hasOpenMarketInput = Boolean(selectedMarket || openMarketKey)
  const authSaveDisabled = Boolean(
    isSavingAuth
    || (hasPlayautoInput && !isValidPlayauto)
    || (hasOpenMarketInput && !isValidOpenMarket)
    || hasUnvalidatedExternalChange
    || (!hasPlayautoInput && !hasOpenMarketInput && !hasDirtyExternalIntegration),
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
            {formatSavedAtKst(savedAt)}
          </span>
        )}
      </button>
    )
  }

  return (
    <main className="min-h-screen transition-all duration-300">
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
          <h1 className="text-2xl font-black tracking-tight text-slate-950">설정</h1>
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

            {activeTab === COLLECTION_TAB && (
              <>
                <p className="mt-4 text-sm text-slate-500">
                  주문 수집과 재고/출고량 수집을 각각 관리할 수 있습니다.
                </p>
                <div className="mt-3 text-xs font-medium text-slate-400">
                  {collectionSavedAt
                    ? `마지막 저장: ${formatSavedAtKst(collectionSavedAt)}`
                    : '아직 수집 설정이 저장되지 않았습니다.'}
                </div>
              </>
            )}
          </div>

          {activeTab === AUTH_TAB && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
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

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
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

              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">AI 모델 설정</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      OpenAI, Claude, Gemini 인증 정보를 검증한 뒤 사용할 모델을 저장합니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                      저장됨 {aiSettings.length}개
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-500">
                      사용 가능 {AI_PROVIDER_CONFIGS.length}개
                    </span>
                  </div>
                </div>

                <div className="grid min-h-[420px] lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
                    <div className="space-y-2">
                      {AI_PROVIDER_CONFIGS.map((provider) => {
                        const active = selectedAiProvider === provider.id
                        const saved = aiSettings.some((setting) => setting.provider === provider.id)
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setSelectedAiProvider(provider.id)}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                              active
                                ? 'border-sky-200 bg-white text-slate-950 shadow-sm'
                                : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                            }`}
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black ${
                              active ? 'bg-sky-50 text-sky-600' : 'bg-white text-slate-400'
                            }`}>
                              {provider.badge}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-black tracking-[0.12em] text-slate-400">AI PROVIDER</span>
                              <span className="mt-0.5 block truncate text-sm font-black">{provider.label}</span>
                            </span>
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              saved ? 'bg-emerald-500' : 'bg-slate-300'
                            }`} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-sky-600">AI</p>
                        <h4 className="mt-2 text-2xl font-black text-slate-950">{selectedAiConfig.label}</h4>
                        <p className="mt-2 text-sm font-medium text-slate-500">{selectedAiConfig.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                        aiValidationStatus === 'success' || aiValidationStatus === 'saved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : aiValidationStatus === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : aiValidationStatus === 'checking'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-slate-100 text-slate-500'
                      }`}>
                        {aiValidationStatus === 'success'
                          ? '검증 완료'
                          : aiValidationStatus === 'saved'
                            ? '저장됨'
                            : aiValidationStatus === 'error'
                              ? '검증 실패'
                              : aiValidationStatus === 'checking'
                                ? '검증 중'
                                : selectedSavedAiSetting ? '저장됨' : '미설정'}
                      </span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label>
                        <span className="mb-2 block text-sm font-bold text-slate-700">설정 이름</span>
                        <input
                          type="text"
                          value={aiDisplayName}
                          onChange={(event) => markAiChanged(setAiDisplayName, event.target.value)}
                          placeholder={`${selectedAiConfig.label} 기본`}
                          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-bold text-slate-700">모델</span>
                        <SelectField
                          value={aiModelName}
                          onChange={(event) => markAiChanged(setAiModelName, event.target.value)}
                          className="w-full"
                        >
                          {selectedAiConfig.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </SelectField>
                      </label>

                      <label className="md:col-span-2">
                        <span className="mb-2 block text-sm font-bold text-slate-700">API Key</span>
                        <input
                          type="password"
                          value={aiApiKey}
                          onChange={(event) => markAiChanged(setAiApiKey, event.target.value)}
                          placeholder={selectedSavedAiSetting?.apiKeyMasked || `${selectedAiConfig.label} API Key 입력`}
                          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>

                      {selectedAiProvider === 'OPENAI' && (
                        <>
                          <label>
                            <span className="mb-2 block text-sm font-bold text-slate-700">Organization ID 선택</span>
                            <input
                              type="text"
                              value={aiOrganizationId}
                              onChange={(event) => markAiChanged(setAiOrganizationId, event.target.value)}
                              placeholder={selectedSavedAiSetting?.organizationIdMasked || 'org_...'}
                              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                          </label>
                          <label>
                            <span className="mb-2 block text-sm font-bold text-slate-700">Project ID 선택</span>
                            <input
                              type="text"
                              value={aiProjectId}
                              onChange={(event) => markAiChanged(setAiProjectId, event.target.value)}
                              placeholder={selectedSavedAiSetting?.projectIdMasked || 'proj_...'}
                              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                          </label>
                        </>
                      )}

                      {selectedAiProvider === 'CLAUDE' && (
                        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                          Claude API 버전은 백엔드에서 {selectedAiConfig.apiVersion} 값으로 고정합니다.
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className={`flex min-h-6 items-center gap-2 text-sm font-bold ${
                        aiValidationStatus === 'success' || aiValidationStatus === 'saved'
                          ? 'text-emerald-600'
                          : aiValidationStatus === 'error'
                            ? 'text-rose-600'
                            : 'text-slate-400'
                      }`}>
                        {aiValidationMessage && (
                          <>
                            <span className="material-symbols-outlined text-lg">
                              {aiValidationStatus === 'success' || aiValidationStatus === 'saved'
                                ? 'check_circle'
                                : aiValidationStatus === 'error'
                                  ? 'error'
                                  : 'hourglass_top'}
                            </span>
                            <span>{aiValidationMessage}</span>
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleValidateAi}
                          disabled={!aiCanValidate || isValidatingAi}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors ${
                            !aiCanValidate || isValidatingAi
                              ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                              : 'bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">sync</span>
                          {isValidatingAi ? '테스트 중...' : '인증 테스트'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAi}
                          disabled={!aiCanSave}
                          className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold transition-colors ${
                            !aiCanSave
                              ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                              : 'bg-slate-950 text-white hover:bg-slate-800'
                          }`}
                        >
                          {isSavingAi ? '저장 중...' : 'AI 설정 저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">외부 서비스 연동</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      네이버, Meta, 메일 서비스의 인증 정보를 한 곳에서 관리합니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">연결됨 {configuredIntegrationCount}개</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-500">설정 필요 {externalIntegrations.length - configuredIntegrationCount}개</span>
                  </div>
                </div>

                <div className="grid min-h-[420px] lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
                    <div className="space-y-1">
                      {groupedExternalIntegrations.map((item) => {
                        if (item.children) {
                          const naverActive = item.children.some(
                            (integration) => integration.id === selectedExternalIntegration,
                          )

                          return (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-white">
                              <button
                                type="button"
                                onClick={() => setIsNaverExpanded((expanded) => !expanded)}
                                aria-expanded={isNaverExpanded}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                                  naverActive ? 'text-slate-950' : 'text-slate-600 hover:text-slate-950'
                                }`}
                              >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#03c75a] text-base font-black text-white">
                                  N
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[11px] font-black tracking-[0.12em] text-[#03a94f]">SERVICE</span>
                                  <span className="mt-0.5 block text-sm font-black">{item.label}</span>
                                </span>
                                <span
                                  className={`material-symbols-outlined text-xl text-slate-400 transition-transform ${
                                    isNaverExpanded ? 'rotate-180' : ''
                                  }`}
                                >
                                  expand_more
                                </span>
                              </button>

                              {isNaverExpanded && (
                                <div className="space-y-1 border-t border-slate-100 p-2">
                                  {item.children.map((integration) => {
                                    const active = selectedExternalIntegration === integration.id
                                    return (
                                      <button
                                        key={integration.id}
                                        type="button"
                                        onClick={() => setSelectedExternalIntegration(integration.id)}
                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                          active
                                            ? 'bg-sky-50 text-slate-950'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                        }`}
                                      >
                                        <span className={`material-symbols-outlined grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${
                                          active ? 'bg-white text-sky-600 shadow-sm' : 'bg-slate-50 text-slate-400'
                                        }`}>
                                          {integration.icon}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{integration.name}</span>
                                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                          externalValidationStatus[integration.id] === 'success'
                                            ? 'bg-emerald-500'
                                            : externalValidationStatus[integration.id] === 'error'
                                              ? 'bg-rose-500'
                                              : integration.configured
                                                ? 'bg-sky-400'
                                                : 'bg-slate-300'
                                        }`} />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        }

                        const active = selectedExternalIntegration === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedExternalIntegration(item.id)}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                              active
                                ? 'border-sky-200 bg-white text-slate-950 shadow-sm'
                                : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                            }`}
                          >
                            <span className={`material-symbols-outlined grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl ${active ? 'bg-sky-50 text-sky-600' : 'bg-white text-slate-400'}`}>
                              {item.icon}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-black tracking-[0.12em] text-slate-400">{item.group}</span>
                              <span className="mt-0.5 block truncate text-sm font-black">{item.name}</span>
                            </span>
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              externalValidationStatus[item.id] === 'success'
                                ? 'bg-emerald-500'
                                : externalValidationStatus[item.id] === 'error'
                                  ? 'bg-rose-500'
                                  : item.configured
                                    ? 'bg-sky-400'
                                    : 'bg-slate-300'
                            }`} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-sky-600">{selectedIntegration.group}</p>
                        <h4 className="mt-2 text-2xl font-black text-slate-950">{selectedIntegration.name}</h4>
                        <p className="mt-2 text-sm font-medium text-slate-500">{selectedIntegration.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                        selectedExternalStatus === 'success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : selectedExternalStatus === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : selectedExternalStatus === 'checking'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedExternalStatus === 'success'
                          ? '검증 완료'
                          : selectedExternalStatus === 'error'
                            ? '검증 실패'
                            : selectedExternalStatus === 'checking'
                              ? '검증 중'
                              : selectedIntegration.configured ? '미검증' : '미설정'}
                      </span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      {selectedExternalIntegration === 'naver-search' && <>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Client ID</span><input type="text" value={naverSearchClientId} onChange={(event) => markExternalCredentialChanged('naver-search', setNaverSearchClientId, event.target.value)} placeholder="Client ID 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Client Secret</span><input type="password" value={naverSearchClientSecret} onChange={(event) => markExternalCredentialChanged('naver-search', setNaverSearchClientSecret, event.target.value)} placeholder="Client Secret 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                      </>}
                      {selectedExternalIntegration === 'naver-blog' && <>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Client ID</span><input type="text" value={naverBlogClientId} onChange={(event) => markExternalCredentialChanged('naver-blog', setNaverBlogClientId, event.target.value)} placeholder="Client ID 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Client Secret</span><input type="password" value={naverBlogClientSecret} onChange={(event) => markExternalCredentialChanged('naver-blog', setNaverBlogClientSecret, event.target.value)} placeholder="Client Secret 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Access Token</span><input type="password" value={naverBlogAccessToken} onChange={(event) => markExternalCredentialChanged('naver-blog', setNaverBlogAccessToken, event.target.value)} placeholder="Access Token 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Blog ID</span><input type="text" value={naverBlogId} onChange={(event) => markExternalCredentialChanged('naver-blog', setNaverBlogId, event.target.value)} placeholder="Blog ID 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                      </>}
                      {selectedExternalIntegration === 'naver-ad' && <>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Customer ID</span><input type="text" value={naverAdCustomerId} onChange={(event) => markExternalCredentialChanged('naver-ad', setNaverAdCustomerId, event.target.value)} placeholder="Customer ID 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Access License</span><input type="password" value={naverAdAccessLicense} onChange={(event) => markExternalCredentialChanged('naver-ad', setNaverAdAccessLicense, event.target.value)} placeholder="Access License 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label className="md:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Secret Key</span><input type="password" value={naverAdSecretKey} onChange={(event) => markExternalCredentialChanged('naver-ad', setNaverAdSecretKey, event.target.value)} placeholder="Secret Key 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                      </>}
                      {selectedExternalIntegration === 'meta-ad' && <>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Access Token</span><input type="password" value={metaAccessToken} onChange={(event) => markExternalCredentialChanged('meta-ad', setMetaAccessToken, event.target.value)} placeholder="Access Token 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">Ad Account ID</span><input type="text" value={metaAdAccountId} onChange={(event) => markExternalCredentialChanged('meta-ad', setMetaAdAccountId, event.target.value)} placeholder="Ad Account ID 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                      </>}
                      {selectedExternalIntegration === 'daou-mail' && <>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">IMAP 서버</span><input type="text" value={daouMailHost} onChange={(event) => markExternalCredentialChanged('daou-mail', setDaouMailHost, event.target.value)} placeholder="imap.daouoffice.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-700">메일 아이디</span><input type="text" value={daouMailUsername} onChange={(event) => markExternalCredentialChanged('daou-mail', setDaouMailUsername, event.target.value)} placeholder="메일 아이디 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                        <label className="md:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">메일 비밀번호</span><input type="password" value={daouMailPassword} onChange={(event) => markExternalCredentialChanged('daou-mail', setDaouMailPassword, event.target.value)} placeholder="메일 비밀번호 입력" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /></label>
                      </>}
                    </div>

                    <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className={`flex min-h-6 items-center gap-2 text-sm font-bold ${
                        selectedExternalStatus === 'success'
                          ? 'text-emerald-600'
                          : selectedExternalStatus === 'error'
                            ? 'text-rose-600'
                            : 'text-slate-400'
                      }`}>
                        {selectedExternalMessage && (
                          <>
                            <span className="material-symbols-outlined text-lg">
                              {selectedExternalStatus === 'success'
                                ? 'check_circle'
                                : selectedExternalStatus === 'error'
                                  ? 'error'
                                  : 'hourglass_top'}
                            </span>
                            <span>{selectedExternalMessage}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleValidateExternal}
                        disabled={!selectedIntegration.configured || selectedExternalStatus === 'checking'}
                        className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors ${
                          !selectedIntegration.configured || selectedExternalStatus === 'checking'
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-slate-950 text-white hover:bg-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">sync</span>
                        {selectedExternalStatus === 'checking' ? '테스트 중...' : '연동 테스트'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleSaveAuth}
                  disabled={authSaveDisabled}
                  className={`rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                    authSaveDisabled
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
                        onClick={handleSyncShops}
                        disabled={isSyncingShops || !authReady}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                          isSyncingShops || !authReady
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {isSyncingShops ? '업데이트 중...' : '쇼핑몰 정보 업데이트'}
                      </button>
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
                                ? formatDateTimeKst(history.finishedAt)
                                : history.startedAt
                                  ? formatDateTimeKst(history.startedAt)
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
