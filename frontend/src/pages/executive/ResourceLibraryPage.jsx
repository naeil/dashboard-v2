import { PageHeader, Panel } from './ExecutiveComponents'

const resources = [
  {
    title: '디자인 파일',
    source: '네이버 박스',
    description: '제품 상세, 배너, 디자인 원본 자료',
    icon: 'palette',
    tone: 'sky',
    url: 'https://mybox.naver.com/share/list?shareKey=5hFzTAP7JUi4ikY5-vixNELxp7jCXhFK3xEtHxJvWEHF9Ax17zMSWdBudLy3qavLDw%3D%3D',
  },
  {
    title: '하이프리 자료',
    source: '네이버 박스',
    description: '하이프리 브랜드 관련 자료',
    icon: 'folder_special',
    tone: 'emerald',
    url: 'https://mybox.naver.com/main/web/shared?resourceKey=YW5qZWxhMDMwNHwzNDcyNTkxNDE2MDM1MTU1MDM2fER8MTU1MjM3MDY',
  },
  {
    title: '회사 자료',
    source: '다우오피스',
    description: '사내 문서, 양식, 공용 자료실',
    icon: 'corporate_fare',
    tone: 'amber',
    url: 'https://naeilgroup.daouoffice.com/gw/app/webfolder',
  },
]

const toneMap = {
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function ResourceLibraryPage() {
  return (
    <>
      <PageHeader
        title="자료실"
        description="디자인 파일, 브랜드 자료, 사내 문서 보관함으로 바로 이동합니다. 카드를 클릭하면 새 탭에서 열립니다."
      />
      <Panel title="공용 자료 보관함">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-all hover:border-sky-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`material-symbols-outlined rounded-lg border p-2.5 text-2xl ${toneMap[item.tone] || toneMap.sky}`}>
                  {item.icon}
                </span>
                <span className="material-symbols-outlined text-slate-300 transition-colors group-hover:text-sky-500">
                  open_in_new
                </span>
              </div>
              <h3 className="mt-4 text-base font-black text-slate-950">{item.title}</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">{item.source}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{item.description}</p>
            </a>
          ))}
        </div>
      </Panel>
    </>
  )
}
