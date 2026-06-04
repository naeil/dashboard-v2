import { useMemo, useState } from 'react'
import {
  createMarketingAgentScenario,
  deployMarketingAgentNaverBlog,
} from '../../api/executiveApi'
import { PageHeader, Panel } from './ExecutiveComponents'

const agentRoles = [
  {
    id: 'blog',
    icon: 'edit_note',
    title: '블로그 작성 AI',
    subtitle: '네이버 블로그 검색 노출용 콘텐츠',
    mission: '검색 키워드와 구매 맥락을 바탕으로 실제 배포 가능한 블로그 시나리오와 초안을 만듭니다.',
    outputs: ['제목 후보', '검색 의도', '본문 구조', 'CTA', '해시태그'],
  },
  {
    id: 'article',
    icon: 'newspaper',
    title: '기사 작성 AI',
    subtitle: '보도자료와 언론 기사형 콘텐츠',
    mission: '브랜드 신뢰, 대표 코멘트, 시장 의미를 중심으로 기사형 콘텐츠 초안을 만듭니다.',
    outputs: ['기사 제목', '리드문', '본문 문단', '대표 코멘트', '배포 요약'],
  },
  {
    id: 'viral',
    icon: 'campaign',
    title: '바이럴 소재 기획 AI',
    subtitle: '광고, 숏폼, 커뮤니티 확산 소재',
    mission: '타겟의 문제 상황과 후킹 포인트를 기반으로 클릭을 유도하는 바이럴 소재를 설계합니다.',
    outputs: ['후킹 문구', '소재 콘셉트', '숏폼 시나리오', '이미지 카피', 'A/B 테스트안'],
  },
]

const emptyBrief = {
  productName: '',
  target: '',
  scenario: '',
  concept: '',
  desiredOutcome: '',
  keywords: '',
  tone: '신뢰감 있는 전문가 톤',
  channel: '네이버 블로그',
  restrictions: '',
}

const messageTypeStyle = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

function Field({ label, children, wide = false }) {
  return (
    <label className={`block ${wide ? 'lg:col-span-2' : ''}`}>
      <span className="mb-2 block text-xs font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
    />
  )
}

function buildPrompt(role, brief) {
  const keywordLine = brief.keywords
    ? `핵심 키워드: ${brief.keywords}`
    : '핵심 키워드: 입력된 제품명과 타겟을 바탕으로 검색 의도를 추론'

  return `당신은 ${role.title} 역할의 마케팅 에이전트입니다.

목표:
${role.mission}

입력 정보:
- 제품/브랜드: ${brief.productName || '미입력'}
- 타겟: ${brief.target || '미입력'}
- 시나리오/상황: ${brief.scenario || '미입력'}
- 콘텐츠 콘셉트: ${brief.concept || '미입력'}
- 원하는 결과: ${brief.desiredOutcome || '미입력'}
- ${keywordLine}
- 채널: ${brief.channel}
- 톤앤매너: ${brief.tone}
- 금지/주의사항: ${brief.restrictions || '과장 광고, 의학적 단정 표현, 근거 없는 수치 표현 금지'}

작성 규칙:
1. 먼저 타겟의 문제 상황과 검색 의도를 요약한다.
2. 바이럴 확산이 가능한 후킹 포인트를 5개 제안한다.
3. ${role.outputs.join(', ')} 순서로 결과물을 만든다.
4. 실무자가 바로 복사해 사용할 수 있는 문장으로 작성한다.
5. 과장 표현은 피하고 신뢰성과 전환 가능성을 동시에 고려한다.`
}

function buildPreview(role, brief) {
  const target = brief.target || '핵심 타겟'
  const product = brief.productName || '제품'
  const outcome = brief.desiredOutcome || '검색 유입과 구매 전환'
  const concept = brief.concept || '신뢰 기반 문제 해결형 콘텐츠'

  if (role.id === 'article') {
    return [
      `${product}의 차별점과 시장 의미를 기사형 구조로 정리`,
      `${target} 관점에서 신뢰할 수 있는 보도자료 메시지 설계`,
      `기대 효과: ${outcome}`,
    ]
  }

  if (role.id === 'viral') {
    return [
      `${target}이 바로 반응할 후킹 카피 5개 생성`,
      `${concept} 기반 숏폼, 이미지, 커뮤니티 소재 시나리오 구성`,
      `목표 행동: ${outcome}`,
    ]
  }

  return [
    `${target} 검색 의도에 맞춘 블로그 제목 후보 생성`,
    `${product}를 자연스럽게 소개하는 본문 구조 설계`,
    `콘텐츠 목표: ${outcome}`,
  ]
}

