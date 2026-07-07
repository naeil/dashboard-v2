import { useEffect, useState, createElement as h } from 'react'
import {
    getSalesEntries, createSalesEntry, deleteSalesEntry, uploadSalesExcel, downloadSalesTemplate,
    getAdCostEntries, createAdCostEntry, deleteAdCostEntry, uploadAdCostExcel, downloadAdCostTemplate,
    getInventoryEntries, createInventoryEntry, deleteInventoryEntry, uploadInventoryExcel, downloadInventoryTemplate,
    getOtherCostEntries, createOtherCostEntry, deleteOtherCostEntry, uploadOtherCostExcel, downloadOtherCostTemplate,
    getFieldDataSummary,
} from '../../api/fieldDataInputApi'

const TABS = [
  { id: 'sales', label: '매출 업로드' },
  { id: 'ad-costs', label: '광고비 업로드' },
  { id: 'inventory', label: '재고/발주 시트' },
  { id: 'other-costs', label: '기타비용' },
  ]

const UPLOAD_HANDLERS = {
    sales: uploadSalesExcel,
    'ad-costs': uploadAdCostExcel,
    inventory: uploadInventoryExcel,
    'other-costs': uploadOtherCostExcel,
}

const TEMPLATE_HANDLERS = {
    sales: downloadSalesTemplate,
    'ad-costs': downloadAdCostTemplate,
    inventory: downloadInventoryTemplate,
    'other-costs': downloadOtherCostTemplate,
}

const TEMPLATE_FILENAMES = {
    sales: 'sales_template.xlsx',
    'ad-costs': 'ad_costs_template.xlsx',
    inventory: 'inventory_template.xlsx',
    'other-costs': 'other_costs_template.xlsx',
}

const COLUMN_LABELS = {
    entryDate: '입력일자',
    channelName: '채널명',
    productId: '제품 ID',
    quantity: '수량',
    salesAmount: '매출액',
        costAmount: '원가',
    memo: '메모',
    adCostAmount: '광고비',
    conversions: '전환수',
    entryType: '구분',
    costCategory: '비용 항목',
    amount: '금액',
}

function todayIso() {
    return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthIso() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const emptySalesForm = { brandId: '', productId: '', channelName: '', entryDate: todayIso(), quantity: '', salesAmount: '', costAmount: '', memo: '' }
const emptyAdCostForm = { brandId: '', productId: '', channelName: '', entryDate: todayIso(), adCostAmount: '', impressions: '', clicks: '', conversions: '', memo: '' }
const emptyInventoryForm = { brandId: '', productId: '', entryType: 'INBOUND', entryDate: todayIso(), quantity: '', memo: '' }
const emptyOtherCostForm = { brandId: '', productId: '', costCategory: '', entryDate: todayIso(), amount: '', memo: '' }

function toNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
}

