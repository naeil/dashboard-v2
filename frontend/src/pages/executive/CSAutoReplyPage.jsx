import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://naeil-dashboard.onrender.com'
const api = axios.create({ baseURL: `${API_BASE}/api` })
api.interceptors.request.use((config) => {
      const token = localStorage.getItem('dashboard_auth_token')
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
})

const STATUS_COLORS = { PENDING: '#f59e0b', AUTO_SENT: '#10b981', MANUALLY_SENT: '#3b82f6', REJECTED: '#ef4444', DRAFT: '#6b7280' }
const STATUS_LABELS = { PENDING: '검수 대기', AUTO_SENT: '자동발송', MANUALLY_SENT: '수동발송', REJECTED: '반려', DRAFT: '초안' }
const RISK_COLORS = { AUTO: '#10b981', QUEUE: '#ef4444' }
const RISK_LABELS = { AUTO: '자동발송', QUEUE: '검수필요' }
const CATEGORIES = ['단순감사', '상품문의', '배송문의', '교환반품', '불만클레임', '기타']
const BRAND_GREETINGS = {
      '하이프리': '고객님의 건강을 챙겨주셔서 감사합니다.안녕하세요, 하이프리입니다 :)',
      '국민한상': '고객님의 소중한 식사를 챙겨주셔서 감사합니다. 안녕하세요, 국민한상입니다 :)'
}

function Badge({ label, color }) {
      if (!label) return null
      return React.createElement('span', {
              style: { fontSize: 11, fontWeight: 600, color: '#fff', background: color || '#6b7280', padding: '2px 8px', borderRadius: 99, marginRight: 4 }
      }, label)
}

