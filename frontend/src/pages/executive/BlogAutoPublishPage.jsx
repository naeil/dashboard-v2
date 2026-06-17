import { useEffect, useRef, useState } from 'react'
import { authorizedFetch } from '../../api/authApi'
import { buildApiUrl } from '../../api/apiBase'
import { PageHeader, Panel } from './ExecutiveComponents'

const TONE_OPTIONS = [
  { value: '친근하고 따뜻한', label: '친근함' },
  { value: '전문적이고 신뢰감 있는', label: '전문적' },
  { value: '감성적이고 스토리텔링', label: '감성적' },
  { value: '정보 전달 위주의 객관적인', label: '정보형' },
]

const CATEGORY_OPTIONS = [
  '제품 소개',
  '브랜드 스토리',
  '사용 후기 / 리뷰',
  '이벤트 / 프로모션',
  '업계 트렌드',
  '꿀팁 / 가이드',
]

const LENGTH_OPTIONS = [
  { value: 'short', label: '짧게 (500~800자)' },
  { value: 'medium', label: '보통 (800~1200자)' },
  { value: 'long', label: '길게 (1500자+)' },
]

const AI_MODEL_OPTIONS = {
  OPENAI: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  ],
  CLAUDE: [
    { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'claude-3-5-haiku' },
  ],
  GEMINI: [
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  ],
}

const STATUS = {
  IDLE: 'idle',
  GENERATING: 'generating',
  DONE: 'done',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  ERROR: 'error',
}

