import { PageHeader } from './ExecutiveComponents'
import IssueBriefingPanel from './IssueBriefingPanel'

export default function IssueBriefingPage() {
  return (
    <>
      <PageHeader
        title="실시간 이슈 브리핑"
        description="경제, 뷰티, 식품, 연예인 이슈를 국내/해외로 나누고 우리 제품, 마케팅, 영업 관점에서 한 줄로 요약합니다."
      />
      <IssueBriefingPanel />
    </>
  )
}
