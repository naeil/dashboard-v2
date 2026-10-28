/**
 * 3PL 일일재고표(.xlsx) 파서와 재고 판단 로직.
 * - 외부 라이브러리 없이 브라우저/Node 기본 API(DecompressionStream)로 xlsx를 읽는다.
 * - 시트마다 '입고 / 출고 / 재고' 3줄 블록을 찾아 품목별 1~31일 데이터를 뽑는다.
 */

export const DEFAULT_INVENTORY_SETTINGS = {
  leadDays: 14, // 발주 → 3PL 입고까지 걸리는 일수
  bufferDays: 7, // 안전재고 일수
  targetDays: 30, // 발주 시 확보할 판매일수
  overDays: 120, // 이 이상이면 과다 재고
  nearExpiryDays: 90, // 유통기한 임박 기준
  staleDays: 3, // 기준일이 이보다 오래되면 경고
}

export const SHEET_STORAGE = { 재고표: '냉동', 고기: '육류', 상온: '상온' }

/* 3PL 품목명(공백 제거) → 대시보드 품목 찾기 힌트 */
export const THREE_PL_ALIASES = {
  통살블랙페퍼: { names: ['프리하닭 블랙페퍼'] },
  통살오리지널: { names: ['프리하닭 오리지널'], skus: ['HF-CHICKEN-ORIGINAL'] },
  큐브오리지널: { names: ['프리하닭 큐브'] },
  통살매콤양념: { names: ['프리하닭 매콤양념'] },
  프리당생생효소: { names: ['프리당생생효소', '프리당 생생효소'] },
  야채포테이토깡: { names: ['단백깡 야채포테이토깡'], skus: ['HF-DANBAEKKANG-VEG-POTATO'] },
  알싸고추깡: { names: ['단백깡 알싸고추깡'], skus: ['HF-DANBAEKKANG-SPICY-PEPPER'] },
  새우갈릭깡: { names: ['단백깡 갈릭새우깡'], skus: ['HF-DANBAEKKANG-GARLIC-SHRIMP'] },
}

export const STATUS_META = {
  OUT: { label: '품절', tone: 'rose', rank: 0 },
  EXPIRY_CHECK: { label: '유통기한 확인', tone: 'rose', rank: 1 },
  REORDER: { label: '발주 필요', tone: 'rose', rank: 2 },
  REORDER_SOON: { label: '발주 임박', tone: 'amber', rank: 3 },
  WASTE_RISK: { label: '기한 내 소진 위험', tone: 'amber', rank: 4 },
  OVER: { label: '과다', tone: 'violet', rank: 5 },
  IDLE: { label: '출고 없음', tone: 'slate', rank: 6 },
  NO_3PL: { label: '3PL 미연동', tone: 'slate', rank: 7 },
  NORMAL: { label: '정상', tone: 'emerald', rank: 8 },
}

export const normalizeName = (value) => String(value ?? '').replace(/\s+/g, '').toLowerCase()

/* ───────── xlsx 읽기 ───────── */

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeXml = (text) => String(text)
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, key) => XML_ENTITIES[key])
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))

const attr = (attrs, name) => {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return match ? decodeXml(match[1]) : null
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function openZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error('엑셀(.xlsx) 파일이 아닙니다. 3PL에서 받은 원본 파일을 올려 주세요.')
  const entries = {}
  const total = view.getUint16(end + 10, true)
  let pointer = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  for (let i = 0; i < total; i += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break
    const nameLength = view.getUint16(pointer + 28, true)
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))
    entries[name] = {
      method: view.getUint16(pointer + 10, true),
      size: view.getUint32(pointer + 20, true),
      offset: view.getUint32(pointer + 42, true),
    }
    pointer += 46 + nameLength + view.getUint16(pointer + 30, true) + view.getUint16(pointer + 32, true)
  }
  return async (name) => {
    const entry = entries[name]
    if (!entry) return null
    const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
    const data = bytes.subarray(start, start + entry.size)
    return decoder.decode(entry.method === 0 ? data : await inflateRaw(data))
  }
}

