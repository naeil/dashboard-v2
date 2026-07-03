'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

type Stage = 'landing' | 'spinning' | 'result' | 'double' | 'phone' | 'complete'

interface SpinResult {
  rewardKey: string
  rewardLabel: string
  rewardPoints: number
  canDouble: boolean
}

interface ClaimResult {
  earnedPoints: number
  totalPoints: number
}

// Wheel segments (표시용 - 실제 당첨은 서버에서 결정)
const WHEEL_SEGMENTS = [
  { label: '1,000P', color: '#FF6B35', textColor: '#fff' },
  { label: '1,000P', color: '#FFD700', textColor: '#333' },
  { label: '1,500P', color: '#4ECDC4', textColor: '#fff' },
  { label: '1,000P', color: '#FF6B35', textColor: '#fff' },
  { label: '3,000P', color: '#FFD700', textColor: '#333' },
  { label: '1,000P', color: '#4ECDC4', textColor: '#fff' },
  { label: '5,000P', color: '#FF6B35', textColor: '#fff' },
  { label: '10,000P', color: '#FFD700', textColor: '#333' },
]

// Double wheel segments (표시용 - 꽝 80%, 다시하기 15%, 2배 5%)
const DOUBLE_SEGMENTS = [
  { label: '꽝', color: '#444', textColor: '#aaa' },
  { label: '꽝', color: '#333', textColor: '#888' },
  { label: '꽝', color: '#444', textColor: '#aaa' },
  { label: '다시하기', color: '#4ECDC4', textColor: '#fff' },
  { label: '꽝', color: '#333', textColor: '#888' },
  { label: '꽝', color: '#444', textColor: '#aaa' },
  { label: '다시하기', color: '#4ECDC4', textColor: '#fff' },
  { label: '2X 🎉', color: '#FF6B35', textColor: '#fff' },
]

