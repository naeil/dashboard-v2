import { useState } from 'react'

// 오프라인 공급가 구글시트 탭을 대시보드에 그대로 임베드(양방향).
// 편집권한 있는 사용자가 프레임 안에서 고치면 실제 구글시트가 바뀝니다.
// 구글이 /edit 프레임 삽입을 막는 경우엔 "새 탭에서 열기"로 폴백.
const SHEET_ID = '196wCXoInO4cBiLCIwYaptXYI4iDP0mzsoBj_7n5ix4g'
const GID = '1842677374' // [오프라인 공급가] 탭
const EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}#gid=${GID}`
const EMBED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}&rm=minimal&widget=true`

export default function SupplyPriceSheetPage() {
  const [blocked, setBlocked] = useState(false)

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">공급가 (오프라인)</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            구글시트를 그대로 연동 — 여기서 수정하면 시트도 함께 바뀝니다. (편집권한 필요)
          </p>
        </div>
        <a
          href={EDIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
        >
          새 탭에서 열기 / 편집
        </a>
      </div>

      {blocked && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-700">
          구글 보안 정책으로 화면 안 편집이 막힌 것 같습니다. 위 "새 탭에서 열기 / 편집" 버튼으로 수정하세요.
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <iframe
          title="오프라인 공급가"
          src={EMBED_URL}
          className="h-full w-full"
          style={{ border: 0 }}
          onError={() => setBlocked(true)}
        />
      </div>
    </div>
  )
}