const columnIndex = (ref) => {
  const letters = ref.replace(/\d+/g, '')
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function sheetRows(xml, sharedStrings) {
  const rows = []
  const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  let match
  while ((match = cellPattern.exec(xml))) {
    const ref = attr(match[1], 'r')
    if (!ref) continue
    const type = attr(match[1], 't')
    const body = match[2] || ''
    let value = null
    if (type === 'inlineStr') {
      value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
    } else {
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)
      if (raw) {
        if (type === 's') value = sharedStrings[Number(raw[1])] ?? ''
        else if (type === 'str' || type === 'e') value = decodeXml(raw[1])
        else if (type === 'b') value = raw[1] === '1'
        else value = Number(raw[1])
      }
    }
    if (value === null || value === '') continue
    const rowIndex = Number(ref.replace(/\D+/g, '')) - 1
    if (!rows[rowIndex]) rows[rowIndex] = []
    rows[rowIndex][columnIndex(ref)] = value
  }
  return rows
}

/** xlsx 바이트 → [{ name, rows: 2차원 배열(A1 기준) }] */
export async function readXlsxSheets(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const read = openZip(bytes)
  const workbook = await read('xl/workbook.xml')
  if (!workbook) throw new Error('엑셀 시트 정보를 찾지 못했습니다.')
  const rels = (await read('xl/_rels/workbook.xml.rels')) || ''
  const targets = {}
  for (const rel of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    targets[attr(rel[1], 'Id')] = attr(rel[1], 'Target')
  }
  const sharedXml = (await read('xl/sharedStrings.xml')) || ''
  const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) => (
    [...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
  ))
  const sheets = []
  for (const sheet of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = attr(sheet[1], 'name')
    const target = targets[attr(sheet[1], 'r:id')]
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = await read(path)
    if (xml) sheets.push({ name, rows: sheetRows(xml, sharedStrings) })
  }
  return sheets
}

/* ───────── 3PL 재고표 해석 ───────── */

const clean = (value) => String(value ?? '').replace(/\s+/g, '')
const toNumber = (value) => {
  if (typeof value === 'number') return value
  if (value == null || value === '') return 0
  return Number(String(value).replace(/,/g, '')) || 0
}

/** 시트 목록 → { ym: 'YYYY-MM', items: [{ sheet, raw, prev, in[31], out[31], stock[31] }], sheets, skipped } */
export function parseThreePlSheets(sheets) {
  const result = { ym: null, items: [], sheets: [], skipped: [] }
  for (const { name: sheetName, rows } of sheets) {
    if (!result.ym) {
      for (const row of rows.slice(0, 8)) {
        for (const value of row || []) {
          const match = typeof value === 'string' && !/\d{2}년도/.test(value) && value.match(/(20\d\d)\s*[.\-/년]\s*(\d{1,2})/)
          if (match) { result.ym = `${match[1]}-${match[2].padStart(2, '0')}`; break }
        }
        if (result.ym) break
      }
    }
    let dayColumns = null
    for (const row of rows) {
      if (!row) continue
      const first = row.findIndex((value) => clean(value) === '1일')
      if (first >= 0 && clean(row[first + 1]) === '2일') {
        dayColumns = {}
        row.forEach((value, column) => {
          const match = clean(value).match(/^(\d{1,2})일$/)
          if (match) dayColumns[Number(match[1])] = column
        })
        break
      }
    }
    const found = []
    if (dayColumns) {
      for (let i = 0; i < rows.length - 2; i += 1) {
        const row = rows[i] || []
        const labelColumn = row.findIndex((value) => clean(value) === '입고')
        if (labelColumn < 0) continue
        if (clean((rows[i + 1] || [])[labelColumn]) !== '출고' || clean((rows[i + 2] || [])[labelColumn]) !== '재고') continue
        let raw = null
        for (let column = 0; column < labelColumn; column += 1) {
          const value = row[column]
          if (typeof value === 'string' && clean(value) && !/^(전월|전원)재고$/.test(clean(value))) { raw = value.trim(); break }
        }
        if (!raw) continue
        const stockRow = rows[i + 2] || []
        const pick = (source) => Array.from({ length: 31 }, (_, day) => toNumber((source || [])[dayColumns[day + 1]]))
        found.push({
          sheet: sheetName,
          raw,
          prev: toNumber(stockRow[labelColumn - 1]),
          in: pick(rows[i]),
          out: pick(rows[i + 1]),
          stock: Array.from({ length: 31 }, (_, day) => {
            const value = stockRow[dayColumns[day + 1]]
            return value == null || value === '' ? null : toNumber(value)
          }),
        })
        i += 2
      }
    }
    if (found.length) { result.sheets.push(sheetName); result.items.push(...found) } else result.skipped.push(sheetName)
  }
  return result
}

