import { useCallback, useEffect, useRef, useState } from 'react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/paymentApprovalApi'

const typeStyle = {
  PAYMENT_APPROVAL_REQUEST: { icon: 'approval', cls: 'text-sky-600 bg-sky-50' },
  PAYMENT_APPROVED: { icon: 'check_circle', cls: 'text-emerald-600 bg-emerald-50' },
  PAYMENT_REJECTED: { icon: 'cancel', cls: 'text-rose-600 bg-rose-50' },
  PAYMENT_COOPERATION_REQUEST: { icon: 'handshake', cls: 'text-indigo-600 bg-indigo-50' },
  PAYMENT_COOPERATED: { icon: 'handshake', cls: 'text-emerald-600 bg-emerald-50' },
  PAYMENT_REFERENCE: { icon: 'visibility', cls: 'text-slate-500 bg-slate-100' },
}
const timeAgo = (ts) => {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const load = useCallback(() => {
    getNotifications()
      .then((d) => { setItems(d.items || []); setUnread(d.unread || 0) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!open) return undefined
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  const openItem = async (n) => {
    try { if (!n.is_read) { await markNotificationRead(n.id); load() } } catch { /* noop */ }
    setOpen(false)
    if (n.link_page && onNavigate) onNavigate(n.link_page)
  }
  const readAll = async () => { try { await markAllNotificationsRead(); load() } catch { /* noop */ } }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen((v) => !v); if (!open) load() }}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-black text-slate-800">알림 {unread > 0 && <span className="text-rose-500">{unread}</span>}</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-[11px] font-bold text-sky-600 hover:underline">모두 읽음</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-slate-400">새 알림이 없습니다.</p>
            ) : (
              items.map((n) => {
                const st = typeStyle[n.type] || { icon: 'notifications', cls: 'text-slate-500 bg-slate-50' }
                return (
                  <button type="button" key={n.id} onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${n.is_read ? '' : 'bg-sky-50/40'}`}>
                    <span className={`material-symbols-outlined mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] ${st.cls}`}>{st.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black text-slate-800">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[12px] text-slate-500">{n.body}</span>}
                      <span className="mt-1 block text-[11px] font-bold text-slate-400">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
