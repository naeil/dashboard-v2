import assert from 'node:assert/strict'
import {
  defaultAsOfDate,
  evaluateProduct,
  matchThreePlItems,
  parseThreePlSheets,
  summarizeItem,
} from './threePlInventory.js'

const days = Array.from({ length: 31 }, (_, index) => `${index + 1}일`)
const blank = (n) => Array.from({ length: n }, () => null)
const sheet = {
  name: '상온',
  rows: [
    [null, '재고표 / 21년도 9월'],
    [null, '2026 .10'],
    [null, '번호', '구분', null, null, null, null, '날           짜'],
    [null, null, null, null, null, null, null, ...days],
    [null, 1, '알싸고추깡', null, null, '전월재고', '입고', null, 100],
    [null, null, null, null, null, null, '출고', 10, 20, 5],
    [null, null, null, null, null, 50, '재고', 40, 120, 115, ...blank(28).map(() => 115)],
    [null, 2, '새우갈릭깡', null, null, '전원재고', '입고'],
    [null, null, null, null, null, null, '출고', 1],
    [null, null, null, null, null, 10, '재고', 9, 9, 8],
  ],
}

const parsed = parseThreePlSheets([sheet, { name: 'Sheet1', rows: [[null, '닭가슴살']] }])
assert.equal(parsed.ym, '2026-10')
assert.deepEqual(parsed.sheets, ['상온'])
assert.deepEqual(parsed.skipped, ['Sheet1'])
assert.equal(parsed.items.length, 2)
assert.equal(parsed.items[0].raw, '알싸고추깡')
assert.equal(parsed.items[0].prev, 50)
assert.equal(parsed.items[0].in[1], 100)
assert.equal(parsed.items[0].out[1], 20)
assert.equal(parsed.items[1].prev, 10)

const first = summarizeItem(parsed.items[0], '2026-10-03')
assert.equal(first.stock, 115)
assert.equal(first.monthIn, 100)
assert.equal(first.monthOut, 35)
assert.deepEqual(first.errors, [])
const second = summarizeItem(parsed.items[1], '2026-10-03')
assert.deepEqual(second.errors, [3]) // 9 - 0 ≠ 8

assert.equal(defaultAsOfDate('2026-10', new Date(2026, 9, 27)), '2026-10-27')
assert.equal(defaultAsOfDate('2026-09', new Date(2026, 9, 27)), '2026-09-30')

const products = [
  { id: 7, product_name: '단백깡 알싸고추깡', sku: 'HF-DANBAEKKANG-SPICY-PEPPER' },
  { id: 9, product_name: '단백깡 알싸고추깡 24봉', sku: 'X' },
]
assert.deepEqual(matchThreePlItems(parsed.items, products), { 알싸고추깡: '7' })
assert.deepEqual(matchThreePlItems(parsed.items, products, { 새우갈릭깡: 9 }), { 알싸고추깡: '7', 새우갈릭깡: '9' })

const settings = { leadDays: 14, bufferDays: 7, targetDays: 30, overDays: 120, nearExpiryDays: 90, staleDays: 3 }
const reorder = evaluateProduct({ production_cost: 100 }, { stock: 100, avgDailyOut: 10 }, '2026-10-27', settings)
assert.equal(reorder.status, 'REORDER')
assert.equal(reorder.suggestedOrder, 410)
assert.equal(reorder.inventoryValue, 10000)

const waste = evaluateProduct({ expiry_date: '2026-11-06' }, { stock: 1000, avgDailyOut: 10 }, '2026-10-27', settings)
assert.equal(waste.expiryDays, 10)
assert.equal(waste.wasteQty, 900)
assert.ok(waste.flags.includes('WASTE_RISK'))

const expired = evaluateProduct({ expiry_date: '2026-02-12' }, { stock: 50, avgDailyOut: 1 }, '2026-10-27', settings)
assert.equal(expired.status, 'EXPIRY_CHECK')

assert.equal(evaluateProduct({ stock_quantity: 5 }, null, '2026-10-27', settings).status, 'NO_3PL')

console.log('threePlInventory tests passed')
