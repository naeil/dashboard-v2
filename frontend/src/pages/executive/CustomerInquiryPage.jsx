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
  return String(Number(value || 0).toLocaleString('ko-KR')) + unit
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

export default function CustomerInquiryPage() {
  const [payload, setPayload] = useState({ summary: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterChannel, setFilterChannel] = useState('ALL')

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

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusMatch = filterStatus === 'ALL' || row.status === filterStatus
      const channelMatch = filterChannel === 'ALL' || row.channel === filterChannel
      return statusMatch && channelMatch
    })
  }, [rows, filterStatus, filterChannel])

  const markInProgress = async (row) => {
    await updateExecutiveRecord('customer-inquiries', row.id, { status: 'IN_PROGRESS' })
    await load()
  }

  const markDone = async (row) => {
    await updateExecutiveRecord('customer-inquiries', row.id, { status: 'DONE', answered_at: new Date().toISOString() })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">CS 문의 관리</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">스마트스토어, 카카오톡, 공식몰 등 통합 고객 문의를 한 곳에서 처리합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-black text-rose-600">미답변</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{count(summary.unanswered_count)}</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-black text-sky-600">진행중</p>
          <p className="mt-1 text-2xl font-black text-sky-700">{count(summary.open_count)}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black text-amber-600">긴급</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{count(summary.urgent_count)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-black text-slate-500">스마트스토어</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{count(summary.smartstore_open_count)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">상태</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <option value="ALL">전체</option>
            <option value="UNANSWERED">미답변</option>
            <option value="ASSIGNED">담당자 배정</option>
            <option value="IN_PROGRESS">처리중</option>
            <option value="WAITING_CUSTOMER">고객 회신 대기</option>
            <option value="DONE">완료</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">채널</span>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <option value="ALL">전체 채널</option>
            <option value="SMARTSTORE">스마트스토어</option>
            <option value="KAKAO">카카오톡</option>
            <option value="IMWEB">공식몰</option>
            <option value="COUPANG">쿠팡</option>
            <option value="MANUAL">수동등록</option>
          </select>
        </div>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <span className="material-symbols-outlined text-sm">refresh</span>
          새로고침
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">{message}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-black text-slate-950">
            문의 목록
            <span className="ml-2 font-bold text-slate-400">({filteredRows.length}건)</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm font-black text-slate-400">
            <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
            <p className="mt-2">문의를 불러오는 중...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm font-black text-slate-400">
            <span className="material-symbols-outlined text-3xl">forum</span>
            <p className="mt-2">해당하는 고객 문의가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((item) => (
              <article key={item.id} className="p-5 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950">{item.customer_name || '고객명 미확인'}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">{channelLabel(item.channel)}</span>
                      {item.inquiry_type && (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">{item.inquiry_type}</span>
                      )}
                      {item.urgent && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-black text-rose-700">긴급</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">{item.ai_summary || item.message}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">{item.assigned_to || '담당자 미정'} · {formatTime(item.received_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={'rounded-full border px-2.5 py-1 text-[11px] font-black ' + (statusClasses[item.status] || statusClasses.IN_PROGRESS)}>
                      {statusLabel(item.status)}
                    </span>
                    <div className="flex gap-2">
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">채널 열기</a>
                      )}
                      {item.status === 'UNANSWERED' && (
                        <button type="button" onClick={() => markInProgress(item)} className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 hover:bg-sky-100">처리 시작</button>
                      )}
                      {item.status !== 'DONE' && (
                        <button type="button" onClick={() => markDone(item)} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">완료</button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