export default function MarketingAgentPage() {
  const [selectedRoleId, setSelectedRoleId] = useState('blog')
  const [brief, setBrief] = useState(emptyBrief)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [categoryNo, setCategoryNo] = useState('')
  const [blogId, setBlogId] = useState('')
  const [message, setMessage] = useState(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [deployLoading, setDeployLoading] = useState(false)

  const selectedRole = agentRoles.find((role) => role.id === selectedRoleId) || agentRoles[0]
  const prompt = useMemo(() => scenarioResult?.prompt || buildPrompt(selectedRole, brief), [selectedRole, brief, scenarioResult])
  const preview = useMemo(() => buildPreview(selectedRole, brief), [selectedRole, brief])

  const setValue = (key, value) => {
    setBrief((prev) => ({ ...prev, [key]: value }))
    setScenarioResult(null)
  }

  const showMessage = (type, text) => setMessage({ type, text })

  const handleScenario = async () => {
    setScenarioLoading(true)
    setMessage(null)
    try {
      const response = await createMarketingAgentScenario({ roleId: selectedRole.id, brief })
      const data = response.data || {}
      setScenarioResult(data)
      setDraftTitle(data.draftTitle || data.titleCandidates?.[0] || '')
      setDraftContent(data.draftContent || '')
      showMessage('success', data.message || '시나리오가 생성되었습니다.')
    } catch (error) {
      showMessage('error', error?.response?.data?.message || error.message || '시나리오 작성에 실패했습니다.')
    } finally {
      setScenarioLoading(false)
    }
  }

  const handleDeploy = async () => {
    setDeployLoading(true)
    setMessage(null)
    try {
      const response = await deployMarketingAgentNaverBlog({
        roleId: selectedRole.id,
        brief,
        title: draftTitle,
        contents: draftContent,
        categoryNo,
        blogId,
      })
      const data = response.data || {}
      const type = data.configured === false ? 'warning' : 'success'
      showMessage(type, data.message || '네이버 블로그 배포 요청이 완료되었습니다.')
    } catch (error) {
      showMessage('error', error?.response?.data?.message || error.message || '네이버 블로그 배포에 실패했습니다.')
    } finally {
      setDeployLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="마케팅 에이전트"
        description="타겟, 시나리오, 콘셉트를 입력하면 블로그/기사/바이럴 소재를 만들고 네이버 블로그 배포 실행까지 이어집니다."
      />

      {message && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-black ${messageTypeStyle[message.type] || messageTypeStyle.info}`}>
          {message.text}
        </div>
      )}

      <section className="mb-6 grid gap-4 xl:grid-cols-3">
        {agentRoles.map((role) => {
          const active = selectedRole.id === role.id
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                setSelectedRoleId(role.id)
                setScenarioResult(null)
              }}
              className={`rounded-lg border p-5 text-left transition-colors ${active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`material-symbols-outlined rounded-lg border p-2 ${active ? 'border-sky-200 bg-white text-sky-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  {role.icon}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
                  Agent
                </span>
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-950">{role.title}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{role.subtitle}</p>
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{role.mission}</p>
            </button>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Panel title={`${selectedRole.title} 브리프 입력`} right={<span className="text-xs font-black text-slate-500">1단계 입력</span>}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="제품 / 브랜드">
              <TextInput value={brief.productName} onChange={(value) => setValue('productName', value)} placeholder="예: 하이프리, 프리행, 먹키" />
            </Field>
            <Field label="채널">
              <select value={brief.channel} onChange={(event) => setValue('channel', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400">
                <option>네이버 블로그</option>
                <option>온라인 기사</option>
                <option>인스타그램</option>
                <option>Meta 광고</option>
                <option>카페/커뮤니티</option>
                <option>숏폼 영상</option>
              </select>
            </Field>
            <Field label="타겟" wide>
              <TextArea value={brief.target} onChange={(value) => setValue('target', value)} rows={3} placeholder="예: 건강 관리에 관심은 있지만 반복 구매 경험이 부족한 30~50대 여성" />
            </Field>
            <Field label="시나리오 / 상황" wide>
              <TextArea value={brief.scenario} onChange={(value) => setValue('scenario', value)} placeholder="예: 검색은 하고 있지만 구매 결정을 못 하는 고객에게 신뢰를 주는 상황" />
            </Field>
            <Field label="콘셉트" wide>
              <TextArea value={brief.concept} onChange={(value) => setValue('concept', value)} placeholder="예: 원료와 전문성을 과장 없이 보여주는 정보형 콘텐츠" />
            </Field>
            <Field label="우리가 원하는 결과" wide>
              <TextArea value={brief.desiredOutcome} onChange={(value) => setValue('desiredOutcome', value)} placeholder="예: 검색 노출 확보, 브랜드 신뢰 확보, 구매 전환, 리뷰 확보" />
            </Field>
            <Field label="핵심 키워드">
              <TextInput value={brief.keywords} onChange={(value) => setValue('keywords', value)} placeholder="예: 하이프리 유승우, 건강기능식품, 파라신호" />
            </Field>
            <Field label="톤앤매너">
              <TextInput value={brief.tone} onChange={(value) => setValue('tone', value)} placeholder="예: 신뢰감 있는 전문가 톤" />
            </Field>
            <Field label="금지 / 주의사항" wide>
              <TextArea value={brief.restrictions} onChange={(value) => setValue('restrictions', value)} rows={3} placeholder="예: 질병 치료 단정 금지, 과장 수치 금지, 경쟁사 비방 금지" />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleScenario}
              disabled={scenarioLoading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-sky-500 px-5 text-sm font-black text-white shadow-sm hover:bg-sky-600 disabled:cursor-wait disabled:bg-slate-300"
            >
              <span className={`material-symbols-outlined text-base ${scenarioLoading ? 'animate-spin' : ''}`}>
                {scenarioLoading ? 'progress_activity' : 'auto_awesome'}
              </span>
              1. 시나리오 작성
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(prompt)}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              Claude 프롬프트 복사
            </button>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="생성될 실행 구조">
            <div className="space-y-3">
              {preview.map((item, index) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black text-sky-600">STEP {index + 1}</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-800">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold leading-6 text-slate-700">
              현재는 내부 시나리오 빌더로 초안을 만들고, 다음 단계에서 Claude API를 연결하면 같은 버튼에서 고도화된 초안 생성까지 확장할 수 있습니다.
            </div>
          </Panel>

          {scenarioResult && (
            <Panel title="시나리오 결과">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-black text-slate-500">제목 후보</p>
                  <div className="flex flex-wrap gap-2">
                    {(scenarioResult.titleCandidates || []).map((title) => (
                      <button
                        key={title}
                        type="button"
                        onClick={() => setDraftTitle(title)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:border-sky-300 hover:text-sky-700"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black text-slate-500">실행 체크포인트</p>
                  <ul className="space-y-2">
                    {(scenarioResult.scenarioSteps || []).map((item) => (
                      <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Panel title="배포 전 검수" right={<span className="text-xs font-black text-slate-500">2단계 검수</span>}>
          <div className="grid gap-4">
            <Field label="블로그 제목">
              <TextInput value={draftTitle} onChange={setDraftTitle} placeholder="시나리오 작성 후 제목 후보를 선택하거나 직접 입력하세요." />
            </Field>
            <Field label="블로그 본문">
              <TextArea value={draftContent} onChange={setDraftContent} rows={14} placeholder="시나리오 작성 버튼을 누르면 초안이 자동으로 채워집니다." />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="카테고리 번호">
                <TextInput value={categoryNo} onChange={setCategoryNo} placeholder="선택 입력" />
              </Field>
              <Field label="블로그 ID">
                <TextInput value={blogId} onChange={setBlogId} placeholder="비워두면 환경변수 NAVER_BLOG_ID 사용" />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deployLoading || !draftTitle || !draftContent}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <span className={`material-symbols-outlined text-base ${deployLoading ? 'animate-spin' : ''}`}>
                {deployLoading ? 'progress_activity' : 'rocket_launch'}
              </span>
              2. 네이버 블로그 배포 실행
            </button>
          </div>
        </Panel>

        <Panel title="Claude 실행 프롬프트">
          <textarea
            readOnly
            value={prompt}
            rows={18}
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs font-semibold leading-6 text-slate-800 outline-none"
          />
        </Panel>
      </section>
    </>
  )
}