export default function FieldDataInputPage({ displayName, username }) {
    const [activeTab, setActiveTab] = useState('sales')

  const [salesEntries, setSalesEntries] = useState([])
    const [adCostEntries, setAdCostEntries] = useState([])
    const [inventoryEntries, setInventoryEntries] = useState([])
    const [otherCostEntries, setOtherCostEntries] = useState([])

  const [salesForm, setSalesForm] = useState(emptySalesForm)
    const [adCostForm, setAdCostForm] = useState(emptyAdCostForm)
    const [inventoryForm, setInventoryForm] = useState(emptyInventoryForm)
    const [otherCostForm, setOtherCostForm] = useState(emptyOtherCostForm)

  const [summaryStart, setSummaryStart] = useState(firstDayOfMonthIso())
    const [summaryEnd, setSummaryEnd] = useState(todayIso())
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

  const [uploadFile, setUploadFile] = useState(null)
    const [uploadMessage, setUploadMessage] = useState('')
    const [uploading, setUploading] = useState(false)

  const createdBy = displayName || username || 'unknown'

async function loadAll() {
      try {
              const [salesRes, adCostRes, inventoryRes, otherCostRes] = await Promise.all([
                        getSalesEntries(), getAdCostEntries(), getInventoryEntries(), getOtherCostEntries(),
                      ])
              setSalesEntries(salesRes.data || [])
              setAdCostEntries(adCostRes.data || [])
              setInventoryEntries(inventoryRes.data || [])
              setOtherCostEntries(otherCostRes.data || [])
      } catch (err) {
              setError('실무 입력 데이터를 불러오지 못했습니다. 백엔드가 아직 배포되지 않았을 수 있습니다.')
      }
}

  async function loadSummary() {
        setLoading(true)
        setError('')
        try {
                const res = await getFieldDataSummary(summaryStart, summaryEnd)
                setSummary(res.data)
        } catch (err) {
                setError('L1/L2 요약 데이터를 불러오지 못했습니다. 백엔드가 아직 배포되지 않았을 수 있습니다.')
        } finally {
                setLoading(false)
        }
  }

  useEffect(() => {
        loadAll()
        loadSummary()
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectTab(id) {
        setActiveTab(id)
        setUploadFile(null)
        setUploadMessage('')
  }

async function submitSales(event) {
      event.preventDefault()
      const payload = {
              brandId: toNumberOrNull(salesForm.brandId),
              productId: toNumberOrNull(salesForm.productId),
              channelName: salesForm.channelName || null,
              entryDate: salesForm.entryDate,
              quantity: toNumberOrNull(salesForm.quantity) || 0,
              salesAmount: toNumberOrNull(salesForm.salesAmount) || 0,
              costAmount: toNumberOrNull(salesForm.costAmount) || 0,
              memo: salesForm.memo || null,
      }
      await createSalesEntry(payload, 1, createdBy)
      setSalesForm(emptySalesForm)
      loadAll()
}

  async function submitAdCost(event) {
        event.preventDefault()
        const payload = {
                brandId: toNumberOrNull(adCostForm.brandId),
                productId: toNumberOrNull(adCostForm.productId),
                channelName: adCostForm.channelName || null,
                entryDate: adCostForm.entryDate,
                adCostAmount: toNumberOrNull(adCostForm.adCostAmount) || 0,
                impressions: toNumberOrNull(adCostForm.impressions) || 0,
                clicks: toNumberOrNull(adCostForm.clicks) || 0,
                conversions: toNumberOrNull(adCostForm.conversions) || 0,
                memo: adCostForm.memo || null,
        }
        await createAdCostEntry(payload, 1, createdBy)
        setAdCostForm(emptyAdCostForm)
        loadAll()
  }

async function submitInventory(event) {
      event.preventDefault()
      const payload = {
              brandId: toNumberOrNull(inventoryForm.brandId),
              productId: toNumberOrNull(inventoryForm.productId),
              entryType: inventoryForm.entryType,
              entryDate: inventoryForm.entryDate,
              quantity: toNumberOrNull(inventoryForm.quantity) || 0,
              memo: inventoryForm.memo || null,
      }
      await createInventoryEntry(payload, 1, createdBy)
      setInventoryForm(emptyInventoryForm)
      loadAll()
}

  async function submitOtherCost(event) {
        event.preventDefault()
        const payload = {
                brandId: toNumberOrNull(otherCostForm.brandId),
                productId: toNumberOrNull(otherCostForm.productId),
                costCategory: otherCostForm.costCategory,
                entryDate: otherCostForm.entryDate,
                amount: toNumberOrNull(otherCostForm.amount) || 0,
                memo: otherCostForm.memo || null,
        }
        await createOtherCostEntry(payload, 1, createdBy)
        setOtherCostForm(emptyOtherCostForm)
        loadAll()
  }

  async function removeEntry(kind, id) {
        if (kind === 'sales') await deleteSalesEntry(id)
        if (kind === 'ad-costs') await deleteAdCostEntry(id)
        if (kind === 'inventory') await deleteInventoryEntry(id)
        if (kind === 'other-costs') await deleteOtherCostEntry(id)
        loadAll()
        loadSummary()
  }

async function handleExcelUpload(event) {
      event.preventDefault()
      if (!uploadFile) {
              setUploadMessage('업로드할 엑셀 파일을 선택해주세요.')
              return
      }
      setUploading(true)
      setUploadMessage('')
      try {
              const uploadFn = UPLOAD_HANDLERS[activeTab]
              const res = await uploadFn(uploadFile, 1, createdBy)
              const { insertedCount, errors } = res.data
              let msg = `${insertedCount}건이 저장되었습니다.`
              if (errors && errors.length > 0) {
                        msg += ` (오류 ${errors.length}건: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ' 외' : ''})`
              }
              setUploadMessage(msg)
              setUploadFile(null)
              loadAll()
              loadSummary()
      } catch (err) {
              setUploadMessage('엑셀 업로드에 실패했습니다. 파일 형식을 확인해주세요.')
      } finally {
              setUploading(false)
      }
}

  async function handleTemplateDownload() {
        try {
                const templateFn = TEMPLATE_HANDLERS[activeTab]
                const res = await templateFn()
                const url = window.URL.createObjectURL(new Blob([res.data]))
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', TEMPLATE_FILENAMES[activeTab])
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)
        } catch (err) {
                setUploadMessage('템플릿 다운로드에 실패했습니다.')
        }
  }

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
    const labelClass = 'text-xs font-bold text-slate-500'

  function field(value, onChange, placeholder, type) {
        return h('input', { className: inputClass, placeholder: placeholder, type: type || 'text', value: value, onChange: (e) => onChange(e.target.value) })
  }

  const salesFormEl = h('form', { onSubmit: submitSales, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                            field(salesForm.brandId, (v) => setSalesForm({ ...salesForm, brandId: v }), '브랜드 ID'),
                            field(salesForm.productId, (v) => setSalesForm({ ...salesForm, productId: v }), '제품 ID'),
                            field(salesForm.channelName, (v) => setSalesForm({ ...salesForm, channelName: v }), '채널명'),
                            field(salesForm.entryDate, (v) => setSalesForm({ ...salesForm, entryDate: v }), '입력일자', 'date'),
                            field(salesForm.quantity, (v) => setSalesForm({ ...salesForm, quantity: v }), '수량'),
                            field(salesForm.salesAmount, (v) => setSalesForm({ ...salesForm, salesAmount: v }), '매출액'),
                            field(salesForm.costAmount, (v) => setSalesForm({ ...salesForm, costAmount: v }), '원가'),
                            field(salesForm.memo, (v) => setSalesForm({ ...salesForm, memo: v }), '메모'),
                            h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, '저장')
                          )

const adCostFormEl = h('form', { onSubmit: submitAdCost, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                           field(adCostForm.brandId, (v) => setAdCostForm({ ...adCostForm, brandId: v }), '브랜드 ID'),
                           field(adCostForm.productId, (v) => setAdCostForm({ ...adCostForm, productId: v }), '제품 ID'),
                           field(adCostForm.channelName, (v) => setAdCostForm({ ...adCostForm, channelName: v }), '채널명'),
                           field(adCostForm.entryDate, (v) => setAdCostForm({ ...adCostForm, entryDate: v }), '입력일자', 'date'),
                           field(adCostForm.adCostAmount, (v) => setAdCostForm({ ...adCostForm, adCostAmount: v }), '광고비'),
                           field(adCostForm.impressions, (v) => setAdCostForm({ ...adCostForm, impressions: v }), '노출수'),
                           field(adCostForm.clicks, (v) => setAdCostForm({ ...adCostForm, clicks: v }), '클릭수'),
                           field(adCostForm.conversions, (v) => setAdCostForm({ ...adCostForm, conversions: v }), '전환수'),
                           field(adCostForm.memo, (v) => setAdCostForm({ ...adCostForm, memo: v }), '메모'),
                           h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, '저장')
                         )

const inventoryTypeSelect = h('select', {
      className: inputClass,
      value: inventoryForm.entryType,
      onChange: (e) => setInventoryForm({ ...inventoryForm, entryType: e.target.value }),
},
                                  h('option', { value: 'INBOUND' }, '입고'),
                                  h('option', { value: 'OUTBOUND' }, '출고'),
                                  h('option', { value: 'ORDER_REQUEST' }, '발주 요청')
                                )

  const inventoryFormEl = h('form', { onSubmit: submitInventory, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                                field(inventoryForm.brandId, (v) => setInventoryForm({ ...inventoryForm, brandId: v }), '브랜드 ID'),
                                field(inventoryForm.productId, (v) => setInventoryForm({ ...inventoryForm, productId: v }), '제품 ID'),
                                inventoryTypeSelect,
                                field(inventoryForm.entryDate, (v) => setInventoryForm({ ...inventoryForm, entryDate: v }), '입력일자', 'date'),
                                field(inventoryForm.quantity, (v) => setInventoryForm({ ...inventoryForm, quantity: v }), '수량'),
                                field(inventoryForm.memo, (v) => setInventoryForm({ ...inventoryForm, memo: v }), '메모'),
                                h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, '저장')
                              )

const otherCostFormEl = h('form', { onSubmit: submitOtherCost, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                              field(otherCostForm.brandId, (v) => setOtherCostForm({ ...otherCostForm, brandId: v }), '브랜드 ID'),
                              field(otherCostForm.productId, (v) => setOtherCostForm({ ...otherCostForm, productId: v }), '제품 ID'),
                              field(otherCostForm.costCategory, (v) => setOtherCostForm({ ...otherCostForm, costCategory: v }), '비용 항목 (예: 물류비, 판관비, 바이럴비)'),
                              field(otherCostForm.entryDate, (v) => setOtherCostForm({ ...otherCostForm, entryDate: v }), '입력일자', 'date'),
                              field(otherCostForm.amount, (v) => setOtherCostForm({ ...otherCostForm, amount: v }), '금액'),
                              field(otherCostForm.memo, (v) => setOtherCostForm({ ...otherCostForm, memo: v }), '메모'),
                              h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, '저장')
                            )

const excelUploadBox = h('div', { className: 'mt-5 rounded-lg border border-dashed border-sky-300 bg-sky-50/40 p-4' },
                             h('p', { className: 'text-xs font-black text-sky-700' }, '엑셀 업로드'),
                             h('p', { className: 'mt-1 text-xs text-slate-500' }, '템플릿을 다운로드해 형식에 맞춰 데이터를 채운 뒤 업로드하면 여러 건을 한 번에 등록할 수 있습니다.'),
                             h('form', { onSubmit: handleExcelUpload, className: 'mt-3 flex flex-wrap items-center gap-3' },
                                     h('input', {
                                               type: 'file', accept: '.xlsx,.xls',
                                               onChange: (e) => setUploadFile(e.target.files && e.target.files[0] ? e.target.files[0] : null),
                                               className: 'text-sm',
                                     }),
                                     h('button', { type: 'submit', disabled: uploading, className: 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50' }, uploading ? '업로드 중...' : '엑셀 업로드'),
                                     h('button', { type: 'button', onClick: handleTemplateDownload, className: 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-600' }, '템플릿 다운로드')
                                   ),
                             uploadMessage ? h('p', { className: 'mt-2 text-xs font-bold text-slate-600' }, uploadMessage) : null
                           )

function summaryCard(label, value, highlight, warn) {
      const bg = warn ? 'bg-amber-50' : highlight ? 'bg-sky-50' : 'bg-slate-50'
      const textColor = warn ? 'text-amber-700' : highlight ? 'text-sky-700' : 'text-slate-950'
      return h('div', { className: `rounded-lg ${bg} p-4` },
                     h('p', { className: labelClass }, label),
                     h('p', { className: `text-lg font-black ${textColor}` }, value)
                   )
}

  function entryTable(columns, rows, onDelete) {
        if (!rows || rows.length === 0) {
                return h('p', { className: 'text-sm text-slate-400' }, '등록된 데이터가 없습니다.')
        }
        return h('table', { className: 'w-full text-sm' },
                       h('thead', null, h('tr', { className: 'text-left text-xs font-bold text-slate-400' },
                                                  columns.map((col) => h('th', { key: col, className: 'py-1 pr-3' }, COLUMN_LABELS[col] || col)),
                                                  h('th', { key: '_actions', className: 'py-1' })
                                                )),
                       h('tbody', null, rows.map((row) => h('tr', { key: row.id, className: 'border-t border-slate-100' },
                                                                    columns.map((col) => h('td', { key: col, className: 'py-1 pr-3' }, String(row[col]))),
                                                                    h('td', { key: '_actions', className: 'py-1' },
                                                                                h('button', { type: 'button', onClick: () => onDelete(row.id), className: 'text-xs font-bold text-rose-500' }, '삭제')
                                                                              )
                                                                  )))
                     )
  }

return h('div', { className: 'space-y-6' },
             h('div', null,
                     h('p', { className: 'text-xs font-black uppercase tracking-[0.2em] text-sky-600' }, 'L0 · 실무 입력 레이어'),
                     h('h1', { className: 'mt-1 text-2xl font-black text-slate-950' }, '실무 데이터 입력 (매출 · 광고비 · 재고/발주 · 기타비용)'),
                     h('p', { className: 'mt-2 text-sm text-slate-500' }, '실무진이 여기에 원본 수치를 입력하면, 시스템이 자동으로 제품별 · 브랜드별로 집계하여 아래 요약 패널에 표시합니다.')
                   ),
             error ? h('div', { className: 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600' }, error) : null,
             h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5' },
                     h('div', { className: 'flex flex-wrap items-end gap-3' },
                               h('div', null, h('p', { className: labelClass }, '시작일'), h('input', { type: 'date', className: inputClass, value: summaryStart, onChange: (e) => setSummaryStart(e.target.value) })),
                               h('div', null, h('p', { className: labelClass }, '종료일'), h('input', { type: 'date', className: inputClass, value: summaryEnd, onChange: (e) => setSummaryEnd(e.target.value) })),
                               h('button', { type: 'button', onClick: loadSummary, className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, loading ? '불러오는 중...' : '요약 새로고침')
                             ),
               summary ? h('div', { className: 'mt-5 grid grid-cols-2 gap-4 md:grid-cols-4' },
                                   summaryCard('총 매출', Number(summary.totalSalesAmount).toLocaleString()),
                                   summaryCard('총 광고비', Number(summary.totalAdCost).toLocaleString()),
                                   summaryCard('총 기타비용', Number(summary.totalOtherCost).toLocaleString()),
                               summaryCard('총 원가', Number(summary.totalCostAmount).toLocaleString()),
                                   summaryCard('영업이익', Number(summary.operatingProfit).toLocaleString(), true),
                                   summaryCard('ROAS', summary.roas),
                                   summaryCard('CPA', Number(summary.cpa).toLocaleString()),
                                   summaryCard('입고/출고 수량', `${summary.inboundQuantity} / ${summary.outboundQuantity}`),
                                   summaryCard('발주 요청 건수', summary.orderRequestCount, false, true)
                                 ) : null,
                     summary && summary.byBrand && summary.byBrand.length > 0 ? h('div', { className: 'mt-6' },
                                                                                          h('p', { className: 'text-sm font-black text-slate-900' }, '브랜드별 영업이익'),
                                                                                          h('table', { className: 'mt-2 w-full text-sm' },
                                                                                                      h('thead', null, h('tr', { className: 'text-left text-xs font-bold text-slate-400' },
                                                                                                                                     h('th', { className: 'py-1' }, '브랜드 ID'),
                                                                                                                                     h('th', { className: 'py-1' }, '매출'),
                                                                                                                                     h('th', { className: 'py-1' }, '광고비'),
                                                                                                                                     h('th', { className: 'py-1' }, '기타비용'),
                                                                                                                                         h('th', { className: 'py-1' }, '원가'),
                                                                                                                                     h('th', { className: 'py-1' }, '영업이익')
                                                                                                                                   )),
                                                                                                      h('tbody', null, summary.byBrand.map((row) => h('tr', { key: row.brandId, className: 'border-t border-slate-100' },
                                                                                                                                                                  h('td', { className: 'py-1' }, row.brandId),
                                                                                                                                                                  h('td', { className: 'py-1' }, Number(row.salesAmount).toLocaleString()),
                                                                                                                                                                  h('td', { className: 'py-1' }, Number(row.adCostAmount).toLocaleString()),
                                                                                                                                                                  h('td', { className: 'py-1' }, Number(row.otherCostAmount).toLocaleString()),
                                                                                                                                                          h('td', { className: 'py-1' }, Number(row.costAmount).toLocaleString()),
                                                                                                                                                                  h('td', { className: 'py-1 font-bold' }, Number(row.operatingProfit).toLocaleString())
                                                                                                                                                                )))
                                                                                                    )
                                                                                        ) : null
                   ),
         h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5' },
                 h('div', { className: 'flex flex-wrap gap-2' },
                           TABS.map((tab) => h('button', {
                                       key: tab.id, type: 'button', onClick: () => selectTab(tab.id),
                                       className: `rounded-lg px-4 py-2 text-sm font-black ${activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`
                           }, tab.label))
                         ),
                 excelUploadBox,
                 activeTab === 'sales' ? salesFormEl : null,
                 activeTab === 'ad-costs' ? adCostFormEl : null,
                 activeTab === 'inventory' ? inventoryFormEl : null,
                 activeTab === 'other-costs' ? otherCostFormEl : null,
                 h('div', { className: 'mt-6 overflow-x-auto' },
                                   activeTab === 'sales' ? entryTable(['entryDate', 'channelName', 'productId', 'quantity', 'salesAmount', 'costAmount', 'memo'], salesEntries, (id) => removeEntry('sales', id)) : null,
                           activeTab === 'ad-costs' ? entryTable(['entryDate', 'channelName', 'productId', 'adCostAmount', 'conversions', 'memo'], adCostEntries, (id) => removeEntry('ad-costs', id)) : null,
                           activeTab === 'inventory' ? entryTable(['entryDate', 'entryType', 'productId', 'quantity', 'memo'], inventoryEntries, (id) => removeEntry('inventory', id)) : null,
                           activeTab === 'other-costs' ? entryTable(['entryDate', 'costCategory', 'productId', 'amount', 'memo'], otherCostEntries, (id) => removeEntry('other-costs', id)) : null
                         )
               )
           )
}