function AttachmentPreview({ attachments, onRemove }) {
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {attachments.map((a) => (
        <div key={a.id} className="relative group">
          {a.type === 'image' ? (
            <img src={a.preview} alt={a.name} className="h-20 w-20 rounded-lg object-cover border border-white/10" />
          ) : (
            <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-white/10 bg-slate-800">
              <span className="material-symbols-outlined text-3xl text-slate-400">videocam</span>
            </div>
          )}
          <p className="mt-1 w-20 truncate text-[10px] text-slate-500">{a.name}</p>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white group-hover:flex"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}

export default function BlogAutoPublishPage() {
  const [form, setForm] = useState({
    topic: '',
    keywords: '',
    tone: '친근하고 따뜻한',
    category: '제품 소개',
    length: 'medium',
    aiProvider: '',
    aiModel: '',
  })

  const [result, setResult] = useState({ title: '', content: '', hashtags: '' })
  const [status, setStatus] = useState(STATUS.IDLE)
  const [error, setError] = useState('')
  const [aiSettings, setAiSettings] = useState([])
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true)
  const [aiSettingsError, setAiSettingsError] = useState('')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [naverAccount, setNaverAccount] = useState({ username: '', password: '' })
  const [attachments, setAttachments] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const availableAiSettings = aiSettings.filter((setting) => setting.isActive !== false && setting.validatedAt)
  const selectedModelOptions = AI_MODEL_OPTIONS[form.aiProvider] || []

  useEffect(() => {
    let active = true

    const loadAiSettings = async () => {
      setAiSettingsLoading(true)
      setAiSettingsError('')
      try {
        const res = await authorizedFetch(buildApiUrl('/settings/ai'))
        const body = await res.json().catch(() => [])
        if (!res.ok) throw new Error(body.message || 'AI 설정 정보를 불러오지 못했습니다.')
        const settings = Array.isArray(body) ? body : []
        if (!active) return
        setAiSettings(settings)
        const firstSetting = settings.find((setting) => setting.isActive !== false && setting.validatedAt)
        if (firstSetting) {
          const models = AI_MODEL_OPTIONS[firstSetting.provider] || []
          setForm((prev) => ({
            ...prev,
            aiProvider: prev.aiProvider || firstSetting.provider,
            aiModel: prev.aiModel || models[0]?.value || '',
          }))
        }
      } catch (err) {
        if (!active) return
        setAiSettingsError(err.message || 'AI 설정 정보를 불러오지 못했습니다.')
      } finally {
        if (active) setAiSettingsLoading(false)
      }
    }

    loadAiSettings()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const models = AI_MODEL_OPTIONS[form.aiProvider] || []
    if (form.aiProvider && !models.some((model) => model.value === form.aiModel)) {
      set('aiModel', models[0]?.value || '')
    }
  }, [form.aiProvider, form.aiModel])

  const addFiles = (files) => {
    const newItems = Array.from(files).map((file) => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!isImage && !isVideo) return null
      return {
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        type: isImage ? 'image' : 'video',
        preview: isImage ? URL.createObjectURL(file) : null,
      }
    }).filter(Boolean)
    setAttachments((prev) => [...prev, ...newItems])
  }

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((a) => a.id !== id)
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const generate = async () => {
    if (!form.topic.trim()) return
    setStatus(STATUS.GENERATING)
    setError('')

    try {
      const res = await authorizedFetch(buildApiUrl('/marketing/blog/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || '생성 실패')
      setResult({ title: body.title || '', content: body.content || '', hashtags: body.hashtags || '' })
      setStatus(STATUS.DONE)
    } catch (err) {
      setError(err.message)
      setStatus(STATUS.ERROR)
    }
  }

  const publish = async () => {
    setShowAccountModal(false)
    setStatus(STATUS.PUBLISHING)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', result.title)
      formData.append('content', result.content)
      formData.append('hashtags', result.hashtags)
      formData.append('naverUsername', naverAccount.username)
      formData.append('naverPassword', naverAccount.password)
      attachments.forEach((a) => {
        formData.append(a.type === 'image' ? 'images' : 'videos', a.file)
      })

      const res = await authorizedFetch(buildApiUrl('/marketing/blog/publish'), {
        method: 'POST',
        body: formData,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || '발행 실패')
      setStatus(STATUS.PUBLISHED)
    } catch (err) {
      setError(err.message)
      setStatus(STATUS.ERROR)
    }
  }

  const reset = () => {
    setResult({ title: '', content: '', hashtags: '' })
    setStatus(STATUS.IDLE)
    setError('')
  }

  const isGenerating = status === STATUS.GENERATING
  const isPublishing = status === STATUS.PUBLISHING
  const hasResult = status === STATUS.DONE || status === STATUS.PUBLISHED || status === STATUS.PUBLISHING

  return (
    <>
      {/* 네이버 계정 입력 모달 */}
      {showAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAccountModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-sky-400">네이버 계정 선택</p>
            <p className="mb-5 text-lg font-black text-white">어느 계정으로 발행할까요?</p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-400">네이버 아이디</span>
                <input
                  value={naverAccount.username}
                  onChange={(e) => setNaverAccount((p) => ({ ...p, username: e.target.value }))}
                  placeholder="아이디 입력"
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black text-slate-400">비밀번호</span>
                <input
                  type="password"
                  value={naverAccount.password}
                  onChange={(e) => setNaverAccount((p) => ({ ...p, password: e.target.value }))}
                  placeholder="비밀번호 입력"
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                />
              </label>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">비밀번호는 발행 후 서버 메모리에서 즉시 삭제됩니다.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-black text-slate-400 hover:text-white">취소</button>
              <button
                type="button"
                onClick={publish}
                disabled={!naverAccount.username || !naverAccount.password}
                className="flex-1 rounded-xl bg-green-500 py-2.5 text-sm font-black text-white hover:bg-green-400 disabled:opacity-40"
              >
                발행 시작
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="블로그 자동 배포 AI"
        description="주제를 입력하면 AI가 블로그 글을 작성하고 네이버 블로그에 자동 발행합니다."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {/* 입력 패널 */}
        <div className="space-y-6">
          <Panel title="글 생성 설정">
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-slate-400">AI / 모델</span>
                  {aiSettingsLoading && <span className="text-[11px] font-black text-slate-500">불러오는 중...</span>}
                </div>
                {availableAiSettings.length > 0 ? (
                  <div className="grid gap-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black text-slate-500">AI 인증 정보</span>
                      <select
                        value={form.aiProvider}
                        onChange={(e) => {
                          const provider = e.target.value
                          setForm((prev) => ({
                            ...prev,
                            aiProvider: provider,
                            aiModel: AI_MODEL_OPTIONS[provider]?.[0]?.value || '',
                          }))
                        }}
                        className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                      >
                        {availableAiSettings.map((setting) => (
                          <option key={setting.provider} value={setting.provider}>
                            {setting.displayName || setting.provider}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black text-slate-500">모델</span>
                      <select
                        value={form.aiModel}
                        onChange={(e) => set('aiModel', e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                      >
                        {selectedModelOptions.map((model) => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <p className="text-xs font-bold leading-5 text-slate-500">
                    {aiSettingsError || '설정 화면에서 AI 인증 정보를 검증 후 저장하면 여기에서 선택할 수 있습니다.'}
                  </p>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-400">
                  주제 <span className="text-rose-400">*</span>
                </span>
                <input
                  value={form.topic}
                  onChange={(e) => set('topic', e.target.value)}
                  placeholder="예: 여름 신제품 출시, 친환경 포장재 도입..."
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-400">SEO 키워드</span>
                <input
                  value={form.keywords}
                  onChange={(e) => set('keywords', e.target.value)}
                  placeholder="예: 국내 유통, 도매, 신제품 (쉼표로 구분)"
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-400">카테고리</span>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-2 block text-xs font-black text-slate-400">톤앤매너</span>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => set('tone', t.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-black transition-colors ${
                        form.tone === t.value
                          ? 'border-sky-400 bg-sky-400/20 text-sky-200'
                          : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-black text-slate-400">글 길이</span>
                <div className="flex gap-2">
                  {LENGTH_OPTIONS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => set('length', l.value)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-black transition-colors ${
                        form.length === l.value
                          ? 'border-sky-400 bg-sky-400/20 text-sky-200'
                          : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={!form.topic.trim() || !form.aiProvider || !form.aiModel || isGenerating || isPublishing}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-black text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    AI가 글을 작성하는 중...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    AI 글 생성
                  </>
                )}
              </button>
            </div>
          </Panel>

          {/* 첨부파일 패널 */}
          <Panel title="사진 / 동영상 첨부">
            <div className="space-y-3">
              {/* 드래그앤드롭 영역 */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  isDragging ? 'border-sky-400 bg-sky-400/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <span className="material-symbols-outlined mb-2 text-3xl text-slate-500">upload</span>
                <p className="text-xs font-bold text-slate-400">파일을 여기에 드래그하거나</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:border-sky-400/50 hover:text-sky-300"
                  >
                    <span className="material-symbols-outlined text-sm">image</span>
                    사진 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:border-violet-400/50 hover:text-violet-300"
                  >
                    <span className="material-symbols-outlined text-sm">videocam</span>
                    동영상 추가
                  </button>
                </div>
              </div>

              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

              <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

              {attachments.length > 0 && (
                <p className="text-xs font-bold text-slate-500">
                  사진 {attachments.filter(a => a.type === 'image').length}개 · 동영상 {attachments.filter(a => a.type === 'video').length}개 첨부됨
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* 결과 패널 */}
        <div className="space-y-4">
          {!hasResult && !isGenerating && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
              <span className="material-symbols-outlined mb-4 text-5xl text-slate-700">edit_note</span>
              <p className="text-sm font-black text-slate-500">왼쪽에서 주제를 입력하고</p>
              <p className="text-sm font-black text-slate-500">AI 글 생성 버튼을 누르세요.</p>
            </div>
          )}

          {isGenerating && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/5">
              <span className="material-symbols-outlined mb-4 animate-pulse text-5xl text-sky-400">auto_awesome</span>
              <p className="text-sm font-black text-sky-300">GPT-4o가 글을 작성하고 있습니다...</p>
              <p className="mt-1 text-xs font-bold text-slate-500">약 10~20초 소요됩니다.</p>
            </div>
          )}

          {hasResult && (
            <Panel
              title="생성된 블로그 글"
              right={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    다시 생성
                  </button>
                  {status !== STATUS.PUBLISHED && (
                    <button
                      type="button"
                      onClick={() => setShowAccountModal(true)}
                      disabled={isPublishing}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-green-500 px-3 text-xs font-black text-white hover:bg-green-400 disabled:opacity-50"
                    >
                      {isPublishing ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          발행 중...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">publish</span>
                          네이버 발행
                          {attachments.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{attachments.length}</span>}
                        </>
                      )}
                    </button>
                  )}
                </div>
              }
            >
              {status === STATUS.PUBLISHED && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                  <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                  <p className="text-sm font-black text-emerald-300">네이버 블로그에 발행되었습니다!</p>
                </div>
              )}

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">제목</span>
                  <input
                    value={result.title}
                    onChange={(e) => setResult((prev) => ({ ...prev, title: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">본문</span>
                  <textarea
                    value={result.content}
                    onChange={(e) => setResult((prev) => ({ ...prev, content: e.target.value }))}
                    rows={16}
                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold leading-7 text-white outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">해시태그</span>
                  <input
                    value={result.hashtags}
                    onChange={(e) => setResult((prev) => ({ ...prev, hashtags: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-sky-300 outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            </Panel>
          )}

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">
              <p className="text-xs font-black text-rose-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
