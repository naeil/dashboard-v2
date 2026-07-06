import { useEffect, useState, createElement as h } from 'react'
import {
  getSalesEntries, createSalesEntry, deleteSalesEntry,
  getAdCostEntries, createAdCostEntry, deleteAdCostEntry,
  getInventoryEntries, createInventoryEntry, deleteInventoryEntry,
  getOtherCostEntries, createOtherCostEntry, deleteOtherCostEntry,
  getFieldDataSummary,
} from '../../api/fieldDataInputApi'

const TABS = [
  { id: 'sales', label: 'Sales upload' },
  { id: 'ad-costs', label: 'Ad cost upload' },
  { id: 'inventory', label: 'Inventory / order sheet' },
  { id: 'other-costs', label: 'Other costs' },
  ]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const emptySalesForm = { brandId: '', productId: '', channelName: '', entryDate: todayIso(), quantity: '', salesAmount: '', memo: '' }
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
    setError('Failed to load field-input entries. The backend endpoints may not be deployed yet.')
  }
}

async function loadSummary() {
  setLoading(true)
  setError('')
  try {
    const res = await getFieldDataSummary(summaryStart, summaryEnd)
    setSummary(res.data)
  } catch (err) {
    setError('Failed to load the L1/L2 summary. The backend endpoints may not be deployed yet.')
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadAll()
  loadSummary()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

async function submitSales(event) {
  event.preventDefault()
  const payload = {
    brandId: toNumberOrNull(salesForm.brandId),
    productId: toNumberOrNull(salesForm.productId),
    channelName: salesForm.channelName || null,
    entryDate: salesForm.entryDate,
    quantity: toNumberOrNull(salesForm.quantity) || 0,
    salesAmount: toNumberOrNull(salesForm.salesAmount) || 0,
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

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const labelClass = 'text-xs font-bold text-slate-500'

function field(value, onChange, placeholder, type) {
  return h('input', { className: inputClass, placeholder: placeholder, type: type || 'text', value: value, onChange: (e) => onChange(e.target.value) })
}

const salesFormEl = h('form', { onSubmit: submitSales, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                      field(salesForm.brandId, (v) => setSalesForm({ ...salesForm, brandId: v }), 'Brand ID'),
                      field(salesForm.productId, (v) => setSalesForm({ ...salesForm, productId: v }), 'Product ID'),
                      field(salesForm.channelName, (v) => setSalesForm({ ...salesForm, channelName: v }), 'Channel name'),
                      field(salesForm.entryDate, (v) => setSalesForm({ ...salesForm, entryDate: v }), 'Entry date', 'date'),
                      field(salesForm.quantity, (v) => setSalesForm({ ...salesForm, quantity: v }), 'Quantity'),
                      field(salesForm.salesAmount, (v) => setSalesForm({ ...salesForm, salesAmount: v }), 'Sales amount'),
                      field(salesForm.memo, (v) => setSalesForm({ ...salesForm, memo: v }), 'Memo'),
                      h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, 'Save')
                      )

const adCostFormEl = h('form', { onSubmit: submitAdCost, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                       field(adCostForm.brandId, (v) => setAdCostForm({ ...adCostForm, brandId: v }), 'Brand ID'),
                       field(adCostForm.productId, (v) => setAdCostForm({ ...adCostForm, productId: v }), 'Product ID'),
                       field(adCostForm.channelName, (v) => setAdCostForm({ ...adCostForm, channelName: v }), 'Channel name'),
                       field(adCostForm.entryDate, (v) => setAdCostForm({ ...adCostForm, entryDate: v }), 'Entry date', 'date'),
                       field(adCostForm.adCostAmount, (v) => setAdCostForm({ ...adCostForm, adCostAmount: v }), 'Ad cost amount'),
                       field(adCostForm.impressions, (v) => setAdCostForm({ ...adCostForm, impressions: v }), 'Impressions'),
                       field(adCostForm.clicks, (v) => setAdCostForm({ ...adCostForm, clicks: v }), 'Clicks'),
                       field(adCostForm.conversions, (v) => setAdCostForm({ ...adCostForm, conversions: v }), 'Conversions'),
                       field(adCostForm.memo, (v) => setAdCostForm({ ...adCostForm, memo: v }), 'Memo'),
                       h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, 'Save')
                       )

const inventoryTypeSelect = h('select', {
  className: inputClass,
  value: inventoryForm.entryType,
  onChange: (e) => setInventoryForm({ ...inventoryForm, entryType: e.target.value }),
},
                              h('option', { value: 'INBOUND' }, 'Inbound'),
                              h('option', { value: 'OUTBOUND' }, 'Outbound'),
                              h('option', { value: 'ORDER_REQUEST' }, 'Order request')
                              )

const inventoryFormEl = h('form', { onSubmit: submitInventory, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                          field(inventoryForm.brandId, (v) => setInventoryForm({ ...inventoryForm, brandId: v }), 'Brand ID'),
                          field(inventoryForm.productId, (v) => setInventoryForm({ ...inventoryForm, productId: v }), 'Product ID'),
                          inventoryTypeSelect,
                          field(inventoryForm.entryDate, (v) => setInventoryForm({ ...inventoryForm, entryDate: v }), 'Entry date', 'date'),
                          field(inventoryForm.quantity, (v) => setInventoryForm({ ...inventoryForm, quantity: v }), 'Quantity'),
                          field(inventoryForm.memo, (v) => setInventoryForm({ ...inventoryForm, memo: v }), 'Memo'),
                          h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, 'Save')
                          )

const otherCostFormEl = h('form', { onSubmit: submitOtherCost, className: 'mt-5 grid grid-cols-2 gap-3 md:grid-cols-4' },
                          field(otherCostForm.brandId, (v) => setOtherCostForm({ ...otherCostForm, brandId: v }), 'Brand ID'),
                          field(otherCostForm.productId, (v) => setOtherCostForm({ ...otherCostForm, productId: v }), 'Product ID'),
                          field(otherCostForm.costCategory, (v) => setOtherCostForm({ ...otherCostForm, costCategory: v }), 'Cost category (e.g. logistics, SG and A, viral)'),
                          field(otherCostForm.entryDate, (v) => setOtherCostForm({ ...otherCostForm, entryDate: v }), 'Entry date', 'date'),
                          field(otherCostForm.amount, (v) => setOtherCostForm({ ...otherCostForm, amount: v }), 'Amount'),
                          field(otherCostForm.memo, (v) => setOtherCostForm({ ...otherCostForm, memo: v }), 'Memo'),
                          h('button', { type: 'submit', className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, 'Save')
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
    return h('p', { className: 'text-sm text-slate-400' }, 'No entries yet.')
  }
  return h('table', { className: 'w-full text-sm' },
           h('thead', null, h('tr', { className: 'text-left text-xs font-bold text-slate-400' },
                              columns.map((col) => h('th', { key: col, className: 'py-1 pr-3' }, col)),
                              h('th', { key: '_actions', className: 'py-1' })
                              )),
           h('tbody', null, rows.map((row) => h('tr', { key: row.id, className: 'border-t border-slate-100' },
                                                columns.map((col) => h('td', { key: col, className: 'py-1 pr-3' }, String(row[col]))),
                                                h('td', { key: '_actions', className: 'py-1' },
                                                  h('button', { type: 'button', onClick: () => onDelete(row.id), className: 'text-xs font-bold text-rose-500' }, 'Delete')
                                                  )
                                                )))
           )
}

return h('div', { className: 'space-y-6' },
         h('div', null,
           h('p', { className: 'text-xs font-black uppercase tracking-[0.2em] text-sky-600' }, 'L0 field input layer'),
           h('h1', { className: 'mt-1 text-2xl font-black text-slate-950' }, 'Field data input (sales / ad cost / inventory / other costs)'),
           h('p', { className: 'mt-2 text-sm text-slate-500' }, 'Operations staff enter raw numbers here. The system automatically rolls them up into product-level and brand-level totals shown in the summary panel below.')
           ),
         error ? h('div', { className: 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600' }, error) : null,
         h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5' },
           h('div', { className: 'flex flex-wrap items-end gap-3' },
             h('div', null, h('p', { className: labelClass }, 'Start date'), h('input', { type: 'date', className: inputClass, value: summaryStart, onChange: (e) => setSummaryStart(e.target.value) })),
             h('div', null, h('p', { className: labelClass }, 'End date'), h('input', { type: 'date', className: inputClass, value: summaryEnd, onChange: (e) => setSummaryEnd(e.target.value) })),
             h('button', { type: 'button', onClick: loadSummary, className: 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white' }, loading ? 'Loading...' : 'Refresh summary')
             ),
           summary ? h('div', { className: 'mt-5 grid grid-cols-2 gap-4 md:grid-cols-4' },
                       summaryCard('Total sales', Number(summary.totalSalesAmount).toLocaleString()),
                       summaryCard('Total ad cost', Number(summary.totalAdCost).toLocaleString()),
                       summaryCard('Total other cost', Number(summary.totalOtherCost).toLocaleString()),
                       summaryCard('Operating profit', Number(summary.operatingProfit).toLocaleString(), true),
                       summaryCard('ROAS', summary.roas),
                       summaryCard('CPA', Number(summary.cpa).toLocaleString()),
                       summaryCard('Inbound / outbound qty', `${summary.inboundQuantity} / ${summary.outboundQuantity}`),
                       summaryCard('Order requests', summary.orderRequestCount, false, true)
                       ) : null,
           summary && summary.byBrand && summary.byBrand.length > 0 ? h('div', { className: 'mt-6' },
                                                                        h('p', { className: 'text-sm font-black text-slate-900' }, 'Operating profit by brand'),
                                                                        h('table', { className: 'mt-2 w-full text-sm' },
                                                                          h('thead', null, h('tr', { className: 'text-left text-xs font-bold text-slate-400' },
                                                                                             h('th', { className: 'py-1' }, 'Brand ID'),
                                                                                             h('th', { className: 'py-1' }, 'Sales'),
                                                                                             h('th', { className: 'py-1' }, 'Ad cost'),
                                                                                             h('th', { className: 'py-1' }, 'Other cost'),
                                                                                             h('th', { className: 'py-1' }, 'Operating profit')
                                                                                             )),
                                                                          h('tbody', null, summary.byBrand.map((row) => h('tr', { key: row.brandId, className: 'border-t border-slate-100' },
                                                                                                                          h('td', { className: 'py-1' }, row.brandId),
                                                                                                                          h('td', { className: 'py-1' }, Number(row.salesAmount).toLocaleString()),
                                                                                                                          h('td', { className: 'py-1' }, Number(row.adCostAmount).toLocaleString()),
                                                                                                                          h('td', { className: 'py-1' }, Number(row.otherCostAmount).toLocaleString()),
                                                                                                                          h('td', { className: 'py-1 font-bold' }, Number(row.operatingProfit).toLocaleString())
                                                                                                                          )))
                                                                          )
                                                                        ) : null
),
         h('div', { className: 'rounded-xl border border-slate-200 bg-white p-5' },
    h('div', { className: 'flex flex-wrap gap-2' },
      TABS.map((tab) => h('button', {
        key: tab.id, type: 'button', onClick: () => setActiveTab(tab.id),
        className: `rounded-lg px-4 py-2 text-sm font-black ${activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`
      }, tab.label))
      ),
    activeTab === 'sales' ? salesFormEl : null,
    activeTab === 'ad-costs' ? adCostFormEl : null,
    activeTab === 'inventory' ? inventoryFormEl : null,
    activeTab === 'other-costs' ? otherCostFormEl : null,
    h('div', { className: 'mt-6 overflow-x-auto' },
      activeTab === 'sales' ? entryTable(['entryDate', 'channelName', 'productId', 'quantity', 'salesAmount', 'memo'], salesEntries, (id) => removeEntry('sales', id)) : null,
      activeTab === 'ad-costs' ? entryTable(['entryDate', 'channelName', 'productId', 'adCostAmount', 'conversions', 'memo'], adCostEntries, (id) => removeEntry('ad-costs', id)) : null,
      activeTab === 'inventory' ? entryTable(['entryDate', 'entryType', 'productId', 'quantity', 'memo'], inventoryEntries, (id) => removeEntry('inventory', id)) : null,
      activeTab === 'other-costs' ? entryTable(['entryDate', 'costCategory', 'productId', 'amount', 'memo'], otherCostEntries, (id) => removeEntry('other-costs', id)) : null
      )
    )
  )
}
}