function SpinWheel({ onSpin, spinning, result }: {
  onSpin: () => void
  spinning: boolean
  result: SpinResult | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [animating, setAnimating] = useState(false)
  const animRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const targetRotationRef = useRef<number>(0)

  const drawWheel = (rot: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 4
    const seg = WHEEL_SEGMENTS.length
    const arc = (2 * Math.PI) / seg

    ctx.clearRect(0, 0, size, size)

    WHEEL_SEGMENTS.forEach((s, i) => {
      const start = rot + i * arc - Math.PI / 2
      const end = start + arc
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = s.color
      ctx.fill()
      ctx.strokeStyle = '#0A0A0A'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(start + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = s.textColor
      ctx.font = `bold ${size * 0.055}px -apple-system, sans-serif`
      ctx.fillText(s.label, r - 12, 6)
      ctx.restore()
    })

    // Center circle
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.1, 0, 2 * Math.PI)
    ctx.fillStyle = '#1A1A1A'
    ctx.fill()
    ctx.strokeStyle = '#FF6B35'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#FF6B35'
    ctx.font = `bold ${size * 0.06}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('GO!', cx, cy)
  }

  useEffect(() => {
    drawWheel(rotation)
  }, [rotation])

  const startSpin = async () => {
    if (animating || spinning) return
    onSpin()
    setAnimating(true)
  }

  useEffect(() => {
    if (!spinning) return
    const seg = WHEEL_SEGMENTS.length
    const arc = (2 * Math.PI) / seg

    // 서버 result.rewardLabel과 매칭되는 세그먼트 인덱스 찾기
    let targetSegIdx = Math.floor(Math.random() * seg)
    if (result) {
      const matchIdx = WHEEL_SEGMENTS.findIndex(s => s.label === result.rewardLabel)
      if (matchIdx >= 0) targetSegIdx = matchIdx
    }

    // drawWheel: 세그먼트 i 중앙 = rot + i*arc + arc/2 - PI/2
    // 화살표(12시) = 각도 -PI/2
    // 세그먼트 i 중앙이 화살표에 오려면: rot = -i*arc - arc/2 (mod 2PI)
    const stopAngle = -(targetSegIdx * arc + arc / 2)
    // 현재 rotation에서 5바퀴 이상 돌고 stopAngle에 맞춰 멈춤
    const currentMod = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const stopMod = ((stopAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const diff = stopMod >= currentMod ? stopMod - currentMod : stopMod - currentMod + 2 * Math.PI
    const targetRot = rotation + 5 * 2 * Math.PI + diff

    startTimeRef.current = performance.now()

    const duration = 4000
    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const cur = rotation + (targetRot - rotation) * eased
      setRotation(cur)
      drawWheel(cur)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setRotation(targetRot)
        setAnimating(false)
      }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, result])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Arrow indicator */}
      <div style={{
        width: 0, height: 0,
        borderLeft: '14px solid transparent',
        borderRight: '14px solid transparent',
        borderTop: '28px solid #FF6B35',
        filter: 'drop-shadow(0 2px 4px rgba(255,107,53,0.6))',
        zIndex: 10
      }} />
      <div
        style={{ position: 'relative', cursor: spinning ? 'default' : 'pointer' }}
        onClick={!spinning && !animating ? startSpin : undefined}
      >
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          style={{
            borderRadius: '50%',
            boxShadow: '0 0 40px rgba(255,107,53,0.3), 0 0 80px rgba(255,107,53,0.1)',
            display: 'block'
          }}
        />
      </div>
    </div>
  )
}

function DoubleWheel({ onSpin, spinning, result }: {
  onSpin: () => void
  spinning: boolean
  result: { success: boolean; finalPoints: number; message: string } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [spun, setSpun] = useState(false)
  const animRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  const drawWheel = (rot: number, done?: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 4
    const seg = DOUBLE_SEGMENTS.length
    const arc = (2 * Math.PI) / seg
    ctx.clearRect(0, 0, size, size)
    DOUBLE_SEGMENTS.forEach((s, i) => {
      const start = rot + i * arc - Math.PI / 2
      const end = start + arc
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = s.color
      ctx.fill()
      ctx.strokeStyle = '#0A0A0A'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(start + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = s.textColor
      ctx.font = `bold ${size * 0.055}px -apple-system, sans-serif`
      ctx.fillText(s.label, r - 12, 6)
      ctx.restore()
    })
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.1, 0, 2 * Math.PI)
    ctx.fillStyle = '#1A1A1A'
    ctx.fill()
    ctx.strokeStyle = '#FF6B35'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#FF6B35'
    ctx.font = `bold ${size * 0.06}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(done ? '!' : 'GO!', cx, cy)
  }

  useEffect(() => { drawWheel(rotation) }, [rotation])

  const startSpin = () => {
    if (animating || spun) return
    onSpin()
    setAnimating(true)
  }

  useEffect(() => {
    if (!spinning) return
    const seg = DOUBLE_SEGMENTS.length
    const arc = (2 * Math.PI) / seg

    // 서버 결과에 따라 멈출 세그먼트 결정
    let targetSegIdx = Math.floor(Math.random() * seg)
    if (result) {
      // success=true → 2X🎉 세그먼트, retry=true → 다시하기, 나머지 → 꽝
      const targetLabel = result.success
        ? '2X🎉'
        : result.retry
        ? '다시하기'
        : '꽝'
      const matchIdx = DOUBLE_SEGMENTS.findIndex(s => s.label === targetLabel)
      if (matchIdx >= 0) targetSegIdx = matchIdx
    }

    const stopAngle = -(targetSegIdx * arc + arc / 2)
    const fullSpins = 5 * 2 * Math.PI
    const targetRotation = fullSpins + stopAngle

    const start = performance.now()
    const duration = 4000
    let animId: number
    const animate = (now: number) => {
      const elapsed = Math.min(now - start, duration)
      const t = elapsed / duration
      const eased = 1 - Math.pow(1 - t, 3)
      setRotation(eased * targetRotation)
      if (elapsed < duration) animId = requestAnimationFrame(animate)
      else setRotation(targetRotation % (2 * Math.PI))
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [spinning, result])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '28px solid #FF6B35', filter: 'drop-shadow(0 2px 4px rgba(255,107,53,0.6))', zIndex: 10 }} />
      <div style={{ position: 'relative', cursor: spinning || spun ? 'default' : 'pointer' }} onClick={!spinning && !spun ? startSpin : undefined}>
        <canvas ref={canvasRef} width={300} height={300} style={{ borderRadius: '50%', boxShadow: '0 0 40px rgba(255,107,53,0.3), 0 0 80px rgba(255,107,53,0.1)', display: 'block' }} />
      </div>
      {!spun && !spinning && <div style={{ fontSize: 14, color: '#888' }}>돌림판을 탭하여 시작하세요!</div>}
      {spinning && <div style={{ fontSize: 14, color: '#FF6B35' }}>돌아가는 중...</div>}
      {result && spun && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>{result.success ? '🚀' : '😅'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {result.success ? '2배 성공!' : '아쉽네요!'}
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>{result.message}</div>
        </div>
      )}
    </div>
  )
}

