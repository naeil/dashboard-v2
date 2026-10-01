import { useCallback, useEffect, useState } from 'react'
import { authApi as api } from '../../api/authApi'

/* 세그먼트 배지 색 */
const SEG_STYLE = {
  '구매임박': 'bg-emerald-100 text-emerald-700',
  '이탈위험': 'bg-rose-100 text-rose-700',
  '첫구매(재구매 유도)': 'bg-amber-100 text-amber-700',
  '충성고객': 'bg-indigo-100 text-indigo-700',
  '재구매고객': 'bg-sky-100 text-sky-700',
  '신규': 'bg-slate-100 text-slate-600',
}

const won = (v) => {
  const n = Number(v)
  return isNaN(n) ? '-' : n.toLocaleString('ko-KR') + '원'
}

function Tile({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900', emerald: 'text-emerald-600', rose: 'text-rose-600',
    sky: 'text-sky-600', amber: 'text-amber-600', indigo: 'text-indigo-600',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[12px] font-bold text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tones[tone] || tones.slate}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export default function CustomerCrmPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setErr(null)
    api.get('/executive/customer-crm')
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || '분석을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const health = data?.dataHealth
  const summary = data?.summary
  const actions = data?.actions || []
  const detected = health?.detectedColumns || {}

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">구매주기 마케팅 (실행)</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            [raw]매출관리 시트의 고객 구매 데이터로 "몇 번째 구매 · 다음 구매 시점"을 예측해, 지금 혜택을 쏠 대상을 뽑습니다.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
          {loading ? '분석 중…' : '새로고침'}
        </button>
      </div>

      {err && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-700">{err}</div>}

      {loading && !data && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">고객 데이터 분석 중…</div>}

      {data && !data.success && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[14px] font-black text-amber-800">⚠ 고객 단위 분석 불가</div>
          <p className="mt-1 text-[13px] text-amber-700">{data.message}</p>
        </div>
      )}

      {/* 데이터 건강 상태 — 무엇을 어떻게 읽었는지, 마스킹 여부 */}
      {health && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[13px] font-black text-slate-700">데이터 인식 상태</span>
            {health.identityReliable
              ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">식별 신뢰 ({health.identityBasis})</span>
              : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">식별 불안정 — 마스킹 의심</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-slate-600 md:grid-cols-3">
            <div>이름 컬럼: <b>{detected.name?.headerName || '없음'}</b></div>
            <div>전화 컬럼: <b>{detected.phone?.headerName || '없음'}</b></div>
            <div>주문일 컬럼: <b>{detected.date?.headerName || '(인덱스 기본값)'}</b></div>
            <div>금액 컬럼: <b>{detected.amount?.headerName || '(인덱스 기본값)'}</b></div>
            <div>채널 컬럼: <b>{detected.channel?.headerName || '(인덱스 기본값)'}</b></div>
            <div>상품 컬럼: <b>{detected.product?.headerName || '(인덱스 기본값)'}</b></div>
          </div>
          {typeof health.totalDataRows === 'number' && (
            <div className="mt-2 text-[11px] text-slate-400">
              전체 {health.totalDataRows}행 중 식별 {health.identifiedRows}행 · 식별불가 {health.unidentifiableRows}행
              {health.maskedPhoneRows > 0 && ` · 전화 마스킹 ${health.maskedPhoneRows}행`}
              {health.maskedNameRows > 0 && ` · 이름 마스킹 ${health.maskedNameRows}행`}
            </div>
          )}
          {!health.identityReliable && (
            <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
              구매자 식별값이 가려져 있어(예: 김**, 010-****-1234) 같은 사람의 재구매를 정확히 묶기 어렵습니다.
              채널에서 <b>주문자 전화번호(온전한 값)</b>나 <b>주문자 ID</b>가 포함된 내역으로 받으면 정확도가 올라갑니다.
            </div>
          )}
        </div>
      )}

      {/* 요약 */}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Tile label="총 고객" value={(summary.totalCustomers || 0).toLocaleString('ko-KR')} />
          <Tile label="재구매 고객" value={(summary.repeatCustomers || 0).toLocaleString('ko-KR')} tone="sky" />
          <Tile label="재구매율" value={(summary.repeatRate ?? 0) + '%'} tone="indigo" />
          <Tile label="구매 임박" value={(summary.dueSoonCustomers || 0).toLocaleString('ko-KR')} sub="지금 쿠폰 타이밍" tone="emerald" />
          <Tile label="이탈 위험" value={(summary.atRiskCustomers || 0).toLocaleString('ko-KR')} sub="주기 지남" tone="rose" />
          <Tile label="첫구매 전환" value={(summary.newCustomers || 0).toLocaleString('ko-KR')} sub="두번째 유도" tone="amber" />
        </div>
      )}

      {/* 실행 액션 리스트 */}
      {data?.success && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[14px] font-black text-slate-800">오늘 실행할 액션 ({actions.length}건)</span>
            <span className="text-[11px] text-slate-400">우선순위순 · 상위 200건</span>
          </div>
          {actions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">지금 실행할 대상이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400">
                    <th className="px-3 py-2 font-bold">고객</th>
                    <th className="px-3 py-2 font-bold">세그먼트</th>
                    <th className="px-3 py-2 font-bold">구매</th>
                    <th className="px-3 py-2 font-bold">마지막</th>
                    <th className="px-3 py-2 font-bold">다음 예상</th>
                    <th className="px-3 py-2 font-bold">추천 혜택</th>
                    <th className="px-3 py-2 font-bold">채널 · 실행</th>
                    <th className="px-3 py-2 font-bold">근거</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-slate-800">{a.customer}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEG_STYLE[a.segment] || 'bg-slate-100 text-slate-600'}`}>{a.segment}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{a.nthPurchase}회 · {won(a.totalAmount)}</td>
                      <td className="px-3 py-2 text-slate-500">{a.lastOrder}</td>
                      <td className="px-3 py-2 text-slate-700 font-bold">
                        {a.predictedNext || '-'}
                        {typeof a.daysUntilNext === 'number' && (
                          <span className="ml-1 text-[11px] font-normal text-slate-400">
                            (D{a.daysUntilNext >= 0 ? '-' + a.daysUntilNext : '+' + (-a.daysUntilNext)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{a.benefit}</td>
                      <td className="px-3 py-2 text-slate-500">
                        <b className="text-slate-700">{a.channel}</b><br />{a.howTo}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-400">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
