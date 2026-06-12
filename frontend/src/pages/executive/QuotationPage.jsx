import { useState, useRef } from 'react'

const LOGO_SRC = '/naeil-logo.png'

export default function QuotationPage() {
  const [rows, setRows] = useState([
    { id: 1, name: '', spec: '', qty: 1, price: 0 },
    { id: 2, name: '', spec: '', qty: 1, price: 0 },
    { id: 3, name: '', spec: '', qty: 1, price: 0 },
  ])
  const [form, setForm] = useState({
    clientName: '', clientContact: '', clientPhone: '', clientEmail: '',
    qNumber: '', qDate: new Date().toISOString().slice(0, 10),
    qValid: '', qDelivery: '',
    issuerName: '주식회사 내일그룹', issuerContact: '', issuerPhone: '',
    notes: '',
  })
  const nextId = useRef(4)
  const printRef = useRef(null)

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const addRow = () => setRows((prev) => [...prev, { id: nextId.current++, name: '', spec: '', qty: 1, price: 0 }])
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id))
  const updateRow = (id, field, value) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: field === 'qty' || field === 'price' ? Number(value) : value } : r)))

  const subtotal = rows.reduce((sum, r) => sum + r.qty * r.price, 0)
  const vatTotal = Math.round(subtotal * 0.1)
  const grandTotal = subtotal + vatTotal
  const fmt = (n) => n.toLocaleString('ko-KR') + '원'

  const loadLibs = () => {
    const libs = [
      { id: 'html2canvas-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' },
      { id: 'jspdf-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' },
      { id: 'xlsx-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
    ]
    return Promise.all(libs.map((lib) => new Promise((res) => {
      if (document.getElementById(lib.id)) return res()
      const s = document.createElement('script')
      s.id = lib.id; s.src = lib.src; s.onload = res; s.onerror = res
      document.head.appendChild(s)
    })))
  }

  const handleSavePDF = async () => {
    await loadLibs()
    if (!window.html2canvas || !window.jspdf) {
      alert('PDF 라이브러리 로딩 실패. 잠시 후 다시 시도해주세요.')
      return
    }
    const el = printRef.current
    if (!el) return
    try {
      const canvas = await window.html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const { jsPDF } = window.jspdf
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const ratio = canvas.width / canvas.height
      let imgW = pdfW - 20
      let imgH = imgW / ratio
      if (imgH > pdfH - 20) {
        imgH = pdfH - 20
        imgW = imgH * ratio
      }
      const x = (pdfW - imgW) / 2
      const y = 10
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH)
      if (imgH > pdfH - 20) {
        let remainH = canvas.height - ((pdfH - 20) / imgH) * canvas.height
        let page = 1
        while (remainH > 0) {
          pdf.addPage()
          const srcY = page * ((pdfH - 20) / imgH) * canvas.height
          pdf.addImage(imgData, 'PNG', x, 10, imgW, imgH, undefined, 'FAST', 0)
          page++
          remainH -= (pdfH - 20) / imgH * canvas.height
        }
      }
      pdf.save('견적서_' + (form.qNumber || 'Q') + '_' + form.qDate + '.pdf')
    } catch (e) {
      alert('PDF 저장 중 오류가 발생했습니다: ' + e.message)
    }
  }

  const handleSaveExcel = async () => {
    await loadLibs()
    if (!window.XLSX) { alert('엑셀 라이브러리 로딩 실패. 잠시 후 다시 시도해주세요.'); return }
    const XLSX = window.XLSX
    const wb = XLSX.utils.book_new()

    const dataRows = [
      ['견 적 서', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['[수신]', '', '', '', '[견적 정보]', '', '', ''],
      ['거래처명', form.clientName, '', '', '견적번호', form.qNumber, '', ''],
      ['담당자', form.clientContact, '', '', '견적일자', form.qDate, '', ''],
      ['연락처', form.clientPhone, '', '', '유효기간', form.qValid, '', ''],
      ['이메일', form.clientEmail, '', '', '납기', form.qDelivery, '', ''],
      ['[공급자]', '', '', '', '', '', '', ''],
      ['상호', form.issuerName, '', '', '담당자', form.issuerContact, '연락처', form.issuerPhone],
      ['', '', '', '', '', '', '', ''],
      ['No', '품목명', '규격/단위', '수량', '단가(원)', '공급가액', '부가세(10%)', '합계'],
      ...rows.map((r, i) => {
        const s = r.qty * r.price
        const v = Math.round(s * 0.1)
        return [i + 1, r.name, r.spec, r.qty, r.price, s, v, s + v]
      }),
      ['', '', '', '', '공급가액 합계', fmt(subtotal), '', ''],
      ['', '', '', '', '부가세 합계', fmt(vatTotal), '', ''],
      ['', '', '', '', '합계 금액', fmt(grandTotal), '', ''],
      ['비고', form.notes, '', '', '', '', '', ''],
    ]

    const ws = XLSX.utils.aoa_to_sheet(dataRows)

    const titleRowIdx = 0
    const notesRowIdx = dataRows.length - 1
    const summaryStart = dataRows.length - 4

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
      { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } },
      { s: { r: 5, c: 1 }, e: { r: 5, c: 3 } },
      { s: { r: 6, c: 1 }, e: { r: 6, c: 3 } },
      { s: { r: 3, c: 5 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 5 }, e: { r: 4, c: 7 } },
      { s: { r: 5, c: 5 }, e: { r: 5, c: 7 } },
      { s: { r: 6, c: 5 }, e: { r: 6, c: 7 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } },
      { s: { r: 8, c: 1 }, e: { r: 8, c: 3 } },
      { s: { r: summaryStart, c: 0 }, e: { r: summaryStart, c: 3 } },
      { s: { r: summaryStart, c: 5 }, e: { r: summaryStart, c: 7 } },
      { s: { r: summaryStart + 1, c: 0 }, e: { r: summaryStart + 1, c: 3 } },
      { s: { r: summaryStart + 1, c: 5 }, e: { r: summaryStart + 1, c: 7 } },
      { s: { r: summaryStart + 2, c: 0 }, e: { r: summaryStart + 2, c: 3 } },
      { s: { r: summaryStart + 2, c: 5 }, e: { r: summaryStart + 2, c: 7 } },
      { s: { r: notesRowIdx, c: 1 }, e: { r: notesRowIdx, c: 7 } },
    ]

    ws['!cols'] = [
      { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 8 },
      { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    ]

    ws['!rows'] = [{ hpt: 28 }]

    XLSX.utils.book_append_sheet(wb, ws, '견적서')
    XLSX.writeFile(wb, '견적서_' + (form.qNumber || 'Q') + '_' + form.qDate + '.xlsx')
  }

  const inputCls = 'w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400'
  const labelCls = 'text-xs text-slate-500 whitespace-nowrap'

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div ref={printRef} className="bg-white p-6 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <img src={LOGO_SRC} alt="Naeil 로고" className="mx-auto mb-2 h-14 w-auto object-contain" />
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600 mb-1">NAEIL GROUP</p>
          <h1 className="text-3xl font-black tracking-[0.3em] text-slate-900">견 &nbsp; 적 &nbsp; 서</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">▍수 신</h2>
            <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 items-center">
              <label className={labelCls}>거래처명</label>
              <input className={inputCls} placeholder="예) 주식회사 홍길동" value={form.clientName} onChange={(e) => updateForm('clientName', e.target.value)} />
              <label className={labelCls}>담당자</label>
              <input className={inputCls} placeholder="예) 김담당 부장" value={form.clientContact} onChange={(e) => updateForm('clientContact', e.target.value)} />
              <label className={labelCls}>연락처</label>
              <input className={inputCls} placeholder="010-0000-0000" value={form.clientPhone} onChange={(e) => updateForm('clientPhone', e.target.value)} />
              <label className={labelCls}>이메일</label>
              <input className={inputCls} placeholder="example@company.com" value={form.clientEmail} onChange={(e) => updateForm('clientEmail', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">▍견적 정보</h2>
              <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 items-center">
                <label className={labelCls}>견적번호</label>
                <input className={inputCls} placeholder="예) Q-2026-001" value={form.qNumber} onChange={(e) => updateForm('qNumber', e.target.value)} />
                <label className={labelCls}>견적일자</label>
                <input className={inputCls} type="date" value={form.qDate} onChange={(e) => updateForm('qDate', e.target.value)} />
                <label className={labelCls}>유효기간</label>
                <input className={inputCls} placeholder="예) 견적일로부터 30일" value={form.qValid} onChange={(e) => updateForm('qValid', e.target.value)} />
                <label className={labelCls}>납기</label>
                <input className={inputCls} placeholder="예) 계약 후 7일" value={form.qDelivery} onChange={(e) => updateForm('qDelivery', e.target.value)} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">▍공급자</h2>
              <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 items-center">
                <label className={labelCls}>상호</label>
                <input className={inputCls} value={form.issuerName} onChange={(e) => updateForm('issuerName', e.target.value)} />
                <label className={labelCls}>담당자</label>
                <input className={inputCls} placeholder="담당자명" value={form.issuerContact} onChange={(e) => updateForm('issuerContact', e.target.value)} />
                <label className={labelCls}>연락처</label>
                <input className={inputCls} placeholder="02-0000-0000" value={form.issuerPhone} onChange={(e) => updateForm('issuerPhone', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">▍견적 품목</h2>
            <button type="button" onClick={addRow} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white hover:bg-sky-600 transition-colors">+ 행 추가</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-center w-8">#</th>
                  <th className="px-3 py-2.5 text-left min-w-[160px]">품목명</th>
                  <th className="px-3 py-2.5 text-left min-w-[90px]">규격/단위</th>
                  <th className="px-3 py-2.5 text-center w-16">수량</th>
                  <th className="px-3 py-2.5 text-right min-w-[100px]">단가(원)</th>
                  <th className="px-3 py-2.5 text-right min-w-[100px]">공급가액</th>
                  <th className="px-3 py-2.5 text-right w-20">부가세</th>
                  <th className="px-3 py-2.5 text-right min-w-[100px]">합계</th>
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const supply = row.qty * row.price
                  const vat = Math.round(supply * 0.1)
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-center text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-2 py-1.5"><input className={inputCls} placeholder="품목명" value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className={inputCls} placeholder="EA / 개" value={row.spec} onChange={(e) => updateRow(row.id, 'spec', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className="w-16 rounded border border-slate-200 px-2 py-1.5 text-sm text-center focus:border-sky-400 focus:outline-none" type="number" min="0" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-right focus:border-sky-400 focus:outline-none" type="number" min="0" value={row.price} onChange={(e) => updateRow(row.id, 'price', e.target.value)} /></td>
                      <td className="px-3 py-2 text-right text-sm">{supply.toLocaleString('ko-KR')}원</td>
                      <td className="px-3 py-2 text-right text-sm">{vat.toLocaleString('ko-KR')}원</td>
                      <td className="px-3 py-2 text-right text-sm font-bold">{(supply + vat).toLocaleString('ko-KR')}원</td>
                      <td className="px-2 py-1.5 text-center"><button type="button" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 text-base leading-none">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm min-w-[280px]">
            <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <span className="text-slate-500">공급가액 합계</span><span className="text-right font-bold">{fmt(subtotal)}</span>
              <span className="text-slate-500">부가세 합계 (10%)</span><span className="text-right font-bold">{fmt(vatTotal)}</span>
              <div className="col-span-2 border-t-2 border-slate-900 my-1" />
              <span className="font-black text-base">합계 금액</span><span className="text-right font-black text-base text-sky-600">{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">▍비고 / 특이사항</h2>
          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-y" rows={3} placeholder="결제 조건, 납품 조건, 기타 특이사항 등을 입력하세요." value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={handleSavePDF} className="flex items-center gap-2 rounded-xl bg-red-500 px-8 py-3.5 text-sm font-black text-white hover:bg-red-600 transition-colors shadow-sm">📄 PDF로 저장</button>
        <button type="button" onClick={handleSaveExcel} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors shadow-sm">📊 엑셀로 저장</button>
      </div>
    </div>
  )
               }