export async function parseThreePlFile(arrayBuffer) {
  const parsed = parseThreePlSheets(await readXlsxSheets(arrayBuffer))
  if (!parsed.items.length) throw new Error("'입고 / 출고 / 재고' 줄을 찾지 못했습니다. 3PL 일일재고표 원본인지 확인해 주세요.")
  return parsed
}

/* ───────── 날짜 유틸 ───────── */

export const daysInMonth = (ym) => {
  const [year, month] = ym.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}
export const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseDateKey = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}
export const diffDays = (from, to) => Math.round((parseDateKey(to) - parseDateKey(from)) / 86400000)

/** 업로드 기준일 기본값: 같은 달이면 오늘, 지난 달이면 말일 */
export function defaultAsOfDate(ym, today = new Date()) {
  const todayKey = toDateKey(today)
  if (todayKey.slice(0, 7) === ym) return todayKey
  if (todayKey.slice(0, 7) > ym) return `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`
  return `${ym}-01`
}

/** 마지막으로 입고나 출고가 기록된 날 */
export const lastActivityDay = (items) => items.reduce((last, item) => {
  item.out.forEach((value, index) => { if (value || item.in[index]) last = Math.max(last, index + 1) })
  return last
}, 0)

/* ───────── 매칭 ───────── */

/** 3PL 품목 → 대시보드 품목 id. savedMapping(이전 업로드에서 확정한 값)이 우선 */
export function matchThreePlItems(items, products, savedMapping = {}) {
  const byId = new Map(products.map((product) => [String(product.id), product]))
  const mapping = {}
  for (const item of items) {
    const key = normalizeName(item.raw)
    if (savedMapping[key] && byId.has(String(savedMapping[key]))) { mapping[key] = String(savedMapping[key]); continue }
    const alias = THREE_PL_ALIASES[key] || {}
    const found = products.find((product) => (alias.skus || []).includes(product.sku))
      || products.find((product) => (alias.names || []).some((name) => normalizeName(name) === normalizeName(product.product_name)))
      || products.find((product) => normalizeName(product.product_name) === key)
      || products.find((product) => normalizeName(product.product_name).endsWith(key))
    if (found) mapping[key] = String(found.id)
  }
  return mapping
}

/* ───────── 소비자가 ───────── */

/* 3PL 연동 제품명(공백 제거) → 소비자가가 등록된 1개짜리 판매 상품명 */
export const CONSUMER_PRICE_ALIASES = {
  프리당생생효소: ['당근효소 1박스'],
}

const unitConsumerPrice = (product) => {
  const price = Number(product?.consumer_price || 0)
  const bundle = Math.max(1, Number(product?.bundle_quantity || 1))
  return price > 0 ? price / bundle : 0
}

/**
 * 재고 1개당 소비자가.
 * 1) 제품 자체에 소비자가가 있으면 그 값(묶음이면 낱개로 환산)
 * 2) 없으면 같은 이름의 1개짜리 판매 상품(예: NAVER-…-1)의 소비자가
 */
export function resolveConsumerPrice(product, products) {
  const own = unitConsumerPrice(product)
  if (own > 0) return { price: own, source: product }
  const key = normalizeName(product.product_name)
  const names = new Set([key, ...(CONSUMER_PRICE_ALIASES[key] || []).map(normalizeName)])
  const single = products.find((candidate) => (
    candidate.id !== product.id
    && Number(candidate.bundle_quantity || 1) === 1
    && Number(candidate.consumer_price || 0) > 0
    && names.has(normalizeName(candidate.product_name))
  ))
  return single ? { price: Number(single.consumer_price), source: single } : { price: 0, source: null }
}

/* ───────── 분석 ───────── */

