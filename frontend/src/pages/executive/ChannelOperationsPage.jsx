import { useEffect, useMemo, useState } from 'react'
import { getChannelCredentials } from '../../api/executiveApi'
import { EmptyState, PageHeader, Panel } from './ExecutiveComponents'

const fallbackChannels = [
  { channel_id: 'smartstore', category_name: '스마트스토어', account_type: '판매자센터', login_url: 'https://sell.smartstore.naver.com/', memo: '주문, 정산, 상품 노출 점검' },
  { channel_id: 'imweb', category_name: '공식몰', account_type: '아임웹 관리자', login_url: 'https://admin.imweb.me/', memo: '주문, 회원, 쿠폰, 상세페이지 점검' },
  { channel_id: 'coupang', category_name: '쿠팡', account_type: '쿠팡윙', login_url: 'https://wing.coupang.com/', memo: '주문, 배송, 상품 판매 상태 점검' },
  { channel_id: 'esm', category_name: '옥션/G마켓', account_type: 'ESM', login_url: 'https://www.esmplus.com/', memo: '오픈마켓 주문, 클레임, 상품 점검' },
  { channel_id: 'elevenst', category_name: '11번가', account_type: '판매자센터', login_url: 'https://soffice.11st.co.kr/', memo: '주문, 배송, 상품 판매 상태 점검' },
]

function normalizeUrl(value) {
  const text = String(value || '').trim()
  if (!text || text === '-') return ''
  if (/^https?:\/\//i.test(text)) return text
  if (text.includes('.') && !text.includes(' ')) return `https://${text}`
  return ''
}

function channelLabel(row) {
  return [row.category_name || row.channel_name, row.account_type].filter(Boolean).join(' / ') || row.username || '채널'
}

export default function ChannelOperationsPage() {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await getChannelCredentials()
      const credentials = response.data || []
      setRows(credentials.length > 0 ? credentials : fallbackChannels)
    } catch (error) {
      setRows(fallbackChannels)
      setMessage(error?.response?.data?.message || '저장된 채널 계정을 불러오지 못해 기본 채널만 표시합니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.category_name, row.account_type, row.channel_name, row.username, row.login_url, row.memo]
        .some((value) => String(value || '').toLowerCase().includes(needle)),
    )
  }, [query, rows])

  const openLogin = (row) => {
    const url = normalizeUrl(row.login_url)
    if (!url) {
      setMessage('이 채널은 로그인 URL이 등록되어 있지 않습니다. 관리자에게 URL 등록을 요청하세요.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <PageHeader
        title="채널 운영"
        description="온라인 MD가 판매 채널을 빠르게 열고 주문, 정산, 상품 상태를 점검하는 운영 화면입니다."
      />

      {message && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          {message}
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-black text-slate-500">운영 채널</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{rows.length.toLocaleString('ko-KR')}개</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <p className="text-xs font-black text-slate-500">URL 등록</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{rows.filter((row) => normalizeUrl(row.login_url)).length.toLocaleString('ko-KR')}개</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-slate-200 bg-white p-5 text-left hover:bg-slate-50">
          <p className="text-xs font-black text-slate-500">동기화</p>
          <p className="mt-3 text-lg font-black text-slate-950">{loading ? '불러오는 중...' : '채널 목록 새로고침'}</p>
        </button>
      </section>

      <Panel title="판매 채널 바로가기" right={<span className="text-xs font-black text-slate-500">직원 조회용</span>}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="채널명, ID, URL 검색"
          className="mb-5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
        />

        {filtered.length === 0 ? (
          <EmptyState message="검색 결과가 없습니다." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((row, index) => {
              const url = normalizeUrl(row.login_url)
              return (
                <article key={row.id || row.channel_id || `${row.username}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{channelLabel(row)}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">{row.memo || '주문, 정산, 상품 상태를 점검하세요.'}</p>
                      {row.username && <p className="mt-3 truncate text-xs font-black text-sky-600">ID: {row.username}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => openLogin(row)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-black ${url ? 'bg-sky-500 text-white hover:bg-sky-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      이동
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Panel>
    </>
  )
}
