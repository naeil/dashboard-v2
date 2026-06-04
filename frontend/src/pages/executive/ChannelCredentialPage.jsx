import { useEffect, useMemo, useState } from 'react'
import { getChannelCredentials, saveChannelCredential } from '../../api/executiveApi'
import { PageHeader, Panel } from './ExecutiveComponents'

const emptyForm = {
  category_name: '',
  account_type: '',
  login_url: '',
  username: '',
  password: '',
  password_change_note: '',
  review_username: '',
  review_password: '',
  memo: '',
  status: 'ACTIVE',
}

function normalizeUrl(value) {
  const text = String(value || '').trim()
  if (!text || text === '-' || text.includes('링크') || text.includes('각자 이메일')) return ''
  if (/^https?:\/\//i.test(text)) return text
  if (text.includes('.') && !text.includes(' ')) return `https://${text}`
  return text
}

function makeChannelId(row, index) {
  return [
    row.category_name,
    row.account_type,
    row.username,
    row.login_url,
    index,
  ].map((value) => String(value || '').trim().replace(/\s+/g, '-')).filter(Boolean).join('-').slice(0, 60) || `credential-${index}`
}

function parseBulkText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.replace(/\t/g, '').trim().match(/^[-*]*$/))

  return lines
    .map((line, index) => {
      const cols = line.split('\t').map((col) => col.trim().replace(/^"|"$/g, ''))
      if (cols.length < 4) return null
      const [category, accountType, url, username, password, passwordChange, orderOrMemo, reviewUsername, reviewPassword] = cols
      if (['대분류', '고객사', '내일바이오 온라인판매몰', '비품구매'].includes(category) && accountType === '구분') return null
      const row = {
        category_name: category || accountType || '미분류',
        account_type: accountType || '',
        login_url: normalizeUrl(url),
        username: username || '',
        password: password || '',
        password_change_note: passwordChange || '',
        review_username: reviewUsername || '',
        review_password: reviewPassword || '',
        memo: orderOrMemo && !/^\d+$/.test(orderOrMemo) ? orderOrMemo : '',
        status: 'ACTIVE',
      }
      row.channel_name = [row.category_name, row.account_type].filter(Boolean).join(' / ') || row.username || `계정 ${index + 1}`
      row.channel_id = makeChannelId(row, index + 1)
      return row
    })
    .filter((row) => row && (row.category_name || row.account_type || row.username || row.password))
}

function SecretInput({ value, onChange, canReveal = true, placeholder }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex gap-2">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
      />
      {canReveal && (
        <button type="button" onClick={() => setVisible((prev) => !prev)} className="h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-200 hover:bg-white/5">
          {visible ? '숨김' : '보기'}
        </button>
      )}
    </div>
  )
}