function Toggle({ checked, onChange }) {
      return React.createElement('button', {
              onClick: onChange,
              style: { width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: checked ? '#10b981' : '#d1d5db', position: 'relative' }
      },
                                     React.createElement('span', {
                                               style: { position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', transition: 'left 0.2s' }
                                     })
                                   )
}

export default function CSAutoReplyPage() {
      const [tab, setTab] = useState('dashboard')
      const [status, setStatus] = useState(null)
      const [stats, setStats] = useState(null)
      const [queue, setQueue] = useState([])
      const [log, setLog] = useState([])
      const [msg, setMsg] = useState(null)
      const [collectLoading, setCollectLoading] = useState(false)
      const [expandedId, setExpandedId] = useState(null)

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const load = useCallback(async () => {
          try {
                    const [s, st, q, l] = await Promise.all([
                                api.get('/cs-auto-reply/status'),
                                api.get('/cs-auto-reply/stats'),
                                api.get('/cs-auto-reply/queue'),
                                api.get('/cs-auto-reply/log')
                              ])
                    setStatus(s.data); setStats(st.data); setQueue(q.data || []); setLog(l.data || [])
          } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleKillSwitch = async () => {
          if (!status) return
          const next = !status.autoSendEnabled
          if (next && !window.confirm('자동발송을 활성화하시겠습니까?')) return
          await api.post('/cs-auto-reply/kill-switch', { enabled: next })
          showMsg(next ? '✅ 자동발송 활성화' : '🛑 자동발송 중단')
          load()
  }

  const toggleDryRun = async () => {
          if (!status) return
          const next = !status.dryRunMode
          if (!next && !window.confirm('드라이런 OFF 시 실제 답변이 발송됩니다. 계속?')) return
          await api.post('/cs-auto-reply/dry-run', { dryRun: next })
          showMsg(next ? '🔄 드라이런 ON' : '🚀 실제 발송 모드')
          load()
  }

  const toggleCategory = async (cat, enabled) => {
          await api.put(`/cs-auto-reply/category/${encodeURIComponent(cat)}/toggle`, { enabled })
          showMsg(`${cat} ${enabled ? '자동발송 ON' : '자동발송 OFF'}`)
          load()
  }

  const collect = async () => {
          setCollectLoading(true)
          try {
                    const r = await api.post('/cs-auto-reply/collect')
                    showMsg(`✅ 수집완료: 신규 ${r.data.saved}건, 중복 ${r.data.skipped}건`)
                    load()
          } catch { showMsg('오류 발생', 'error') }
          setCollectLoading(false)
  }

  const approve = async (id) => {
          if (!window.confirm('이 답변을 승인하고 발송하시겠습니까?')) return
          const r = await api.post(`/cs-auto-reply/${id}/approve`, { approvedBy: '운영자' })
          showMsg(r.data.success ? '✅ 발송완료' : `❌ ${r.data.message}`, r.data.success ? 'success' : 'error')
          load()
  }

  const reject = async (id) => {
          if (!window.confirm('반려하시겠습니까?')) return
          await api.post(`/cs-auto-reply/${id}/reject`)
          showMsg('🚫 반려처리')
          load()
  }

  const card = (item, showActions) => React.createElement('div', {
          key: item.id,
          style: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 12 }
  },
                                                              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 } },
                                                                                        React.createElement('div', null,
                                                                                                                    React.createElement(Badge, { label: item.brand, color: '#6366f1' }),
                                                                                                                    React.createElement(Badge, { label: item.category, color: '#6b7280' }),
                                                                                                                    React.createElement(Badge, { label: RISK_LABELS[item.riskLevel], color: RISK_COLORS[item.riskLevel] }),
                                                                                                                    React.createElement(Badge, { label: STATUS_LABELS[item.status], color: STATUS_COLORS[item.status] }),
                                                                                                                    item.dryRun && React.createElement(Badge, { label: '드라이런', color: '#f59e0b' })
                                                                                                                  ),
                                                                                        showActions && React.createElement('div', { style: { display: 'flex', gap: 8 } },
                                                                                                                                   React.createElement('button', { onClick: () => setExpandedId(expandedId === item.id ? null : item.id), style: { padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 } }, expandedId === item.id ? '접기' : '답변보기'),
                                                                                                                                   React.createElement('button', { onClick: () => approve(item.id), style: { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 12 } }, '✅ 승인'),
                                                                                                                                   React.createElement('button', { onClick: () => reject(item.id), style: { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 } }, '🚫 반려')
                                                                                                                                 )
                                                                                      ),
                                                              React.createElement('div', { style: { fontSize: 13, color: '#6b7280' } }, `채널: ${item.channel || '-'} | 문의번호: ${item.inqUniq}`),
                                                              expandedId === item.id && React.createElement('div', { style: { marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8 } },
                                                                                                                  React.createElement('div', { style: { fontWeight: 600, fontSize: 13, marginBottom: 4 } }, `제목: ${item.replyTitle}`),
                                                                                                                  React.createElement('pre', { style: { fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 } }, item.replyContent)
                                                                                                                )
                                                            )

  return React.createElement('div', { style: { padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: 'sans-serif' } },
                                 React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
                                                           React.createElement('div', null,
                                                                                       React.createElement('h1', { style: { fontSize: 24, fontWeight: 700, margin: 0 } }, '🤖 CS 자동답변 센터'),
                                                                                       React.createElement('p', { style: { fontSize: 13, color: '#6b7280', margin: '4px 0 0' } }, '플레이오토 연동 • 위험도 2단계 게이트 • 드라이런 모드 지원')
                                                                                     ),
                                                           React.createElement('div', { style: { display: 'flex', gap: 8 } },
                                                                                       React.createElement('button', { onClick: toggleKillSwitch, style: { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: status?.autoSendEnabled ? '#ef4444' : '#6b7280', color: '#fff' } }, status?.autoSendEnabled ? '🛑 자동발송 중단' : '▶ 자동발송 시작'),
                                                                                       React.createElement('button', { onClick: collect, disabled: collectLoading, style: { padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff' } }, collectLoading ? '수집중...' : '🔄 문의 수집')
                                                                                     )
                                                         ),
                                 msg && React.createElement('div', { style: { padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.type === 'error' ? '#dc2626' : '#15803d', border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}` } }, msg.text),
                                 status?.dryRunMode && React.createElement('div', { style: { padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 } }, '🔄 드라이런 모드 활성화 — 실제 발송 없이 답변만 생성·로그합니다.'),
                                 React.createElement('div', { style: { display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24 } },
                                                           ['dashboard', 'queue', 'log', 'settings'].map(t =>
                                                                       React.createElement('button', { key: t, onClick: () => setTab(t), style: { padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#2563eb' : '#6b7280', borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent' } },
                                                                                                     t === 'dashboard' ? '대시보드' : t === 'queue' ? `검수 대기 ${queue.length > 0 ? `(${queue.length})` : ''}` : t === 'log' ? '발송 로그' : '설정'
                                                                                                   )
                                                                                                               )
                                                         ),
                                 tab === 'dashboard' && React.createElement('div', null,
                                                                                  React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 24 } },
                                                                                                              [
                                                                                                                  { label: '전체 문의', value: stats?.totalInquiries, color: '#6366f1' },
                                                                                                                  { label: '검수 대기', value: stats?.pendingQueue, color: '#f59e0b' },
                                                                                                                  { label: '자동발송', value: stats?.autoSent, color: '#10b981' },
                                                                                                                  { label: '수동발송', value: stats?.manuallySent, color: '#3b82f6' },
                                                                                                                  { label: '반려', value: stats?.rejected, color: '#ef4444' }
                                                                                                                          ].map(c => React.createElement('div', { key: c.label, style: { background: '#fff', borderRadius: 12, padding: '20px 16px', border: '1px solid #e5e7eb', textAlign: 'center' } },
                                                                                                                                                                   React.createElement('div', { style: { fontSize: 28, fontWeight: 700, color: c.color } }, c.value ?? '-'),
                                                                                                                                                                   React.createElement('div', { style: { fontSize: 12, color: '#6b7280', marginTop: 4 } }, c.label)
                                                                                                                                                                 ))
                                                                                                            ),
                                                                                  React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' } },
                                                                                                              React.createElement('h3', { style: { margin: '0 0 16px' } }, '시스템 상태'),
                                                                                                              [
                                                                                                                  { label: '자동발송', value: status?.autoSendEnabled ? '활성화' : '중단됨', ok: status?.autoSendEnabled },
                                                                                                                  { label: '드라이런', value: status?.dryRunMode ? 'ON (로그만)' : 'OFF (실제 발송)', ok: !status?.dryRunMode },
                                                                                                                  { label: '신뢰도 임계값', value: status?.confidenceThreshold ? `${(status.confidenceThreshold * 100).toFixed(0)}%` : '-' },
                                                                                                                  { label: '페르소나 버전', value: status?.personaVersion || '-' }
                                                                                                                          ].map(row => React.createElement('div', { key: row.label, style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' } },
                                                                                                                                                                     React.createElement('span', { style: { fontSize: 13, color: '#6b7280' } }, row.label),
                                                                                                                                                                     React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: row.ok === undefined ? '#111' : row.ok ? '#10b981' : '#ef4444' } }, row.value)
                                                                                                                                                                   ))
                                                                                                            )
                                                                                ),
                                 tab === 'queue' && React.createElement('div', null,
                                                                              queue.length === 0
                                                                                ? React.createElement('div', { style: { textAlign: 'center', padding: '60px 0', color: '#6b7280' } }, '검수 대기 중인 문의가 없습니다 🎉')
                                                                                : queue.map(item => card(item, true))
                                                                            ),
                                 tab === 'log' && React.createElement('div', null,
                                                                            log.length === 0
                                                                              ? React.createElement('div', { style: { textAlign: 'center', padding: '60px 0', color: '#6b7280' } }, '발송 로그가 없습니다')
                                                                              : log.map(item => card(item, false))
                                                                          ),
                                 tab === 'settings' && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
                                                                                 React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' } },
                                                                                                             React.createElement('h3', { style: { margin: '0 0 8px' } }, '🔄 드라이런 모드'),
                                                                                                             React.createElement('p', { style: { fontSize: 13, color: '#6b7280', margin: '0 0 12px' } }, '실제 발송 없이 답변만 생성·로그합니다. 품질 확인 후 OFF로 전환하세요.'),
                                                                                                             React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
                                                                                                                                           React.createElement(Toggle, { checked: status?.dryRunMode ?? true, onChange: toggleDryRun }),
                                                                                                                                           React.createElement('span', { style: { fontWeight: 600, color: status?.dryRunMode ? '#f59e0b' : '#10b981' } }, status?.dryRunMode ? '드라이런 ON' : '실제 발송 모드')
                                                                                                                                         )
                                                                                                           ),
                                                                                 React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' } },
                                                                                                             React.createElement('h3', { style: { margin: '0 0 8px' } }, '📂 카테고리별 자동발송'),
                                                                                                             React.createElement('p', { style: { fontSize: 13, color: '#6b7280', margin: '0 0 12px' } }, 'OFF 시 해당 카테고리는 항상 검수 대기로 이동합니다.'),
                                                                                                             CATEGORIES.map(cat => {
                                                                                                                           const enabled = status?.categoryAutoEnabled?.[cat] ?? false
                                                                                                                           return React.createElement('div', { key: cat, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f9fafb', borderRadius: 8, marginBottom: 8 } },
                                                                                                                                                                  React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } },
                                                                                                                                                                                                    cat,
                                                                                                                                                                                                    ['교환반품','불만클레임'].includes(cat) && React.createElement('span', { style: { marginLeft: 8, fontSize: 11, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 } }, '위험')
                                                                                                                                                                                                  ),
                                                                                                                                                                  React.createElement(Toggle, { checked: enabled, onChange: () => toggleCategory(cat, !enabled) })
                                                                                                                                                                )
                                                                                                                 })
                                                                                                           ),
                                                                                 React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' } },
                                                                                                             React.createElement('h3', { style: { margin: '0 0 16px' } }, '🎭 브랜드 페르소나'),
                                                                                                             Object.entries(BRAND_GREETINGS).map(([brand, greeting]) =>
                                                                                                                           React.createElement('div', { key: brand, style: { padding: 14, background: '#f9fafb', borderRadius: 8, marginBottom: 12 } },
                                                                                                                                                           React.createElement('div', { style: { fontWeight: 600, marginBottom: 8 } }, brand),
                                                                                                                                                           React.createElement('div', { style: { fontSize: 12, color: '#374151', background: '#fff', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #6366f1', fontStyle: 'italic' } }, `"${greeting}"`)
                                                                                                                                                         )
                                                                                                                                                         )
                                                                                                           ),
                                                                                 React.createElement('div', { style: { background: '#fffbeb', borderRadius: 12, padding: 20, border: '1px solid #fde68a' } },
                                                                                                             React.createElement('h3', { style: { margin: '0 0 8px' } }, '🔑 플레이오토 API 키'),
                                                                                                             React.createElement('p', { style: { fontSize: 13, color: '#78350f', lineHeight: 1.6, margin: 0 } },
                                                                                                                                           '채널 설정에서 PLAYAUTO 채널 선택 후:', React.createElement('br'),
                                                                                                                                           '• Key1: x-api-key (개발자센터)', React.createElement('br'),
                                                                                                                                           '• Key2: 솔루션 인증키 (환경설정 → API 사용설정)'
                                                                                                                                         )
                                                                                                           )
                                                                               )
                               )
}
