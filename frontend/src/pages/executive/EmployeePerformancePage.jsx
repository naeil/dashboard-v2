import { useEffect, useMemo, useState } from 'react'
import { getUsers } from '../../api/authApi'
import { getExecutiveWorkTasks } from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import { count } from './formatters'
import { isTaskDelayed, taskProgress, taskStatusClass, taskStatusLabels } from './workTaskUtils'

function scoreEmployee(row) {
  const completionScore = row.completionRate * 0.35
  const progressScore = row.avgProgress * 0.35
  const riskPenalty = Math.min(35, row.delayed * 10 + row.blocked * 12)
  const reviewBonus = Math.min(10, row.review * 3)
  return Math.max(0, Math.min(100, Math.round(completionScore + progressScore + reviewBonus - riskPenalty + 20)))
}

function findStrength(row) {
  if (row.done >= 3 && row.delayed === 0) return '마감 관리와 완료율이 좋습니다.'
  if (row.avgProgress >= 80) return '업무 추진 속도가 빠릅니다.'
  if (row.review >= 2) return '검토 요청을 통해 업무를 닫는 습관이 있습니다.'
  const topCategory = row.topCategory || '주요 업무'
  return `${topCategory} 업무 경험이 누적되고 있습니다.`
}

function findWeakness(row) {
  if (row.blocked > 0) return '막힌 이슈를 더 빨리 공유해야 합니다.'
  if (row.delayed > 0) return '마감 지연 업무를 줄이는 관리가 필요합니다.'
  if (row.avgProgress < 45) return '진행률 업데이트와 실행 속도 점검이 필요합니다.'
  if (row.active > 5) return '진행 업무가 많아 우선순위 조정이 필요합니다.'
  return '현재 큰 약점 신호는 낮습니다.'
}

function GradePill({ score }) {
  const grade = score >= 85 ? '우수' : score >= 70 ? '양호' : score >= 55 ? '주의' : '위험'
  const className = score >= 85
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    : score >= 70
      ? 'border-sky-400/30 bg-sky-400/15 text-sky-100'
      : score >= 55
        ? 'border-amber-400/30 bg-amber-400/15 text-amber-100'
        : 'border-rose-400/30 bg-rose-400/15 text-rose-100'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>{grade}</span>
}