/** 3PL 품목 하나를 기준일까지 잘라 계산 */
export function summarizeItem(item, asOfDate) {
  const day = Math.max(1, Math.min(Number(asOfDate.slice(8, 10)), item.stock.length))
  const series = []
  let carry = item.prev
  for (let i = 0; i < day; i += 1) {
    if (item.stock[i] != null) carry = item.stock[i]
    series.push(carry)
  }
  const window = Math.min(day, 28)
  const recentOut = item.out.slice(day - window, day).reduce((sum, value) => sum + value, 0)
  const errors = []
  let previous = item.prev
  for (let i = 0; i < day; i += 1) {
    const value = item.stock[i]
    if (value == null) continue
    if (value !== previous + item.in[i] - item.out[i]) errors.push(i + 1)
    previous = value
  }
  return {
    day,
    stock: series[day - 1] ?? item.prev,
    avgDailyOut: recentOut / window,
    monthIn: item.in.slice(0, day).reduce((sum, value) => sum + value, 0),
    monthOut: item.out.slice(0, day).reduce((sum, value) => sum + value, 0),
    series,
    dailyIn: item.in.slice(0, day),
    dailyOut: item.out.slice(0, day),
    errors,
  }
}

/** 대시보드 품목 + (있으면) 3PL 요약 → 판단 결과 */
export function evaluateProduct(product, summary, asOfDate, settings = DEFAULT_INVENTORY_SETTINGS, consumerPrice = 0) {
  const stock = summary ? summary.stock : Number(product.stock_quantity || 0)
  const avg = summary ? summary.avgDailyOut : null
  const cover = avg > 0 ? stock / avg : (summary ? Infinity : null)
  const reorderPoint = avg > 0 ? avg * (settings.leadDays + settings.bufferDays) : null
  const expiry = product.expiry_date ? String(product.expiry_date).slice(0, 10) : null
  const expiryDays = expiry && asOfDate ? diffDays(asOfDate, expiry) : null
  const sellableBeforeExpiry = expiryDays != null && avg != null ? Math.max(0, avg * Math.max(expiryDays, 0)) : null
  const wasteQty = expiryDays != null && expiryDays > 0 && sellableBeforeExpiry != null ? Math.max(0, Math.round(stock - sellableBeforeExpiry)) : 0
  const suggestedOrder = avg > 0 ? Math.max(0, Math.ceil(avg * (settings.leadDays + settings.bufferDays + settings.targetDays) - stock)) : 0
  const unitCost = Number(product.production_cost || 0)
  const unitPrice = Number(consumerPrice || 0)

  const flags = []
  if (!summary) {
    flags.push('NO_3PL')
  } else {
    if (stock <= 0) flags.push('OUT')
    if (expiryDays != null && expiryDays <= 0 && stock > 0) flags.push('EXPIRY_CHECK')
    if (stock > 0 && avg > 0 && cover < settings.leadDays + settings.bufferDays) flags.push('REORDER')
    else if (stock > 0 && avg > 0 && cover < settings.leadDays + settings.bufferDays + 14) flags.push('REORDER_SOON')
    if (wasteQty > 0) flags.push('WASTE_RISK')
    if (avg > 0 && cover > settings.overDays) flags.push('OVER')
    if (avg === 0 && stock > 0) flags.push('IDLE')
    if (!flags.length) flags.push('NORMAL')
  }
  flags.sort((a, b) => STATUS_META[a].rank - STATUS_META[b].rank)

  return {
    stock,
    avgDailyOut: avg,
    coverDays: cover,
    reorderPoint,
    safetyStock: avg > 0 ? avg * settings.bufferDays : null,
    expiry,
    expiryDays,
    sellableBeforeExpiry,
    wasteQty,
    wasteValue: wasteQty * unitCost, // 손실은 원가 기준
    wasteSalesValue: wasteQty * unitPrice,
    suggestedOrder,
    unitCost,
    unitPrice,
    inventoryValue: unitCost > 0 ? unitCost * stock : null, // 재고 평가액: 원가 기준(장부)
    salesValue: unitPrice > 0 ? unitPrice * stock : null, // 판매가치: 소비자가 기준(참고)
    flags,
    status: flags[0],
  }
}