export default function ChannelCredentialPage({ role }) {
  const canManage = role === 'MANAGER' || role === 'EXECUTIVE'
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const response = await getChannelCredentials()
    setRows(response.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.category_name, row.account_type, row.channel_name, row.username, row.review_username, row.login_url, row.memo]
        .some((value) => String(value || '').toLowerCase().includes(needle)),
    )
  }, [query, rows])

  const selectRow = (row) => {
    setSelected(row)
    setForm({
      category_name: row.category_name || row.channel_name || '',
      account_type: row.account_type || '',
      login_url: row.login_url || '',
      username: row.username || '',
      password: row.password || '',
      password_change_note: row.password_change_note || '',
      review_username: row.review_username || '',
      review_password: row.review_password || '',
      memo: row.memo || '',
      status: row.status || 'ACTIVE',
    })
    setMessage('')
  }

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const saveOne = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        channel_id: selected?.channel_id || makeChannelId(form, Date.now()),
        channel_name: [form.category_name, form.account_type].filter(Boolean).join(' / ') || form.username || '채널 계정',
      }
      await saveChannelCredential(payload)
      setMessage('계정 정보가 암호화 저장되었습니다.')
      setSelected(null)
      setForm(emptyForm)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const importBulk = async () => {
    if (!canManage || !bulkText.trim()) return
    const parsed = parseBulkText(bulkText)
    setSaving(true)
    try {
      for (const row of parsed) {
        await saveChannelCredential(row)
      }
      setMessage(`${parsed.length}개 계정이 암호화 저장되었습니다.`)
      setBulkText('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const copy = async (value, label) => {
    if (!value) return
    await navigator.clipboard?.writeText(value)
    setMessage(`${label} 복사 완료`)
  }

  return (
    <>
      <PageHeader title="채널 계정 관리" description="채널별 아이디와 비밀번호를 관리자 전용으로 암호화 관리합니다." />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs font-black text-slate-400">등록 계정</p>
          <p className="mt-3 text-2xl font-black text-white">{rows.length}개</p>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
          <p className="text-xs font-black text-slate-400">PW 저장</p>
          <p className="mt-3 text-2xl font-black text-white">{rows.filter((row) => row.has_password).length}개</p>
        </div>
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
          <p className="text-xs font-black text-slate-400">후기용 계정</p>
          <p className="mt-3 text-2xl font-black text-white">{rows.filter((row) => row.review_username).length}개</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-xs font-black text-slate-400">권한</p>
          <p className="mt-3 text-lg font-black text-white">{canManage ? '관리자 조회/수정' : '직원 조회 제한'}</p>
        </div>
      </section>

      {canManage && (
        <Panel title="일괄 등록" right={message ? <span className="text-xs font-black text-emerald-300">{message}</span> : null}>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            rows="7"
            placeholder="엑셀/시트에서 대분류, 구분, URL, ID, PW, 비번변경, 네이버후기용ID, PW 순서로 복사해 붙여넣으세요."
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none focus:border-sky-400"
          />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={importBulk} disabled={saving || !bulkText.trim()} className="h-11 rounded-lg bg-sky-400 px-5 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400">
              {saving ? '저장 중' : '붙여넣은 계정 암호화 저장'}
            </button>
          </div>
        </Panel>
      )}

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <Panel title="계정 목록">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="채널명, ID, URL 검색"
            className="mb-4 h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
          />
          <div className="max-h-[760px] overflow-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs font-black text-slate-400">
                <tr>
                  <th className="px-3 py-3">대분류</th>
                  <th className="px-3 py-3">구분</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">PW</th>
                  <th className="px-3 py-3">후기용 ID</th>
                  <th className="px-3 py-3">URL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id || row.channel_id} onClick={() => selectRow(row)} className="cursor-pointer border-t border-white/10 text-slate-200 hover:bg-white/[0.04]">
                    <td className="px-3 py-3 font-black text-white">{row.category_name || row.channel_name}</td>
                    <td className="px-3 py-3">{row.account_type || '-'}</td>
                    <td className="px-3 py-3">{row.username || '-'}</td>
                    <td className="px-3 py-3">{row.has_password ? (canManage ? '저장됨' : '관리자 전용') : '-'}</td>
                    <td className="px-3 py-3">{row.review_username || '-'}</td>
                    <td className="px-3 py-3">
                      {row.login_url ? <a href={row.login_url} target="_blank" rel="noreferrer" className="font-bold text-sky-300 hover:underline">이동</a> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={selected ? '계정 수정' : '계정 추가'}>
          {!canManage && <p className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">비밀번호는 관리자만 볼 수 있습니다.</p>}
          <form onSubmit={saveOne} className="space-y-3">
            {[
              ['category_name', '대분류'],
              ['account_type', '구분'],
              ['login_url', 'URL'],
              ['username', 'ID'],
              ['password_change_note', '비번변경'],
              ['review_username', '네이버후기용 ID'],
              ['memo', '메모'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-black text-slate-400">{label}</span>
                <input
                  value={form[key]}
                  readOnly={!canManage}
                  onChange={(event) => setValue(key, event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400 read-only:text-slate-500"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs font-black text-slate-400">PW</span>
              <SecretInput value={canManage ? form.password : '********'} onChange={(value) => setValue('password', value)} placeholder="비워두면 기존 PW 유지" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-slate-400">네이버후기용 PW</span>
              <SecretInput value={canManage ? form.review_password : '********'} onChange={(value) => setValue('review_password', value)} placeholder="비워두면 기존 PW 유지" />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              {selected?.login_url && (
                <a href={selected.login_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg bg-sky-400 px-4 text-xs font-black text-slate-950 hover:bg-sky-300">
                  로그인 이동
                </a>
              )}
              {canManage && selected && (
                <>
                  <button type="button" onClick={() => copy(form.username, 'ID')} className="h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-200 hover:bg-white/5">ID 복사</button>
                  <button type="button" onClick={() => copy(form.password, 'PW')} className="h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-200 hover:bg-white/5">PW 복사</button>
                </>
              )}
              {canManage && (
                <button type="submit" disabled={saving} className="h-10 rounded-lg bg-emerald-300 px-4 text-xs font-black text-slate-950 hover:bg-emerald-200 disabled:opacity-60">
                  {saving ? '저장 중' : '저장'}
                </button>
              )}
            </div>
          </form>
        </Panel>
      </section>
    </>
  )
}
