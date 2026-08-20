import { useEffect, useRef, useState } from 'react'
import { DataTable, EmptyState, Panel } from '../ExecutiveComponents'
import { won, pct } from '../formatters'
import { LoadingBox, ErrorBox } from './CfoShared'
import {
  getCfoExpenses,
  saveCfoRecurringExpense,
  deleteCfoRecurringExpense,
  getCfoBudgets,
  saveCfoBudget,
  getCfoAlerts,
  updateCfoAlert,
  getCfoCostHistory,
  addCfoCostHistory,
  uploadCfoCsv,
} from '../../../api/cfoApi'

const inputCls = 'h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400'

// ── 비용 관리 탭 ─────────────────────────────────────────────
export function ExpenseTab({ month }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ expenseName: '', category: '급여', amount: '', paymentDay: '25' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    getCfoExpenses({ month })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }
  useEffect(load, [month])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const submit = async () => {
    if (!form.expenseName || !form.amount) return
    setSaving(true)
    try {
      await saveCfoRecurringExpense({
        expenseName: form.expenseName,
        category: form.category,
        amount: Number(form.amount),
        paymentDay: Number(form.paymentDay) || 25,
      })
      setForm({ expenseName: '', category: '급여', amount: '', paymentDay: '25' })
      load()
    } finally {
      setSaving(false)
    }
  }

  const removeRecurring = async (id) => {
    await deleteCfoRecurringExpense(id)
    load()
  }

  return (
    <div className="space-y-6">
      {(data.anomalies || []).length > 0 && (
        <Panel title="⚠ 비용 이상 감지 (전월 대비 20% 이상 증가)">
          <DataTable
            columns={[
              { key: 'category', label: '카테고리' },
              { key: 'previous_amount', label: '전월', render: (r) => <span className="block text-right">{won(r.previous_amount)}</span> },
              { key: 'current_amount', label: '당월', render: (r) => <span className="block text-right font-black text-rose-700">{won(r.current_amount)}</span> },
              { key: 'change_pct', label: '증가율', render: (r) => <span className="block text-right font-black text-rose-600">+{pct(r.change_pct)}</span> },
            ]}
            rows={data.anomalies}
            rowKey={(r) => r.category}
            searchable={false}
          />
        </Panel>
      )}

      <Panel title="반복 고정비 (매월 자동 반영)">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <input value={form.expenseName} onChange={(e) => setForm({ ...form, expenseName: e.target.value })} placeholder="비용명 (예: 사무실 임대료)" className={inputCls} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
            {['급여', '4대보험', '임대료', '관리비', '구독료', '보험료', '대출이자', '세무비', '차량비', '서버비', '기타'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="월 금액(원)" type="number" className={inputCls} />
          <input value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} placeholder="결제일" type="number" min="1" max="31" className={inputCls} />
          <button type="button" onClick={submit} disabled={saving} className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-50">
            {saving ? '저장 중...' : '고정비 등록'}
          </button>
        </div>
        {(data.recurring || []).length === 0 ? <EmptyState message="등록된 반복 고정비가 없습니다. 급여·임대료·구독료를 등록하면 손익과 현금흐름에 자동 반영됩니다." /> : (
          <DataTable
            columns={[
              { key: 'expense_name', label: '비용명' },
              { key: 'category', label: '카테고리' },
              { key: 'amount', label: '월 금액', render: (r) => <span className="block text-right font-black">{won(r.amount)}</span> },
              { key: 'payment_day', label: '결제일', render: (r) => `매월 ${r.payment_day}일` },
              { key: 'is_active', label: '상태', render: (r) => (r.is_active ? '활성' : '중지') },
              {
                key: 'actions', label: '', searchable: false, sortable: false,
                render: (r) => (
                  <button type="button" onClick={() => removeRecurring(r.id)} className="text-xs font-black text-rose-600 hover:underline">삭제</button>
                ),
              },
            ]}
            rows={data.recurring}
            rowKey={(r) => r.id}
            searchPlaceholder="비용명 검색"
          />
        )}
      </Panel>

      <Panel title={`${data.month} 운영비 내역 (기존 운영비 관리 데이터)`}>
        {(data.expenses || []).length === 0 ? <EmptyState message="이 달에 등록된 운영비가 없습니다. '운영 고정비' 메뉴에서 입력한 데이터가 여기에 표시됩니다." /> : (
          <DataTable
            columns={[
              { key: 'category', label: '카테고리' },
              { key: 'expense_type', label: '구분', render: (r) => (r.expense_type === 'FIXED' ? '고정비' : '변동비') },
              { key: 'amount', label: '금액', render: (r) => <span className="block text-right font-black">{won(r.amount)}</span> },
              { key: 'vendor', label: '거래처' },
              { key: 'payment_date', label: '지급일' },
            ]}
            rows={data.expenses}
            rowKey={(r) => r.id}
            searchPlaceholder="카테고리·거래처 검색"
          />
        )}
      </Panel>

      {(data.budgetCompare || []).length > 0 && (
        <Panel title="비용 예산 대비 집행률">
          <DataTable
            columns={[
              { key: 'category', label: '카테고리' },
              { key: 'budget_amount', label: '예산', render: (r) => <span className="block text-right">{won(r.budget_amount)}</span> },
              { key: 'actual_amount', label: '집행', render: (r) => <span className="block text-right font-black">{won(r.actual_amount)}</span> },
              { key: 'usage_pct', label: '집행률', render: (r) => <span className={`block text-right font-black ${Number(r.usage_pct) > 100 ? 'text-rose-600' : 'text-slate-800'}`}>{r.usage_pct == null ? '—' : pct(r.usage_pct)}</span> },
            ]}
            rows={data.budgetCompare}
            rowKey={(r) => r.category}
            searchable={false}
          />
        </Panel>
      )}
    </div>
  )
}

