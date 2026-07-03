비밀번호가틀렸습니다번호전화번호포인트쿠폰코드마케팅동의참여일시관리자로그인비밀번호입력로그인📊하이프리이벤트관리자마지막업데이트로딩중새로고침다운로드스캔이벤트참여총포인트지급참여고객수전환율참여자목록명전화번호포인트쿠폰코드마케팅동의참여일시참여자가없습니다동의미동의'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [daily, setDaily] = useState<any[]>([])
  const [breakdown, setBreakdown] = useState<any[]>([])
  const [qrPerf, setQrPerf] = useState<any[]>([])
  const [suspicious, setSuspicious] = useState<any[]>([])
  const [tab, setTab] = useState<'summary'|'daily'|'breakdown'|'qr'|'suspicious'>('summary')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchAll = async (adminKey: string) => {
    setLoading(true)
    setError('')
    try {
      const headers = { 'X-Admin-Key': adminKey }
      const [s, d, b, q, su] = await Promise.all([
        fetch(`${API}/api/admin/summary`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/daily?days=30`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/breakdown`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/qr-performance`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/suspicious`, { headers }).then(r => r.json()),
      ])
      if (s.error) { setError(s.error); return; }
      setSummary(s); setDaily(d); setBreakdown(b); setQrPerf(q); setSuspicious(su)
      setAuthed(true)
    } catch (e: any) {
      setError(e.message || '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const styles = {
    page: { minHeight: '100vh', background: '#0A0A0A', color: '#fff', padding: '24px 20px', fontFamily: '-apple-system, sans-serif' },
    title: { fontSize: 24, fontWeight: 800, marginBottom: 24, color: '#FF6B35' },
    input: { padding: '12px 16px', borderRadius: 10, background: '#1A1A1A', border: '1px solid #333', color: '#fff', fontSize: 15, width: '100%', marginBottom: 12 },
    btn: { padding: '12px 24px', borderRadius: 10, background: '#FF6B35', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' },
    card: { background: '#1A1A1A', borderRadius: 16, padding: 20, marginBottom: 16 },
    stat: { display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #222' },
    tab: (active: boolean) => ({
      padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      background: active ? '#FF6B35' : '#1A1A1A', color: active ? '#fff' : '#888', border: 'none', marginRight: 8, marginBottom: 8,
    }),
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { textAlign: 'left' as const, padding: '8px 12px', background: '#1A1A1A', color: '#888', borderBottom: '1px solid #333' },
    td: { padding: '8px 12px', borderBottom: '1px solid #1A1A1A', color: '#ddd' },
  }

  if (!authed) {
    return (
      <div style={{ ...styles.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🔐</div>
          <div style={{ ...styles.title, textAlign: 'center' }}>관리자 로그인</div>
          <input
            style={styles.input}
            type="password"
            placeholder="Admin Key"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchAll(key)}
          />
          {error && <div style={{ color: '#FF4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button style={styles.btn} onClick={() => fetchAll(key)} disabled={loading}>
            {loading ? '확인 중...' : '로그인'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={styles.title}>📊 이벤트 관리자</div>
        <button style={{ ...styles.btn, width: 'auto', padding: '8px 16px', fontSize: 13 }} onClick={() => { setAuthed(false); setKey('') }}>로그아웃</button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 20, flexWrap: 'wrap', display: 'flex' }}>
        {(['summary', 'daily', 'breakdown', 'qr', 'suspicious'] as const).map(t => (
          <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'summary' ? '요약' : t === 'daily' ? '일별' : t === 'breakdown' ? '유입분석' : t === 'qr' ? 'QR성과' : '의심IP'}
          </button>
        ))}
      </div>

      {/* Summary */}
      {tab === 'summary' && summary && (
        <div style={styles.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>전체 현황</div>
          {[
            { label: '총 스캔수', value: summary.totalScans?.toLocaleString() + '회' },
            { label: '총 스핀수', value: summary.totalSpins?.toLocaleString() + '회' },
            { label: '번호 수집', value: summary.totalClaims?.toLocaleString() + '명' },
            { label: '전환율', value: summary.conversionRate + '%' },
            { label: '지급 총 포인트', value: (summary.totalPointsEarned || 0).toLocaleString() + 'P' },
          ].map(item => (
            <div key={item.label} style={styles.stat}>
              <span style={{ color: '#888', fontSize: 14 }}>{item.label}</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#FF6B35' }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daily */}
      {tab === 'daily' && (
        <div style={styles.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>일별 추이 (최근 30일)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>날짜</th>
                  <th style={styles.th}>스캔</th>
                  <th style={styles.th}>적립</th>
                  <th style={styles.th}>포인트</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>{row.scans}</td>
                    <td style={styles.td}>{row.claims}</td>
                    <td style={styles.td}>{row.points?.toLocaleString()}P</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown */}
      {tab === 'breakdown' && (
        <div style={styles.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>맛/국가/유통사별 유입</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>맛</th>
                  <th style={styles.th}>국가</th>
                  <th style={styles.th}>채널</th>
                  <th style={styles.th}>스캔수</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{row.flavor}</td>
                    <td style={styles.td}>{row.country}</td>
                    <td style={styles.td}>{row.channel}</td>
                    <td style={styles.td}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QR Performance */}
      {tab === 'qr' && (
        <div style={styles.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>QR 성과표</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>QR ID</th>
                  <th style={styles.th}>스캔</th>
                  <th style={styles.th}>스핀</th>
                  <th style={styles.th}>적립</th>
                  <th style={styles.th}>전환율</th>
                </tr>
              </thead>
              <tbody>
                {qrPerf.map((row, i) => (
                  <tr key={i}>
                    <td style={styles.td}><div style={{ fontSize: 11, color: '#888' }}>{row.qrId}</div><div style={{ fontSize: 12 }}>{row.flavor} · {row.channel}</div></td>
                    <td style={styles.td}>{row.scans}</td>
                    <td style={styles.td}>{row.spins}</td>
                    <td style={styles.td}>{row.claims}</td>
                    <td style={styles.td}>{row.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspicious */}
      {tab === 'suspicious' && (
        <div style={styles.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>의심 IP (24시간 내 3회 이상)</div>
          {suspicious.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14 }}>의심 IP가 없습니다 ✅</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>IP</th>
                  <th style={styles.th}>요청수</th>
                </tr>
              </thead>
              <tbody>
                {suspicious.map((row, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{row.ip}</td>
                    <td style={{ ...styles.td, color: '#FF4444', fontWeight: 700 }}>{row.count}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 24 }}>
        본 포인트는 현금으로 교환되지 않으며, 하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
      </div>
    </div>
  )
}