function Confetti() {
  const colors = ['#FF6B35', '#FFD700', '#4ECDC4', '#FF69B4', '#7CFC00']
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: Math.random() * 100 + '%',
          top: -20,
          width: 8 + Math.random() * 8,
          height: 8 + Math.random() * 8,
          background: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `confettiFall ${2 + Math.random() * 3}s ease-in ${Math.random() * 2}s forwards`,
        }} />
      ))}
    </div>
  )
}

function ProteinKkangContent() {
  const searchParams = useSearchParams()
  const [stage, setStage] = useState<Stage>('landing')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)
  const [phone, setPhone] = useState('')
  const [privacyAgree, setPrivacyAgree] = useState(true)
  const [marketingAgree, setMarketingAgree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [doubleResult, setDoubleResult] = useState<{ success: boolean; finalPoints: number; message: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [doubleSpinning, setDoubleSpinning] = useState(false)

  useEffect(() => {
    initSession()
  }, [])

  const initSession = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrId: searchParams.get('qr_id') || 'WEB_DIRECT',
          country: searchParams.get('country') || 'KR',
          channel: searchParams.get('channel') || 'web',
          product: searchParams.get('product') || 'protein-kkang',
          flavor: searchParams.get('flavor') || 'unknown',
          campaign: searchParams.get('campaign') || null,
          referrer: document.referrer || null,
        })
      })
      const data = await res.json()
      setSessionId(data.sessionId)
    } catch (e) {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSpin = async () => {
    if (!sessionId) return
    try {
      // 1. API 먼저 호출해서 결과 확보
      const res = await fetch(`${API}/api/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retry: false })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // 2. 결과를 state에 세팅 (SpinWheel이 이 값을 참조해서 정확한 각도에 멈춤)
      setSpinResult(data)
      // 3. 그 다음 애니메이션 시작
      setSpinning(true)
      // 4. 애니메이션 4초 대기
      await new Promise(r => setTimeout(r, 4000))
      // 5. result 스테이지로 이동
      setStage('result')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다')
      setSpinning(false)
    }
  }

  const handleDouble = async () => {
    if (!sessionId) return
    try {
      // 1. API 먼저 호출하여 결과를 받는다
      const res = await fetch(`${API}/api/doubleUp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await (res as Response).json()
      // 2. 결과를 먼저 저장 (애니메이션이 이 값을 참조)
      setDoubleResult(data)
      // 3. 결과를 알고 난 후 애니메이션 시작
      setStage('double')
      setDoubleSpinning(true)
      // 4. 4초 대기 (애니메이션 시간)
      await new Promise(r => setTimeout(r, 4000))
      setDoubleSpinning(false)
      if (data.success) {
        setSpinResult(prev => prev ? { ...prev, rewardPoints: data.finalPoints } : prev)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다')
    }
  }

  const handleClaim = async () => {
    if (!sessionId || !phone || !privacyAgree) return
    if (!/^01[016789]\d{7,8}$/.test(phone)) {
      setError('올바른 휴대폰 번호를 입력해주세요')
      return
    }
    if (!marketingAgree)
      return alert('마케팅 정보 활용 동의가 필요합니다');
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phoneNumber: phone, privacyAgree, marketingAgree })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClaimResult(data)
      setStage('complete')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const styles = {
    container: {
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #0F0F0F 0%, #1A0A00 100%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '0 20px 40px',
      maxWidth: 390,
      margin: '0 auto',
      position: 'relative' as const,
    },
    header: {
      width: '100%',
      paddingTop: 'calc(env(safe-area-inset-top, 16px) + 16px)',
      paddingBottom: 16,
      textAlign: 'center' as const,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(255,107,53,0.15)',
      border: '1px solid rgba(255,107,53,0.4)',
      borderRadius: 100,
      padding: '6px 14px',
      fontSize: 12,
      color: '#FF6B35',
      marginBottom: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 800,
      background: 'linear-gradient(135deg, #FF6B35 0%, #FFD700 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      lineHeight: 1.2,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: '#888',
      marginBottom: 32,
    },
    card: {
      width: '100%',
      background: '#1A1A1A',
      borderRadius: 20,
      padding: 24,
      marginBottom: 16,
    },
    btn: {
      width: '100%',
      padding: '18px 24px',
      borderRadius: 16,
      fontSize: 17,
      fontWeight: 700,
      background: 'linear-gradient(135deg, #FF6B35, #FF8C55)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 8px 24px rgba(255,107,53,0.4)',
      cursor: 'pointer',
      transition: 'transform 0.1s, box-shadow 0.1s',
      letterSpacing: '-0.3px',
    },
    btnSecondary: {
      width: '100%',
      padding: '16px 24px',
      borderRadius: 16,
      fontSize: 16,
      fontWeight: 600,
      background: '#242424',
      color: '#888',
      border: '1px solid #333',
      cursor: 'pointer',
    },
    input: {
      width: '100%',
      padding: '16px 18px',
      borderRadius: 14,
      fontSize: 18,
      fontWeight: 600,
      background: '#242424',
      color: '#fff',
      border: '2px solid #333',
      marginBottom: 12,
      letterSpacing: 2,
    },
    resultPoints: {
      fontSize: 64,
      fontWeight: 900,
      background: 'linear-gradient(135deg, #FF6B35 0%, #FFD700 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      lineHeight: 1,
    },
    disclaimer: {
      fontSize: 11,
      color: '#555',
      textAlign: 'center' as const,
      lineHeight: 1.6,
      marginTop: 16,
    }
  }

  if (loading && stage === 'landing') {
    return (
      <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#FF6B35', fontSize: 18 }}>로딩 중...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {showConfetti && <Confetti />}

      {/* Landing */}
      {stage === 'landing' && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
          <div style={styles.header}>
            <div style={styles.badge}>🏆 100% 당첨 보장</div>
            <div style={styles.title}>단백깡<br/>이벤트</div>
            <div style={styles.subtitle}>돌림판을 돌려 포인트를 받아가세요!</div>
          </div>

          <div style={{ ...styles.card, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>지금 당장 참여하세요</div>
            {['🥇 최대 1,000P 당첨', '✨ 100% 당첨 보장', '🎁 포인트 즉시 적립'].map(t => (
              <div key={t} style={{
                background: '#242424',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 8,
                fontSize: 15,
                color: '#ddd',
                textAlign: 'left',
              }}>{t}</div>
            ))}
          </div>

          {error && <div style={{ color: '#FF4444', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

          <button
            style={styles.btn}
            onClick={() => setStage('spinning')}
            disabled={!sessionId}
          >
            🎡 돌림판 돌리기
          </button>

          <div style={styles.disclaimer}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}

      {/* Spinning */}
      {stage === 'spinning' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
          <div style={{ ...styles.badge, marginBottom: 24 }}>🎡 행운의 돌림판</div>
          <SpinWheel
            onSpin={handleSpin}
            spinning={spinning}
            result={spinResult}
          />
          {!spinning && (
            <div style={{ marginTop: 32, textAlign: 'center', color: '#888', fontSize: 15 }}>
              돌림판을 탭하여 시작하세요!
            </div>
          )}
          {spinning && (
            <div style={{ marginTop: 32, textAlign: 'center', color: '#FF6B35', fontSize: 15, fontWeight: 600 }}>
              돌아가는 중... 🎉
            </div>
          )}
          {error && <div style={{ color: '#FF4444', fontSize: 14, marginTop: 12 }}>{error}</div>}
          <div style={{ ...styles.disclaimer, marginTop: 24 }}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}

      {/* Result */}
      {stage === 'result' && spinResult && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
          <div style={styles.header}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>축하합니다!</div>
            <div style={{ fontSize: 16, color: '#888' }}>{spinResult.rewardLabel}</div>
          </div>

          <div style={{ ...styles.card, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>획득 포인트</div>
            <div style={styles.resultPoints}>{spinResult.rewardPoints?.toLocaleString()}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FF6B35', marginBottom: 16 }}>P</div>
            <div style={{ fontSize: 14, color: '#555' }}>포인트를 2배로 늘릴 기회!</div>
          </div>

          <button style={{ ...styles.btn, marginBottom: 12 }} onClick={handleDouble} disabled={loading}>
            ⚡ 2배 도전하기!
          </button>
          <button style={styles.btnSecondary} onClick={() => setStage('phone')}>
            그냥 받을게요
          </button>
          <div style={styles.disclaimer}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}

      {/* Double result */}
      {stage === 'double' && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
          <div style={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)', borderRadius: 100, padding: '6px 14px', fontSize: 12, color: '#FF6B35', marginBottom: 16 }}>
              🎡 행운의 돌림판
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>2배 도전!</div>
            <div style={{ fontSize: 14, color: '#888' }}>돌림판을 돌려 포인트를 2배로!</div>
          </div>

          <DoubleWheel
            onSpin={() => {}}
            spinning={doubleSpinning}
            result={doubleResult}
          />

          {doubleResult && !doubleSpinning && (
            <>
              <div style={{ ...styles.card, textAlign: 'center', marginTop: 24 }}>
                <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>최종 포인트</div>
                <div style={styles.resultPoints}>{doubleResult?.finalPoints?.toLocaleString()}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#FF6B35' }}>P</div>
              </div>
              <button style={styles.btn} onClick={() => setStage('phone')}>
                📱 포인트 받기
              </button>
            </>
          )}
          <div style={styles.disclaimer}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}

      {/* Phone input */}
      {stage === 'phone' && (
        <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
          <div style={styles.header}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              포인트 받기
            </div>
            <div style={{ fontSize: 15, color: '#888' }}>
              휴대폰 번호로 포인트를 적립해드립니다
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>적립 포인트</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#FF6B35', marginBottom: 20 }}>
              {spinResult?.rewardPoints.toLocaleString()}P
            </div>

            <input
              style={styles.input}
              type="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '')
                setPhone(v)
                setError('')
              }}
              maxLength={11}
              inputMode="numeric"
            />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={privacyAgree}
                  onChange={e => setPrivacyAgree(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: '#FF6B35' }}
                />
                <span style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                  <span style={{ color: '#FF6B35' }}>[필수]</span> 개인정보 수집·이용 동의 (포인트 적립 목적, 보관기간 2년)
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={marketingAgree}
                  onChange={e => setMarketingAgree(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: '#FF6B35' }}
                />
                <span style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                  <span style={{ color: '#888' }}>[필수]</span> 마케팅 수신 동의 (이벤트·혜택 안내)
                </span>
              </label>
            </div>

            {error && <div style={{ color: '#FF4444', fontSize: 14, marginBottom: 12 }}>{error}</div>}
          </div>

          <button
            style={{
              ...styles.btn,
              opacity: (!phone || !privacyAgree || loading) ? 0.5 : 1,
            }}
            onClick={handleClaim}
            disabled={!phone || !privacyAgree || loading}
          >
            {loading ? '처리 중...' : '🎁 포인트 적립하기'}
          </button>
          <div style={styles.disclaimer}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}

      {/* Complete */}
      {stage === 'complete' && claimResult && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 88, marginBottom: 16 }}>🎊</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
            적립 완료!
          </div>
          <div style={{ fontSize: 16, color: '#888', marginBottom: 40, textAlign: 'center' }}>
            포인트가 성공적으로 적립되었습니다
          </div>

          <div style={{ ...styles.card, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>이번에 적립한 포인트</div>
            <div style={styles.resultPoints}>{claimResult.earnedPoints?.toLocaleString()}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FF6B35', marginBottom: 16 }}>P</div>
            <div style={{
              background: '#242424',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>총 누적 포인트</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#FFD700' }}>
                {claimResult.totalPoints?.toLocaleString()}P
              </div>
            </div>
          </div>

          <div style={{ ...styles.card, width: '100%' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>포인트 사용 안내</div>
            {['하이프리 제품 구매 할인', '추후 UPUP 앱 연동 예정', '포인트 유효기간: 적립일로부터 1년'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: '#FF6B35', fontSize: 16 }}>•</span>
                <span style={{ fontSize: 14, color: '#ccc' }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={styles.disclaimer}>
            본 포인트는 현금으로 교환되지 않으며,<br />
            하이프리 이벤트 및 제품 구매 혜택으로만 사용할 수 있습니다.
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProteinKkangPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#FF6B35', fontSize: 18 }}>
        로딩 중...
      </div>
    }>
      <ProteinKkangContent />
    </Suspense>
  )
}