// ── 예산·목표 탭 ─────────────────────────────────────────────
export function BudgetTab({ month }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ budgetType: 'REVENUE', category: '전체', amount: '' })
  const [saving, setSaving] = useState(false)

  const typeLabels = {
    REVENUE: '매출 목표', GROSS_PROFIT: '매출총이익 목표', CONTRIBUTION: '공헌이익 목표',
    OPERATING_PROFIT: '영업이익 목표', EXPENSE: '비용 예산', AD: '광고비 예산',
    LABOR: '인건비 예산', FIXED: '고정비 예산', PRODUCTION: '생산비 예산',
    CASH: '현금잔액 목표', RECEIVABLE_COLLECT: '미수금 회수 목표', DEBT_REPAY: '대출 상환 목표',
  }

  const load = () => {
    getCfoBudgets({ month })
      .then((res) => setRows(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }
  useEffect(load, [month])

  if (error) return <ErrorBox message={error} />
  if (!rows) return <LoadingBox />

  const submit = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      await saveCfoBudget({ month, budgetType: form.budgetType, category: form.category || '전체', amount: Number(form.amount) })
      setForm({ budgetType: 'REVENUE', category: '전체', amount: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title={`${month} 예산·목표`}>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <select value={form.budgetType} onChange={(e) => setForm({ ...form, budgetType: e.target.value })} className={inputCls}>
          {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="카테고리 (전체/브랜드/채널)" className={inputCls} />
        <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="금액(원)" type="number" className={inputCls} />
        <button type="button" onClick={submit} disabled={saving} className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? '저장 중...' : '목표 저장'}
        </button>
      </div>
      {rows.length === 0 ? <EmptyState message="이 달의 예산·목표가 없습니다. 매출 목표를 등록하면 CFO 요약의 달성률이 계산됩니다." /> : (
        <DataTable
          columns={[
            { key: 'budget_type', label: '유형', render: (r) => typeLabels[r.budget_type] || r.budget_type },
            { key: 'category', label: '카테고리' },
            { key: 'amount', label: '금액', render: (r) => <span className="block text-right font-black">{won(r.amount)}</span> },
            { key: 'memo', label: '메모' },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="유형·카테고리 검색"
        />
      )}
    </Panel>
  )
}

// ── 재무 경보 탭 ─────────────────────────────────────────────
export function AlertsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    getCfoAlerts()
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const severityTone = {
    CRITICAL: 'border-rose-200 bg-rose-50 text-rose-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    OPPORTUNITY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  const severityLabel = { CRITICAL: '심각', WARNING: '주의', OPPORTUNITY: '기회' }

  const act = async (id, status) => {
    await updateCfoAlert(id, { status })
    load()
  }

  const alerts = data.alerts || []
  return (
    <div className="space-y-4">
      {alerts.length === 0 && <EmptyState message="현재 활성화된 재무 경보가 없습니다." />}
      {alerts.map((alert) => (
        <article key={alert.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${severityTone[alert.severity]}`}>
                  {severityLabel[alert.severity] || alert.severity}
                </span>
                <h3 className="text-sm font-black text-slate-900">{alert.title}</h3>
              </div>
              {alert.cause && <p className="mt-2 text-xs font-medium text-slate-500">원인: {alert.cause}</p>}
              {alert.impact_amount != null && (
                <p className="mt-1 text-xs font-bold text-slate-600">영향 금액: {won(alert.impact_amount)}</p>
              )}
              {alert.recommendation && (
                <p className="mt-1 text-xs font-bold text-sky-700">권장 조치: {alert.recommendation}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {alert.status === 'OPEN' && (
                <button type="button" onClick={() => act(alert.id, 'ACK')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">확인</button>
              )}
              <button type="button" onClick={() => act(alert.id, 'RESOLVED')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700">처리 완료</button>
              <button type="button" onClick={() => act(alert.id, 'DISMISSED')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-400 hover:bg-slate-50">무시</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

// ── 데이터 관리 탭 (CSV 업로드 + 원가 이력) ──────────────────
export function DataTab() {
  const [uploadType, setUploadType] = useState('cost')
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [costHistory, setCostHistory] = useState(null)
  const [costForm, setCostForm] = useState({ productCode: '', productName: '', productionCost: '', effectiveFrom: '' })
  const fileRef = useRef(null)

  const typeInfo = {
    cost: { label: '상품 원가 이력', format: '상품코드,채널명(옵션),SKU,상품명,제조원가,포장비,적용시작일(yyyy-MM-dd),메모' },
    fee: { label: '채널 수수료 이력', format: '채널명,상품코드(옵션),판매수수료%,결제수수료%,건당물류비,개당보관비,적용시작일,메모' },
    recurring: { label: '반복 고정비', format: '비용명,카테고리,금액,결제일,시작월(yyyy-MM),종료월(옵션),거래처,메모' },
    budget: { label: '예산·목표', format: '월(yyyy-MM),유형(REVENUE/EXPENSE...),카테고리,금액,메모' },
  }

  const loadCostHistory = () => {
    getCfoCostHistory().then((res) => setCostHistory(res.data)).catch(() => setCostHistory([]))
  }
  useEffect(loadCostHistory, [])

  const runUpload = async (dryRun) => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMessage('CSV 파일을 선택해주세요.'); return }
    setUploading(true)
    setMessage(null)
    try {
      const res = await uploadCfoCsv(uploadType, file, dryRun)
      setPreview(res.data)
      if (!dryRun) {
        setMessage(`저장 완료: ${res.data.savedCount}건`)
        loadCostHistory()
      }
    } catch (e) {
      setMessage(e?.response?.data?.message || e.message)
    } finally {
      setUploading(false)
    }
  }

  const submitCost = async () => {
    if (!costForm.productCode || !costForm.productionCost) return
    await addCfoCostHistory({
      productCode: costForm.productCode,
      productName: costForm.productName,
      productionCost: Number(costForm.productionCost),
      effectiveFrom: costForm.effectiveFrom || undefined,
    })
    setCostForm({ productCode: '', productName: '', productionCost: '', effectiveFrom: '' })
    loadCostHistory()
  }

  return (
    <div className="space-y-6">
      <Panel title="CSV 업로드 (미리보기 → 검증 → 저장)">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={uploadType} onChange={(e) => { setUploadType(e.target.value); setPreview(null) }} className={inputCls}>
            {Object.entries(typeInfo).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
          </select>
          <input ref={fileRef} type="file" accept=".csv" className="text-sm font-medium text-slate-600" />
          <button type="button" onClick={() => runUpload(true)} disabled={uploading}
            className="h-10 rounded-lg border border-sky-300 px-4 text-sm font-black text-sky-700 hover:bg-sky-50 disabled:opacity-50">
            미리보기·검증
          </button>
          <button type="button" onClick={() => runUpload(false)} disabled={uploading || !preview || (preview.errors || []).length > 0}
            className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-50">
            저장
          </button>
        </div>
        <p className="text-xs font-medium text-slate-400">형식: {typeInfo[uploadType].format}</p>
        {message && <p className="mt-3 text-sm font-black text-sky-700">{message}</p>}
        {preview && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">
              총 {preview.rowCount}행 · 오류 {(preview.errors || []).length}건 {preview.dryRun ? '(미리보기 — 아직 저장 안 됨)' : ''}
            </p>
            {(preview.errors || []).length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {preview.errors.map((err, index) => <p key={index}>{err}</p>)}
              </div>
            )}
            {(preview.preview || []).length > 0 && (
              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {JSON.stringify(preview.preview, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Panel>

      <Panel title="상품 원가 이력 (기간별 보존)">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <input value={costForm.productCode} onChange={(e) => setCostForm({ ...costForm, productCode: e.target.value })} placeholder="상품코드(SKU)" className={inputCls} />
          <input value={costForm.productName} onChange={(e) => setCostForm({ ...costForm, productName: e.target.value })} placeholder="상품명" className={inputCls} />
          <input value={costForm.productionCost} onChange={(e) => setCostForm({ ...costForm, productionCost: e.target.value })} placeholder="제조원가(원)" type="number" className={inputCls} />
          <input value={costForm.effectiveFrom} onChange={(e) => setCostForm({ ...costForm, effectiveFrom: e.target.value })} type="date" className={inputCls} />
          <button type="button" onClick={submitCost} className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700">원가 변경 등록</button>
        </div>
        <p className="mb-4 text-xs font-medium text-slate-400">
          새 원가를 등록하면 기존 구간은 자동 마감되고, 과거 주문은 당시 원가로 계산됩니다.
        </p>
        {costHistory == null ? <LoadingBox /> : costHistory.length === 0 ? <EmptyState message="등록된 원가 이력이 없습니다." /> : (
          <DataTable
            columns={[
              { key: 'product_code', label: '상품코드' },
              { key: 'product_name', label: '상품명' },
              { key: 'channel_name', label: '채널', render: (r) => r.channel_name || '공통' },
              { key: 'production_cost', label: '제조원가', render: (r) => <span className="block text-right font-black">{won(r.production_cost)}</span> },
              { key: 'effective_from', label: '적용 시작' },
              { key: 'effective_to', label: '적용 종료', render: (r) => r.effective_to || '현재' },
              { key: 'source', label: '출처' },
            ]}
            rows={costHistory}
            rowKey={(r) => r.id}
            searchPlaceholder="상품코드·상품명 검색"
          />
        )}
      </Panel>
    </div>
  )
}