function ProgressBar({ value }) {
  const color = value >= 80 ? 'bg-emerald-300' : value >= 60 ? 'bg-sky-300' : value >= 40 ? 'bg-amber-300' : 'bg-rose-300'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export default function EmployeePerformancePage() {
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [selected, setSelected] = useState('전체')

  const load = async () => {
    const [userRes, taskRes] = await Promise.all([getUsers(), getExecutiveWorkTasks()])
    setUsers(userRes.data || [])
    setTasks(taskRes.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const employeeRows = useMemo(() => {
    const grouped = new Map()
    const activeUsers = users.filter((user) => ['EMPLOYEE', 'MANAGER'].includes(user.role))
    activeUsers.forEach((user) => {
      grouped.set(user.username, {
        username: user.username,
        displayName: user.display_name || user.username,
        department: user.department || '-',
        positionName: user.position_name || '-',
        role: user.role,
        total: 0,
        active: 0,
        done: 0,
        delayed: 0,
        blocked: 0,
        review: 0,
        progressSum: 0,
        categories: new Map(),
      })
    })

    tasks.forEach((task) => {
      const username = task.assignee_name || '미지정'
      const row = grouped.get(username) || {
        username,
        displayName: username,
        department: task.department || '-',
        positionName: '-',
        role: 'EMPLOYEE',
        total: 0,
        active: 0,
        done: 0,
        delayed: 0,
        blocked: 0,
        review: 0,
        progressSum: 0,
        categories: new Map(),
      }
      row.total += 1
      row.progressSum += taskProgress(task)
      if (task.status === 'DONE') row.done += 1
      else row.active += 1
      if (isTaskDelayed(task)) row.delayed += 1
      if (task.status === 'BLOCKED') row.blocked += 1
      if (task.status === 'REVIEW' || task.approval_required) row.review += 1
      const category = task.work_category || '기타'
      row.categories.set(category, (row.categories.get(category) || 0) + 1)
      grouped.set(username, row)
    })

    return Array.from(grouped.values())
      .map((row) => {
        const topCategory = Array.from(row.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
        const avgProgress = row.total ? Math.round(row.progressSum / row.total) : 0
        const completionRate = row.total ? Math.round((row.done / row.total) * 100) : 0
        const enriched = { ...row, topCategory, avgProgress, completionRate }
        const score = scoreEmployee(enriched)
        return {
          ...enriched,
          score,
          strength: findStrength(enriched),
          weakness: findWeakness(enriched),
        }
      })
      .sort((a, b) => b.score - a.score || b.delayed - a.delayed)
  }, [users, tasks])

  const filteredRows = selected === '전체'
    ? employeeRows
    : employeeRows.filter((row) => row.username === selected)
  const selectedTasks = selected === '전체'
    ? tasks
    : tasks.filter((task) => task.assignee_name === selected)
  const riskTasks = selectedTasks
    .filter((task) => isTaskDelayed(task) || task.status === 'BLOCKED' || task.status === 'REVIEW' || task.approval_required)
    .slice(0, 12)

  const totalScore = employeeRows.length
    ? Math.round(employeeRows.reduce((sum, row) => sum + row.score, 0) / employeeRows.length)
    : 0

  return (
    <>
      <PageHeader title="직원 성과 분석" description="대표가 직원별 업무 현황, 강점, 약점, 병목을 한 화면에서 판단합니다." />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
          <p className="text-xs font-black text-slate-400">평균 업무 점수</p>
          <p className="mt-3 text-2xl font-black text-white">{totalScore}점</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs font-black text-slate-400">분석 직원</p>
          <p className="mt-3 text-2xl font-black text-white">{count(employeeRows.length, '명')}</p>
        </article>
        <article className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-5">
          <p className="text-xs font-black text-slate-400">지연/막힘</p>
          <p className="mt-3 text-2xl font-black text-white">{count(tasks.filter((task) => isTaskDelayed(task) || task.status === 'BLOCKED').length, '건')}</p>
        </article>
        <article className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-xs font-black text-slate-400">검토 대기</p>
          <p className="mt-3 text-2xl font-black text-white">{count(tasks.filter((task) => task.status === 'REVIEW' || task.approval_required).length, '건')}</p>
        </article>
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-4">
        {['전체', ...employeeRows.map((row) => row.username)].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSelected(name)}
            className={`h-10 rounded-lg border px-4 text-sm font-black ${selected === name ? 'border-sky-400/40 bg-sky-400/15 text-sky-100' : 'border-white/10 bg-slate-950 text-slate-400 hover:bg-white/5'}`}
          >
            {name === '전체' ? '전체' : employeeRows.find((row) => row.username === name)?.displayName || name}
          </button>
        ))}
      </div>

      <Panel title="직원별 강점 / 약점">
        <DataTable
          rows={filteredRows}
          rowKey={(row) => row.username}
          columns={[
            { key: 'displayName', label: '직원', render: (row) => <span className="font-black text-white">{row.displayName}</span> },
            { key: 'department', label: '부서' },
            { key: 'score', label: '평가', render: (row) => <div className="flex items-center gap-2"><GradePill score={row.score} /><span className="font-black text-white">{row.score}점</span></div> },
            { key: 'completionRate', label: '완료율', render: (row) => `${row.completionRate}%` },
            { key: 'avgProgress', label: '진행률', render: (row) => <div className="min-w-28"><p className="mb-1 text-xs font-black text-slate-300">{row.avgProgress}%</p><ProgressBar value={row.avgProgress} /></div> },
            { key: 'active', label: '진행', render: (row) => count(row.active, '건') },
            { key: 'delayed', label: '지연', render: (row) => <span className={row.delayed > 0 ? 'font-black text-rose-200' : ''}>{count(row.delayed, '건')}</span> },
            { key: 'blocked', label: '막힘', render: (row) => <span className={row.blocked > 0 ? 'font-black text-rose-200' : ''}>{count(row.blocked, '건')}</span> },
            { key: 'topCategory', label: '강한 영역', render: (row) => row.topCategory || '-' },
            { key: 'strength', label: '강점' },
            { key: 'weakness', label: '보완점' },
          ]}
        />
      </Panel>

      <div className="mt-6">
        <Panel title="대표 확인 필요 업무">
          <DataTable
            rows={riskTasks}
            rowKey={(row) => row.id}
            columns={[
              { key: 'task_name', label: '업무', render: (row) => <span className="font-black text-white">{row.task_name}</span> },
              { key: 'project_name', label: '프로젝트' },
              { key: 'assignee_name', label: '담당자' },
              { key: 'status', label: '상태', render: (row) => <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${taskStatusClass(row.status)}`}>{taskStatusLabels[row.status] || row.status}</span> },
              { key: 'due_date', label: '마감일' },
              { key: 'blocker_text', label: '막힌 이슈', render: (row) => row.blocker_text || '-' },
              { key: 'next_action', label: '다음 액션', render: (row) => row.next_action || '-' },
            ]}
          />
        </Panel>
      </div>
    </>
  )
}
