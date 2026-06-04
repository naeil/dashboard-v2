import { useEffect, useRef, useState } from 'react'
import {
  getAllCostData,
  uploadCostExcel,
  saveChannelProduct,
  updateChannelProduct,
  deleteChannelProduct,
  saveSku,
  updateSku,
  deleteSku,
  saveLogisticsFee,
  deleteLogisticsFee,
} from '../../api/productCostApi'

// ──────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────
const pct  = (v) => v != null ? (Number(v) * 100).toFixed(1) + '%' : '-'
const won  = (v) => v != null ? Number(v).toLocaleString('ko-KR') + '원' : '-'
const num  = (v) => v ?? ''
const amount = (v) => {
  const n = Number(String(v ?? 0).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
const toRate = (s) => {               // "6.0%" → 0.06, "0.06" → 0.06
  if (s === '' || s == null) return 0
  const f = parseFloat(String(s).replace('%', ''))
  if (isNaN(f)) return 0
  return f > 1 ? f / 100 : f
}

const CHANNELS = [
  '스마트스토어팜',
  '쿠팡',
  '자사몰',
  '11번가',
  '지마켓',
  '옥션',
  '카카오톡스토어',
  '해외(국가별)',
  '오프라인(납품처별)',
]

const CHANNEL_COLS = [
  { key: 'product_code',     label: '상품코드',     type: 'text',   width: 130 },
  { key: 'product_name',     label: '제품명',       type: 'text',   width: 180 },
  { key: 'sku_code',         label: 'SKU',          type: 'text',   width: 70  },
  { key: 'qty_per_unit',     label: '수량',         type: 'int',    width: 55  },
  { key: 'production_cost',  label: '생산원가',     type: 'won',    width: 90  },
  { key: 'list_price',       label: '정가',         type: 'won',    width: 90  },
  { key: 'consumer_price',   label: '소비자가',     type: 'won',    width: 90  },
  { key: 'channel_fee_rate', label: '채널수수료',   type: 'rate',   width: 80  },
  { key: 'marketing_rate',   label: '마케팅비',     type: 'rate',   width: 75  },
  { key: 'ad_rate',          label: '광고비',       type: 'rate',   width: 75  },
  { key: 'opex_rate',        label: '운영판관비',   type: 'rate',   width: 80  },
  { key: 'consumer_ship_fee',label: '배송비(소비자)',type: 'won',   width: 100 },
  { key: 'storage_fee_unit', label: '보관비',       type: 'won',    width: 75  },
]

const EMPTY_CHANNEL_ROW = {
  product_code: '', product_name: '', sku_code: '', qty_per_unit: 1,
  production_cost: 0, list_price: 0, consumer_price: 0,
  channel_fee_rate: 0, marketing_rate: 0.03, ad_rate: 0.10, opex_rate: 0.15,
  consumer_ship_fee: 0, storage_fee_unit: 0,
}

const calculateCostPreview = (row) => {
  const salesBase = amount(row.consumer_price) || amount(row.list_price)
  const productionCost = amount(row.production_cost)
  const consumerShipFee = amount(row.consumer_ship_fee)
  const storageFee = amount(row.storage_fee_unit)
  const channelFee = salesBase * amount(row.channel_fee_rate)
  const marketingFee = salesBase * amount(row.marketing_rate)
  const adFee = salesBase * amount(row.ad_rate)
  const opexFee = salesBase * amount(row.opex_rate)
  const salesProfit = salesBase - productionCost
  const operatingProfit = salesProfit - consumerShipFee - storageFee - channelFee - marketingFee - adFee - opexFee

  return {
    salesBase,
    salesProfit,
    salesMargin: salesBase > 0 ? salesProfit / salesBase : null,
    operatingProfit,
    operatingMargin: salesBase > 0 ? operatingProfit / salesBase : null,
  }
}

const profitTone = (value) => amount(value) < 0 ? 'is-negative' : 'is-positive'

const CALCULATED_COLS = [
  { key: 'sales_profit',     label: '매출이익',   width: 95, render: row => won(Math.round(calculateCostPreview(row).salesProfit)), align: 'right', tone: row => profitTone(calculateCostPreview(row).salesProfit) },
  { key: 'sales_margin',     label: '매출이익률', width: 85, render: row => pct(calculateCostPreview(row).salesMargin), align: 'right', tone: row => profitTone(calculateCostPreview(row).salesProfit) },
  { key: 'operating_profit', label: '영업이익',   width: 95, render: row => won(Math.round(calculateCostPreview(row).operatingProfit)), align: 'right', tone: row => profitTone(calculateCostPreview(row).operatingProfit) },
  { key: 'operating_margin', label: '영업이익률', width: 85, render: row => pct(calculateCostPreview(row).operatingMargin), align: 'right', tone: row => profitTone(calculateCostPreview(row).operatingProfit) },
]

// ──────────────────────────────────────────────────────────────
// 인라인 편집 셀
// ──────────────────────────────────────────────────────────────
function EditCell({ value, type, onSave, width }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const startEdit = () => {
    let init = value ?? ''
    if (type === 'rate') init = value != null ? (Number(value) * 100).toFixed(1) : '0'
    setDraft(String(init))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    setEditing(false)
    let parsed = draft
    if (type === 'won' || type === 'int') {
      parsed = parseInt(draft.replace(/,/g, ''), 10)
      if (isNaN(parsed)) parsed = 0
    } else if (type === 'rate') {
      parsed = toRate(draft)
    }
    onSave(parsed)
  }

  const display = () => {
    if (value == null || value === '') return <span style={{ color: '#999' }}>-</span>
    if (type === 'won') return won(value)
    if (type === 'rate') return pct(value)
    return value
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: (width - 16) + 'px', padding: '2px 4px', fontSize: 12,
          border: '1px solid #4f8ef7', borderRadius: 3, outline: 'none',
          background: '#1e3a5f', color: '#e0e8f8',
        }}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      title="클릭하여 수정"
      style={{ cursor: 'pointer', borderBottom: '1px dotted #5a7fa8', minWidth: 30, display: 'inline-block' }}
    >
      {display()}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────
// 채널 탭 테이블
// ──────────────────────────────────────────────────────────────
function ChannelTable({ channelName, rows, onRefresh, notify }) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ ...EMPTY_CHANNEL_ROW })
  const [saving, setSaving] = useState(false)
  const [tableRows, setTableRows] = useState(rows)

  useEffect(() => {
    setTableRows(rows)
  }, [rows])

  const handleCellSave = async (row, key, val) => {
    const updated = { ...row, [key]: val }
    setTableRows(prev => prev.map(item => item.id === row.id ? updated : item))
    try {
      if (row.id) {
        await updateChannelProduct(row.id, updated)
      } else {
        await saveChannelProduct({ ...updated, channel_name: channelName })
      }
      onRefresh()
    } catch {
      setTableRows(rows)
      notify('저장 실패', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    try {
      await deleteChannelProduct(id)
      onRefresh()
      notify('삭제되었습니다.', 'success')
    } catch {
      notify('삭제 실패', 'error')
    }
  }

  const handleAddSave = async () => {
    if (!newRow.product_code || !newRow.product_name) {
      notify('상품코드와 제품명은 필수입니다.', 'error'); return
    }
    setSaving(true)
    try {
      await saveChannelProduct({ ...newRow, channel_name: channelName })
      setNewRow({ ...EMPTY_CHANNEL_ROW })
      setAdding(false)
      onRefresh()
      notify('추가되었습니다.', 'success')
    } catch {
      notify('저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  const displayCols = [...CHANNEL_COLS, ...CALCULATED_COLS]
  const totalWidth = displayCols.reduce((s, c) => s + c.width, 0) + 80

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: totalWidth, fontSize: 12, width: '100%' }}>
        <thead>
          <tr style={{ background: '#1a3050', color: '#8ab4d8' }}>
            {displayCols.map(c => (
              <th key={c.key} style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', width: c.width, borderBottom: '1px solid #2a4060' }}>
                {c.label}
              </th>
            ))}
            <th style={{ padding: '6px 8px', width: 60, borderBottom: '1px solid #2a4060' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #1e3050' }}
              onMouseEnter={e => e.currentTarget.style.background = '#162840'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              {CHANNEL_COLS.map(c => (
                <td key={c.key} style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                  <EditCell
                    value={row[c.key]}
                    type={c.type}
                    width={c.width}
                    onSave={(val) => handleCellSave(row, c.key, val)}
                  />
                </td>
              ))}
              {CALCULATED_COLS.map(c => (
                <td key={c.key} className={`calculated-profit ${c.tone ? c.tone(row) : ''}`} style={{
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  textAlign: c.align || 'left',
                  fontWeight: 700,
                }}>
                  {c.render(row)}
                </td>
              ))}
              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                <button onClick={() => handleDelete(row.id)}
                  style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: 14 }}
                  title="삭제">✕</button>
              </td>
            </tr>
          ))}

          {/* 신규 행 입력 */}
          {adding && (
            <tr style={{ background: '#162840', borderBottom: '1px solid #2a5080' }}>
              {CHANNEL_COLS.map(c => (
                <td key={c.key} style={{ padding: '4px 8px' }}>
                  <input
                    value={c.type === 'rate' ? (newRow[c.key] != null ? (newRow[c.key] * 100).toFixed(1) : '') : (newRow[c.key] ?? '')}
                    onChange={e => {
                      let v = e.target.value
                      setNewRow(prev => ({ ...prev, [c.key]: v }))
                    }}
                    onBlur={e => {
                      let v = e.target.value
                      if (c.type === 'won' || c.type === 'int') v = parseInt(v.replace(/,/g, ''), 10) || 0
                      else if (c.type === 'rate') v = toRate(v)
                      setNewRow(prev => ({ ...prev, [c.key]: v }))
                    }}
                    placeholder={c.label}
                    style={{
                      width: (c.width - 12) + 'px', padding: '2px 4px', fontSize: 11,
                      background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3,
                      color: '#cce0f5', outline: 'none',
                    }}
                  />
                </td>
              ))}
              {CALCULATED_COLS.map(c => (
                <td key={c.key} className={`calculated-profit ${c.tone ? c.tone(newRow) : ''}`} style={{
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  textAlign: c.align || 'left',
                  fontWeight: 700,
                }}>
                  {c.render(newRow)}
                </td>
              ))}
              <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button onClick={handleAddSave} disabled={saving}
                  style={{ background: '#2a6496', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', marginRight: 4, fontSize: 11 }}>
                  저장
                </button>
                <button onClick={() => setAdding(false)}
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 10 }}>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ background: 'none', border: '1px dashed #4a7aaa', color: '#6ab0e0', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
            + 제품 추가
          </button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// SKU 마스터 탭
// ──────────────────────────────────────────────────────────────
function SkuTable({ skus, onRefresh, notify }) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ sku_code: '', product_name: '', weight_g: 0, temp_type: '상온', production_cost: 0 })
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState(null)

  const handleDelete = async (id) => {
    if (!window.confirm('삭제할까요?')) return
    try { await deleteSku(id); onRefresh(); notify('삭제되었습니다.', 'success') }
    catch { notify('삭제 실패', 'error') }
  }

  const handleAdd = async () => {
    if (!newRow.sku_code) { notify('SKU 코드는 필수입니다.', 'error'); return }
    try {
      await saveSku(newRow)
      setNewRow({ sku_code: '', product_name: '', weight_g: 0, temp_type: '상온', production_cost: 0 })
      setAdding(false)
      onRefresh()
      notify('추가되었습니다.', 'success')
    } catch { notify('저장 실패', 'error') }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditRow({ ...row })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRow(null)
  }

  const handleEditSave = async () => {
    if (!editRow?.sku_code) { notify('SKU 코드는 필수입니다.', 'error'); return }
    try {
      await updateSku(editingId, {
        ...editRow,
        weight_g: parseInt(String(editRow.weight_g ?? 0).replace(/,/g, ''), 10) || 0,
        production_cost: parseInt(String(editRow.production_cost ?? 0).replace(/,/g, ''), 10) || 0,
      })
      cancelEdit()
      onRefresh()
      notify('SKU 정보가 수정되었습니다.', 'success')
    } catch {
      notify('수정 실패', 'error')
    }
  }

  const cols = [
    { key: 'sku_code', label: 'SKU 코드', w: 90 },
    { key: 'product_name', label: '제품명', w: 200 },
    { key: 'temp_type', label: '냉동/상온', w: 80 },
    { key: 'weight_g', label: '무게(g)', w: 80, align: 'right' },
    { key: 'production_cost', label: '생산원가', w: 100, fmt: won, align: 'right' },
    { key: 'note', label: '비고', w: 150 },
  ]

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr style={{ background: '#1a3050', color: '#8ab4d8' }}>
            {cols.map(c => <th key={c.key} style={{ padding: '6px 8px', textAlign: c.align || 'left', width: c.w, borderBottom: '1px solid #2a4060' }}>{c.label}</th>)}
            <th style={{ padding: '6px 8px', width: 110, borderBottom: '1px solid #2a4060' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {skus.map(row => (
            <tr key={row.id} style={{ borderBottom: '1px solid #1e3050' }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '4px 8px', textAlign: c.align || 'left' }}>
                  {editingId === row.id ? (
                    c.key === 'temp_type' ? (
                      <select value={editRow?.temp_type || '상온'} onChange={e => setEditRow(p => ({ ...p, temp_type: e.target.value }))}
                        style={{ width: (c.w - 10) + 'px', padding: '2px 4px', fontSize: 11, background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3, color: '#cce0f5' }}>
                        <option>상온</option><option>냉동</option>
                      </select>
                    ) : (
                      <input value={editRow?.[c.key] ?? ''} onChange={e => setEditRow(p => ({ ...p, [c.key]: e.target.value }))}
                        placeholder={c.label}
                        style={{ width: (c.w - 10) + 'px', padding: '2px 4px', fontSize: 11, background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3, color: '#cce0f5', outline: 'none' }}
                      />
                    )
                  ) : (
                    c.key === 'product_name' && !row[c.key]
                      ? <span style={{ color: '#dc2626', fontWeight: 700 }}>제품명 필요</span>
                      : (c.fmt ? c.fmt(row[c.key]) : row[c.key])
                  )}
                </td>
              ))}
              <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {editingId === row.id ? (
                  <>
                    <button onClick={handleEditSave} style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 4 }}>저장</button>
                    <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>취소</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(row)} style={{ background: 'none', border: '1px solid #38bdf8', color: '#0369a1', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '2px 7px', marginRight: 4 }}>수정</button>
                    <button onClick={() => handleDelete(row.id)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {adding && (
            <tr style={{ background: '#162840' }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '4px 6px' }}>
                  {c.key === 'temp_type' ? (
                    <select value={newRow.temp_type} onChange={e => setNewRow(p => ({ ...p, temp_type: e.target.value }))}
                      style={{ background: '#0d2035', color: '#cce0f5', border: '1px solid #3a6090', borderRadius: 3, fontSize: 11, padding: '2px' }}>
                      <option>상온</option><option>냉동</option>
                    </select>
                  ) : (
                    <input value={newRow[c.key] ?? ''} onChange={e => setNewRow(p => ({ ...p, [c.key]: e.target.value }))}
                      placeholder={c.label}
                      style={{ width: (c.w - 10) + 'px', padding: '2px 4px', fontSize: 11, background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3, color: '#cce0f5', outline: 'none' }}
                    />
                  )}
                </td>
              ))}
              <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button onClick={handleAdd} style={{ background: '#2a6496', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 4 }}>저장</button>
                <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!adding && (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 10, background: 'none', border: '1px dashed #4a7aaa', color: '#6ab0e0', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          + SKU 추가
        </button>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// 물류비 구간 탭
// ──────────────────────────────────────────────────────────────
function LogisticsTable({ fees, onRefresh, notify }) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ temp_type: '냉동', weight_limit_g: '', fee: '' })

  const handleDelete = async (id) => {
    if (!window.confirm('삭제할까요?')) return
    try { await deleteLogisticsFee(id); onRefresh(); notify('삭제되었습니다.', 'success') }
    catch { notify('삭제 실패', 'error') }
  }

  const handleAdd = async () => {
    if (!newRow.weight_limit_g || !newRow.fee) { notify('모든 필드를 입력하세요.', 'error'); return }
    try {
      await saveLogisticsFee({ ...newRow, weight_limit_g: parseInt(newRow.weight_limit_g), fee: parseFloat(newRow.fee) })
      setNewRow({ temp_type: '냉동', weight_limit_g: '', fee: '' })
      setAdding(false)
      onRefresh()
      notify('추가되었습니다.', 'success')
    } catch { notify('저장 실패', 'error') }
  }

  const frozen = fees.filter(f => f.temp_type === '냉동')
  const ambient = fees.filter(f => f.temp_type === '상온')

  const FeeGroup = ({ label, rows }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: '#8ab4d8', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{label}</div>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', maxWidth: 400 }}>
        <thead>
          <tr style={{ background: '#1a3050', color: '#8ab4d8' }}>
            <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #2a4060' }}>무게 상한(g)</th>
            <th style={{ padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid #2a4060' }}>택배비</th>
            <th style={{ padding: '6px 12px', width: 60, borderBottom: '1px solid #2a4060' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #1e3050' }}>
              <td style={{ padding: '4px 12px' }}>{r.weight_limit_g === 999999 ? '초과' : r.weight_limit_g.toLocaleString() + 'g'}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{won(r.fee)}</td>
              <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        <FeeGroup label="냉동" rows={frozen} />
        <FeeGroup label="상온" rows={ambient} />
      </div>

      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <select value={newRow.temp_type} onChange={e => setNewRow(p => ({ ...p, temp_type: e.target.value }))}
            style={{ background: '#0d2035', color: '#cce0f5', border: '1px solid #3a6090', borderRadius: 3, padding: '4px 8px', fontSize: 12 }}>
            <option>냉동</option><option>상온</option>
          </select>
          <input placeholder="무게 상한(g) e.g. 1000" value={newRow.weight_limit_g}
            onChange={e => setNewRow(p => ({ ...p, weight_limit_g: e.target.value }))}
            style={{ width: 160, padding: '4px 8px', fontSize: 12, background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3, color: '#cce0f5', outline: 'none' }} />
          <input placeholder="택배비(원)" value={newRow.fee}
            onChange={e => setNewRow(p => ({ ...p, fee: e.target.value }))}
            style={{ width: 120, padding: '4px 8px', fontSize: 12, background: '#0d2035', border: '1px solid #3a6090', borderRadius: 3, color: '#cce0f5', outline: 'none' }} />
          <button onClick={handleAdd} style={{ background: '#2a6496', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>저장</button>
          <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>취소</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 8, background: 'none', border: '1px dashed #4a7aaa', color: '#6ab0e0', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          + 구간 추가
        </button>
      )}
    </div>
  )
}

function buildCostOverview(data) {
  const rows = []
  Object.entries(data.channels || {}).forEach(([channelName, channelRows]) => {
    ;(channelRows || []).forEach(row => {
      const nameKey = String(row.product_name || '').trim().toLowerCase()
      const codeKey = String(row.product_code || '').trim().toLowerCase()
      const key = nameKey || codeKey || `row-${row.id}`
      const preview = calculateCostPreview(row)
      rows.push({
        key,
        channelName,
        productCode: row.product_code || '',
        productName: row.product_name || '',
        skuCode: row.sku_code || '',
        salesBase: preview.salesBase,
        operatingMargin: preview.operatingMargin,
        operatingProfit: preview.operatingProfit,
      })
    })
  })

  const grouped = new Map()
  rows.forEach(row => {
    const group = grouped.get(row.key) || {
      key: row.key,
      productCode: row.productCode,
      productName: row.productName,
      skuCodes: new Set(),
      channels: [],
      totalRows: 0,
      minMargin: null,
      maxMargin: null,
      totalOperatingProfit: 0,
    }
    if (!group.productCode && row.productCode) group.productCode = row.productCode
    if (!group.productName && row.productName) group.productName = row.productName
    if (row.skuCode) group.skuCodes.add(row.skuCode)
    group.channels.push(row.channelName)
    group.totalRows += 1
    group.totalOperatingProfit += row.operatingProfit
    if (row.operatingMargin != null) {
      group.minMargin = group.minMargin == null ? row.operatingMargin : Math.min(group.minMargin, row.operatingMargin)
      group.maxMargin = group.maxMargin == null ? row.operatingMargin : Math.max(group.maxMargin, row.operatingMargin)
    }
    grouped.set(row.key, group)
  })

  return Array.from(grouped.values())
    .map(row => ({
      ...row,
      skuCodes: Array.from(row.skuCodes),
      channels: Array.from(new Set(row.channels)),
      duplicateCount: Math.max(0, row.totalRows - 1),
    }))
    .sort((a, b) => b.duplicateCount - a.duplicateCount || String(a.productName).localeCompare(String(b.productName), 'ko'))
}

function CostOverviewTable({ data }) {
  const rows = buildCostOverview(data)
  const duplicateRows = rows.filter(row => row.duplicateCount > 0).length
  const missingSkuNames = (data.skuMaster || []).filter(row => !String(row.product_name || '').trim()).length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>통합 상품</div>
          <div style={{ fontSize: 20, color: '#0f172a', fontWeight: 800 }}>{rows.length.toLocaleString('ko-KR')}개</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>중복 표시 상품</div>
          <div style={{ fontSize: 20, color: '#0f172a', fontWeight: 800 }}>{duplicateRows.toLocaleString('ko-KR')}개</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>제품명 필요 SKU</div>
          <div style={{ fontSize: 20, color: missingSkuNames ? '#dc2626' : '#047857', fontWeight: 800 }}>{missingSkuNames.toLocaleString('ko-KR')}개</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ padding: '7px 8px', textAlign: 'left' }}>제품명</th>
              <th style={{ padding: '7px 8px', textAlign: 'left' }}>대표 상품코드</th>
              <th style={{ padding: '7px 8px', textAlign: 'left' }}>SKU</th>
              <th style={{ padding: '7px 8px', textAlign: 'left' }}>등록 채널</th>
              <th style={{ padding: '7px 8px', textAlign: 'right' }}>중복 행</th>
              <th style={{ padding: '7px 8px', textAlign: 'right' }}>영업이익률 범위</th>
              <th style={{ padding: '7px 8px', textAlign: 'right' }}>영업이익 합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>{row.productName || '-'}</td>
                <td style={{ padding: '6px 8px' }}>{row.productCode || '-'}</td>
                <td style={{ padding: '6px 8px' }}>{row.skuCodes.length ? row.skuCodes.join(', ') : '-'}</td>
                <td style={{ padding: '6px 8px' }}>{row.channels.join(', ')}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: row.duplicateCount ? '#b45309' : '#64748b', fontWeight: 800 }}>
                  {row.duplicateCount ? `+${row.duplicateCount}` : '-'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {row.minMargin == null ? '-' : row.minMargin === row.maxMargin ? pct(row.minMargin) : `${pct(row.minMargin)} ~ ${pct(row.maxMargin)}`}
                </td>
                <td className={`calculated-profit ${profitTone(row.totalOperatingProfit)}`} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>
                  {won(Math.round(row.totalOperatingProfit))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────────
export default function ProductCostPage() {
  const [data, setData] = useState({ channels: {}, skuMaster: [], logisticsFees: [] })
  const [activeTab, setActiveTab] = useState('통합정리')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const fileRef = useRef(null)

  const notify = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAllCostData()
      setData(res.data)
    } catch {
      notify('데이터 로드 실패', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadCostExcel(file)
      const r = res.data
      notify(`업로드 완료 — ${r.message}. 총 ${r.totalChannelRows}개 채널행, SKU ${r.skuMaster}`, 'success')
      await load()
    } catch (err) {
      notify(err?.response?.data?.message || '업로드 실패', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const tabs = ['통합정리', ...CHANNELS, 'SKU마스터', '물류비구간']
  const msgBg = { success: '#1a4a2a', error: '#4a1a1a', info: '#1a3050' }

  return (
    <div className="product-cost-page" style={{ padding: '20px 24px', minHeight: '100vh', background: '#0d1b2e', color: '#c8dff0', fontFamily: 'sans-serif' }}>
      {/* 헤더 */}
      <div className="product-cost-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#e8f4ff', fontWeight: 700 }}>제품 원가 관리</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6a9abf' }}>
            채널별 제품 원가·수수료율을 관리합니다. 셀을 클릭하면 바로 수정됩니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: 'none' }} id="cost-excel-upload" />
          <label htmlFor="cost-excel-upload"
            style={{
              background: uploading ? '#1a3a5c' : '#1e5a9a',
              color: uploading ? '#8ab4d8' : '#fff',
              border: 'none', borderRadius: 6, padding: '8px 16px', cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
            {uploading ? '업로드 중...' : '엑셀 업로드'}
          </label>
        </div>
      </div>

      {/* 알림 */}
      {message.text && (
        <div style={{
          background: msgBg[message.type] || '#1a3050',
          border: `1px solid ${message.type === 'success' ? '#2a6a3a' : message.type === 'error' ? '#6a2a2a' : '#2a5070'}`,
          borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 13,
          color: message.type === 'success' ? '#6ee89a' : message.type === 'error' ? '#f08080' : '#8ab4d8',
        }}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div className="product-cost-tabs" style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #1e3050', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={activeTab === t ? 'is-active' : ''}
            style={{
              background: activeTab === t ? '#1a4070' : 'none',
              color: activeTab === t ? '#7bc8ff' : '#6a9abf',
              border: 'none', borderBottom: activeTab === t ? '2px solid #4a8fcf' : '2px solid transparent',
              padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
              borderRadius: '4px 4px 0 0',
            }}>
            {t}
            {CHANNELS.includes(t) && data.channels[t] && (
              <span style={{ marginLeft: 5, fontSize: 10, color: '#4a8fcf' }}>
                ({(data.channels[t] || []).length})
              </span>
            )}
            {t === 'SKU마스터' && (data.skuMaster || []).some(row => !String(row.product_name || '').trim()) && (
              <span style={{ marginLeft: 5, fontSize: 10, color: '#dc2626' }}>
                ({(data.skuMaster || []).filter(row => !String(row.product_name || '').trim()).length}명 필요)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      {loading ? (
        <div style={{ color: '#6a9abf', fontSize: 14, padding: 20 }}>로딩 중...</div>
      ) : (
        <div className="product-cost-content" style={{ background: '#111e2e', borderRadius: 8, padding: 16 }}>
          {activeTab === '통합정리' && (
            <CostOverviewTable data={data} />
          )}
          {CHANNELS.includes(activeTab) && (
            <ChannelTable
              channelName={activeTab}
              rows={data.channels[activeTab] || []}
              onRefresh={load}
              notify={notify}
            />
          )}
          {activeTab === 'SKU마스터' && (
            <SkuTable skus={data.skuMaster || []} onRefresh={load} notify={notify} />
          )}
          {activeTab === '물류비구간' && (
            <LogisticsTable fees={data.logisticsFees || []} onRefresh={load} notify={notify} />
          )}
        </div>
      )}

      {/* 원가 계산 가이드 */}
      <div className="product-cost-formula" style={{ marginTop: 20, background: '#0a1828', borderRadius: 8, padding: 16, fontSize: 12, color: '#6a9abf', border: '1px solid #1a3050' }}>
        <div style={{ fontWeight: 600, color: '#8ab4d8', marginBottom: 8 }}>💡 영업이익 계산 공식</div>
        <div style={{ lineHeight: 2 }}>
          <span style={{ color: '#4fc3f7' }}>매출(pay_amt)</span>
          {' − 생산원가 − 물류비(SKU 무게·냉동구분 기준) − 채널수수료(pay_amt×rate) − 마케팅비(3%) − 광고비 − 운영판관비(15%)'}
          {' = '}<span style={{ color: '#81c784' }}>영업이익</span>
        </div>
        <div style={{ marginTop: 6, color: '#4a7a9a' }}>
          채널별 매출 페이지에서 상품코드를 기반으로 자동 조인되어 계산됩니다.
        </div>
      </div>
    </div>
  )
}
