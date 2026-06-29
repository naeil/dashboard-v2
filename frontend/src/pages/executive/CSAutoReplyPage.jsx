import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://naeil-dashboard.onrender.com'
const api = axios.create({ baseURL: `${API_BASE}/api` })
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('dashboard_auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

const STATUS_LABEL = {
    PENDING: { label: '검수 대기', color: '#f59e0b' },
    AUTO_SENT: { label: '자동발송', color: '#10b981' },
    MANUALLY_SENT: { label: '수동발송', color: '#3b82f6' },
    REJECTED: { label: '반려', color: '#ef4444' },
    DRAFT: { label: '초안', color: '#6b7280' },
}

const RISK_LABEL = {
    AUTO: { label: '자동발송', color: '#10b981' },
    QUEUE: { label: '검수필요', color: '#ef4444' },
}

const CATEGORIES = ['단순감사', '상품문의', '배송문의', '교환반품', '불만클레임', '기타']

export default function CSAutoReplyPage() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [status, setStatus] = useState(null)
    const [stats, setStats] = useState(null)
    const [queue, setQueue] = useState([])
    const [log, setLog] = useState([])
    const [loading, setLoading] = useState(false)
    const [collectLoading, setCollectLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [selectedReply, setSelectedReply] = useState(null)

  const showMessage = (text, type = 'success') => {
        setMessage({ text, type })
        setTimeout(() => setMessage(null), 4000)
  }

  const fetchStatus = useCallback(async () => {
        try {
                const res = await api.get('/cs-auto-reply/status')
                setStatus(res.data)
        } catch (e) { console.error(e) }
  }, [])

  const fetchStats = useCallback(async () => {
        try {
                const res = await api.get('/cs-auto-reply/stats')
                setStats(res.data)
        } catch (e) { console.error(e) }
  }, [])

  const fetchQueue = useCallback(async () => {
        try {
                const res = await api.get('/cs-auto-reply/queue')
                setQueue(res.data || [])
        } catch (e) { console.error(e) }
  }, [])

  const fetchLog = useCallback(async () => {
        try {
                const res = await api.get('/cs-auto-reply/log')
                setLog(res.data || [])
        } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
        fetchStatus()
        fetchStats()
        fetchQueue()
        fetchLog()
  }, [fetchStatus, fetchStats, fetchQueue, fetchLog])

  // 킬 스위치
  const toggleKillSwitch = async () => {
        if (!status) return
        const newVal = !status.autoSendEnabled
        if (newVal && !window.confirm('자동발송을 활성화하시겠습니까?\n드라이런 모드가 OFF 상태일 때만 실제 발송됩니다.')) return
        try {
                await api.post('/cs-auto-reply/kill-switch', { enabled: newVal })
                showMessage(newVal ? '✅ 자동발송 활성화됨' : '🛑 자동발송 중단됨 (킬 스위치 ON)')
                fetchStatus()
        } catch (e) { showMessage('오류가 발생했습니다', 'error') }
  }

  // 드라이런 토글
  const toggleDryRun = async () => {
        if (!status) return
        const newVal = !status.dryRunMode
        if (!newVal && !window.confirm('드라이런 모드를 OFF로 설정하면 실제 답변이 발송됩니다.\n계속하시겠습니까?')) return
        try {
                await api.post('/cs-auto-reply/dry-run', { dryRun: newVal })
                showMessage(newVal ? '🔄 드라이런 모드 ON' : '🚀 실제 발송 모드 ON')
                fetchStatus()
        } catch (e) { showMessage('오류가 발생했습니다', 'error') }
  }

  // 카테고리 토글
  const toggleCategory = async (category, enabled) => {
        try {
                await api.put(`/cs-auto-reply/category/${encodeURIComponent(category)}/toggle`, { enabled })
                showMessage(`${category} 카테고리 자동발송 ${enabled ? '활성화' : '비활성화'}`)
                fetchStatus()
        } catch (e) { showMessage('오류가 발생했습니다', 'error') }
  }

  // 문의 수집
  const collectInquiries = async () => {
        setCollectLoading(true)
        try {
                const res = await api.post('/cs-auto-reply/collect')
                showMessage(`✅ 수집 완료: 신규 ${res.data.saved}건 처리, ${res.data.skipped}건 중복 건너뜀`)
                fetchStats(); fetchQueue(); fetchLog()
        } catch (e) { showMessage('수집 중 오류가 발생했습니다', 'error') }
        finally { setCollectLoading(false) }
  }

  // 승인 발송
  const approveReply = async (id) => {
        if (!window.confirm('이 답변을 승인하고 발송하시겠습니까?')) return
        setLoading(true)
        try {
                const res = await api.post(`/cs-auto-reply/${id}/approve`, { approvedBy: '운영자' })
                if (res.data.success) {
                          showMessage('✅ 답변이 발송되었습니다')
                          fetchQueue(); fetchLog(); fetchStats()
                } else {
                          showMessage(`❌ 발송 실패: ${res.data.message}`, 'error')
                }
        } catch (e) { showMessage('오류가 발생했습니다', 'error') }
        finally { setLoading(false) }
  }

  // 반려
  const rejectReply = async (id) => {
        if (!window.confirm('이 답변을 반려하시겠습니까?')) return
        try {
                await api.post(`/cs-auto-reply/${id}/reject`)
                showMessage('🚫 답변이 반려되었습니다')
                fetchQueue(); fetchStats()
        } catch (e) { showMessage('오류가 발생했습니다', 'error') }
  }

  const tabs = [
    { id: 'dashboard', label: '대시보드' },
    { id: 'queue', label: `검수 대기 ${queue.length > 0 ? `(${queue.length})` : ''}` },
    { id: 'log', label: '발송 로그' },
    { id: 'settings', label: '설정' },
      ]

  return (
        <div style={{ padding: '24px', fontFamily: 'Pretendard, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
          {/* 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                          <div>
                                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                                                🤖 CS 자동답변 센터
                                    </h1>h1>
                                    <p style={{ fontSize: 13, color: '#6b7280' }}>
                                                플레이오토 연동 • 위험도 2단계 게이트 • 드라이런 모드 지원
                                    </p>p>
                          </div>div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {/* 킬 스위치 */}
                                  <button onClick={toggleKillSwitch}
                                                style={{
                                                                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                                                                background: status?.autoSendEnabled ? '#ef4444' : '#6b7280', color: '#fff'
                                                }}>
                                    {status?.autoSendEnabled ? '🛑 자동발송 중단' : '▶ 자동발송 시작'}
                                  </button>button>
                          {/* 문의 수집 */}
                                  <button onClick={collectInquiries} disabled={collectLoading}
                                                style={{
                                                                padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer',
                                                                fontWeight: 600, fontSize: 13, background: '#fff', color: '#374151'
                                                }}>
                                    {collectLoading ? '수집 중...' : '🔄 문의 수집'}
                                  </button>button>
                        </div>div>
                </div>div>
        
          {/* 알림 메시지 */}
          {message && (
                  <div style={{
                              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                              background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
                              color: message.type === 'error' ? '#dc2626' : '#15803d',
                              border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`
                  }}>
                    {message.text}
                  </div>div>
              )}
        
          {/* 드라이런 배너 */}
          {status?.dryRunMode && (
                  <div style={{
                              padding: '10px 16px', borderRadius: 8, marginBottom: 16,
                              background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
                              fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                  }}>
                            🔄 <strong>드라이런 모드 활성화</strong>strong> — 실제 발송 없이 답변만 생성·로그합니다.
                            품질 검수 후 설정에서 드라이런을 OFF로 전환하세요.
                  </div>div>
              )}
        
          {/* 탭 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                  style={{
                                                  padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
                                                  fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
                                                  color: activeTab === tab.id ? '#2563eb' : '#6b7280',
                                                  borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                                  }}>
                      {tab.label}
                    </button>button>
                  ))}
              </div>div>
        
          {/* 대시보드 탭 */}
          {activeTab === 'dashboard' && (
                  <div>
                    {/* 통계 카드 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
                              {[
                    { label: '전체 문의', value: stats?.totalInquiries ?? '-', color: '#6366f1' },
                    { label: '검수 대기', value: stats?.pendingQueue ?? '-', color: '#f59e0b' },
                    { label: '자동발송', value: stats?.autoSent ?? '-', color: '#10b981' },
                    { label: '수동발송', value: stats?.manuallySent ?? '-', color: '#3b82f6' },
                    { label: '반려', value: stats?.rejected ?? '-', color: '#ef4444' },
                                ].map(card => (
                                                <div key={card.label} style={{
                                                                  background: '#fff', borderRadius: 12, padding: '20px 16px',
                                                                  border: '1px solid #e5e7eb', textAlign: 'center'
                                                }}>
                                                                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>div>
                                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{card.label}</div>div>
                                                </div>div>
                                              ))}
                            </div>div>
                  
                    {/* 시스템 상태 */}
                            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>시스템 상태</h3>h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                      <StatusRow label="자동발송" value={status?.autoSendEnabled ? '활성화' : '중단됨 (킬 스위치)'} active={status?.autoSendEnabled} />
                                                      <StatusRow label="드라이런 모드" value={status?.dryRunMode ? 'ON (로그만)' : 'OFF (실제 발송)'} active={!status?.dryRunMode} />
                                                      <StatusRow label="신뢰도 임계값" value={status?.confidenceThreshold ? `${(status.confidenceThreshold * 100).toFixed(0)}%` : '-'} />
                                                      <StatusRow label="페르소나 버전" value={status?.personaVersion ?? '-'} />
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        
          {/* 검수 대기 탭 */}
          {activeTab === 'queue' && (
                  <div>
                    {queue.length === 0 ? (
                                <EmptyState text="검수 대기 중인 문의가 없습니다 🎉" />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {queue.map(item => (
                                                  <ReplyCard key={item.id} item={item}
                                                                      onApprove={() => approveReply(item.id)}
                                                                      onReject={() => rejectReply(item.id)}
                                                                      onSelect={() => setSelectedReply(selectedReply?.id === item.id ? null : item)}
                                                                      isSelected={selectedReply?.id === item.id}
                                                                      loading={loading}
                                                                    />
                                                ))}
                                </div>div>
                            )}
                  </div>div>
              )}
        
          {/* 발송 로그 탭 */}
          {activeTab === 'log' && (
                  <div>
                    {log.length === 0 ? (
                                <EmptyState text="발송 로그가 없습니다" />
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                              <thead>
                                                                                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                                                  {['ID', '채널', '브랜드', '카테고리', '위험도', '신뢰도', '상태', '드라이런', '발송시각', '생성시각'].map(h => (
                                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}>{h}</th>th>
                                                      ))}
                                                                                </tr>tr>
                                                              </thead>thead>
                                                              <tbody>
                                                                {log.map(item => (
                                                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                            <td style={{ padding: '10px 12px' }}>{item.id}</td>td>
                                                                            <td style={{ padding: '10px 12px' }}>{item.channel}</td>td>
                                                                            <td style={{ padding: '10px 12px' }}>{item.brand}</td>td>
                                                                            <td style={{ padding: '10px 12px' }}>{item.category}</td>td>
                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                    <Badge label={RISK_LABEL[item.riskLevel]?.label ?? item.riskLevel} color={RISK_LABEL[item.riskLevel]?.color} />
                                                                            </td>td>
                                                                            <td style={{ padding: '10px 12px' }}>{item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '-'}</td>td>
                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                    <Badge label={STATUS_LABEL[item.status]?.label ?? item.status} color={STATUS_LABEL[item.status]?.color} />
                                                                            </td>td>
                                                                            <td style={{ padding: '10px 12px' }}>{item.dryRun ? '🔄 드라이런' : '실제'}</td>td>
                                                                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{item.sentAt ? new Date(item.sentAt).toLocaleString('ko') : '-'}</td>td>
                                                                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('ko') : '-'}</td>td>
                                                      </tr>tr>
                                                    ))}
                                                              </tbody>tbody>
                                              </table>table>
                                </div>div>
                            )}
                  </div>div>
              )}
        
          {/* 설정 탭 */}
          {activeTab === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* 드라이런 설정 */}
                            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🔄 드라이런 모드</h3>h3>
                                        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                                                      ON 상태에서는 실제 발송 없이 답변만 생성·로그합니다. 품질 검수 후 OFF로 전환하세요.
                                        </p>p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                      <ToggleSwitch checked={status?.dryRunMode ?? true} onChange={toggleDryRun} />
                                                      <span style={{ fontSize: 14, color: status?.dryRunMode ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                                                        {status?.dryRunMode ? '드라이런 모드 ON' : '실제 발송 모드'}
                                                      </span>span>
                                        </div>div>
                            </div>div>
                  
                    {/* 카테고리별 자동발송 토글 */}
                            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📂 카테고리별 자동발송</h3>h3>
                                        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                                                      각 카테고리의 자동발송 여부를 설정합니다. OFF 시 해당 카테고리는 항상 검수 대기로 이동합니다.
                                        </p>p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                          {CATEGORIES.map(cat => {
                                    const enabled = status?.categoryAutoEnabled?.[cat] ?? false
                                                      return (
                                                                          <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f9fafb', borderRadius: 8 }}>
                                                                                              <div>
                                                                                                                    <span style={{ fontSize: 14, fontWeight: 500 }}>{cat}</span>span>
                                                                                                {['교환반품', '불만클레임'].includes(cat) && (
                                                                                                    <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>위험 카테고리</span>span>
                                                                                                                    )}
                                                                                                </div>div>
                                                                                              <ToggleSwitch checked={enabled} onChange={() => toggleCategory(cat, !enabled)} />
                                                                          </div>div>
                                                                        )
                                          })}
                                        </div>div>
                            </div>div>
                  
                    {/* 페르소나 정보 */}
                            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🎭 브랜드 페르소나</h3>h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                      <PersonaCard brand="하이프리" greeting="고객님의 건강을 챙겨주셔서 감사합니다.안녕하세요, 하이프리입니다 :)" tone="친근함" emoji="✅ 사용" />
                                                      <PersonaCard brand="국민한상" greeting="고객님의 소중한 식사를 챙겨주셔서 감사합니다. 안녕하세요, 국민한상입니다 :)" tone="정중함" emoji="✅ 사용" />
                                        </div>div>
                            </div>div>
                  
                    {/* PlayAuto API 연동 키 안내 */}
                            <div style={{ background: '#fffbeb', borderRadius: 12, padding: 20, border: '1px solid #fde68a' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>🔑 플레이오토 API 키 설정</h3>h3>
                                        <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                                                      채널 설정 페이지에서 <strong>PLAYAUTO</strong>strong> 채널을 선택하고<br />
                                                      • Key1: 플레이오토 개발자센터 x-api-key<br />
                                                      • Key2: 솔루션 인증키 (환경설정 → API 사용설정)
                                        </p>p>
                            </div>div>
                  </div>div>
              )}
        </div>div>
      )
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────

function StatusRow({ label, value, active }) {
    return (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>span>
                <span style={{ fontSize: 13, fontWeight: 600, color: active === undefined ? '#111' : active ? '#10b981' : '#ef4444' }}>{value}</span>span>
          </div>div>
        )
}

function ReplyCard({ item, onApprove, onReject, onSelect, isSelected, loading }) {
    return (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <Badge label={item.brand} color="#6366f1" />
                                  <Badge label={item.category} color="#6b7280" />
                                  <Badge label={RISK_LABEL[item.riskLevel]?.label} color={RISK_LABEL[item.riskLevel]?.color} />
                                  <span style={{ fontSize: 12, color: '#6b7280' }}>신뢰도 {item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '-'}</span>span>
                          {item.dryRun && <span style={{ fontSize: 11, color: '#f59e0b', background: '#fffbeb', padding: '2px 6px', borderRadius: 4 }}>드라이런</span>span>}
                        </div>div>
                        <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={onSelect} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                                    {isSelected ? '접기' : '답변 보기'}
                                  </button>button>
                                  <button onClick={onApprove} disabled={loading} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                              ✅ 승인 발송
                                  </button>button>
                                  <button onClick={onReject} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                                              🚫 반려
                                  </button>button>
                        </div>div>
                </div>div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>채널:</span>span> {item.channel} &nbsp;|&nbsp;
                        <span style={{ fontWeight: 600 }}>문의번호:</span>span> {item.inqUniq}
                </div>div>
            {isSelected && (
                    <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>제목: {item.replyTitle}</div>div>
                              <pre style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{item.replyContent}</pre>pre>
                    </div>div>
                )}
          </div>div>
        )
}

function Badge({ label, color }) {
    if (!label) return null
        return (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: color || '#6b7280', padding: '2px 8px', borderRadius: 99 }}>
                {label}
              </span>span>
            )
}

function ToggleSwitch({ checked, onChange }) {
    return (
          <button onClick={onChange} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                  background: checked ? '#10b981' : '#d1d5db', transition: 'background 0.2s'
          }}>
                <span style={{
                    position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block'
          }} />
          </button>button>
        )
}

function PersonaCard({ brand, greeting, tone, emoji }) {
    return (
          <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{brand}</div>div>
                <div style={{ fontSize: 12, color: '#374151', background: '#fff', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #6366f1', fontStyle: 'italic' }}>
                        "{greeting}"
                </div>div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                        <span>톤: {tone}</span>span>
                        <span>이모지: {emoji}</span>span>
                </div>div>
          </div>div>
        )
}

function EmptyState({ text }) {
    return (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280', fontSize: 15 }}>
            {text}
          </div>div>
        )
}</div>
