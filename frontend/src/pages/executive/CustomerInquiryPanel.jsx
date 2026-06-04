import { useEffect, useMemo, useState } from 'react'
import { getExecutiveCustomerInquiries, updateExecutiveRecord } from '../../api/executiveApi'

const channelLabels = {
  KAKAO: '카카오톡',
  SMARTSTORE: '스마트스토어',
  IMWEB: '공식몰',
  COUPANG: '쿠팡',
  ESM: 'ESM',
  MANUAL: '수동등록',
}

const statusLabels = {
  UNANSWERED: '미답변',
  ASSIGNED: '담당자 배정',
  IN_PROGRESS: '처리중',
  WAITING_CUSTOMER: '고객 회신 대기',
  DONE: '완료',
}

const statusClasses = {
  UNANSWERED: 'border-rose-200 bg-rose-50 text-rose-700',
  ASSIGNED: 'border-sky-200 bg-sky-50 text-sky-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  WAITING_CUSTOMER: 'border-violet-200 bg-violet-50 text-violet-700',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function count(value, unit = '건') {
  return `${Number(value || 0).toLocaleString('ko-KR')}${unit}`
}

function channelLabel(value) {
  return channelLabels[value] || value || '기타'
}

function statusLabel(value) {
  return statusLabels[value] || value || '확인 필요'
}

function formatTime(value) {
  if (!value) return '시간 미정'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CustomerInquiryPanel() {
  const [payload, setPayload] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await getExecutiveCustomerInquiries()
      setPayload(response.data || { summary: {}, rows: [] })
    } catch (error) {
      setMessage(error?.response?.data?.message || '고객 문의 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const rows = payload.rows || []
  const summary = payload.summary || {}
  const activeRows = useMemo(() => rows.filter((row) => row.status !== 'DONE').slice(0, 6), [rows])

  const markInProgress = async (row) => {
    await updateExecutiveRecord('customer-inquiries', row.id, { status: 'IN_PROGRESS' })
    await load()
  }

  const markDone = async (row) => {
    await updateExecutiveRecord('customer-inquiries', row.id, { status: 'DONE', answered_at: new Date().toISOString() })
    await load()
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-yellow-700">forum</span>
            <h2 className="text-lg font-black text-slate-950">통합 고객 문의 현황</h2>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">카카오톡, 스마트스토어, 공식몰, 오픈마켓 문의를 한 곳에서 처리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">미답변 {count(summary.unanswered_count)}</span>
          <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">진행 {count(summary.open_count)}</span>
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">긴급 {count(summary.urgent_count)}</span>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black text-slate-500">연동 채널</p>
          <p className="mt-3 text-2xl font-black text-slate-950">통합 문의함</p>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            현재는 내부 DB 기준입니다. 카카오 상담톡, 스마트스토어, 공식몰 API가 연결되면 각 채널 문의가 이 테이블로 자동 적재됩니다.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">카카오 {count(summary.kakao_open_count)}</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">스마트스토어 {count(summary.smartstore_open_count)}</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">공식몰 {count(summary.imweb_open_count)}</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">AI 유형 분류</span>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-black text-slate-500">
              고객 문의를 불러오는 중입니다.
            </div>
          ) : activeRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-black text-slate-500">
              처리할 고객 문의가 없습니다.
            </div>
          ) : activeRows.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-950">{item.customer_name || '고객명 미확인'}</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{channelLabel(item.channel)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{item.inquiry_type}</span>
                    {item.urgent && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700">긴급</span>}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{item.ai_summary || item.message}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{item.assigned_to || '담당자 미정'} · {formatTime(item.received_at)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClasses[item.status] || statusClasses.IN_PROGRESS}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="h-8 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black leading-none text-slate-600 hover:bg-slate-50">
                    채널 열기
                  </a>
                )}
                {item.status === 'UNANSWERED' && (
                  <button type="button" onClick={() => markInProgress(item)} className="h-8 rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:bg-sky-100">
                    처리 시작
                  </button>
                )}
                <button type="button" onClick={() => markDone(item)} className="h-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                  완료
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
