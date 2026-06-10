import { buildApiUrl } from './apiBase'

const BASE = '/promotion-margin'

/** 서식 임시저장 (draft) */
export async function savePromotionForm(payload) {
  const res = await fetch(buildApiUrl(`${BASE}/forms`), {
      method: 'POST',
          headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
                  body: JSON.stringify(payload),
                    })
                      if (!res.ok) throw new Error(await res.text())
                        return res.json()
                        }

                        /** 서식 제출 → 프로모션 내역 자동 연동 */
                        export async function submitPromotionForm(formId, companyId = 1) {
                          const res = await fetch(
                              buildApiUrl(`${BASE}/forms/${formId}/submit?companyId=${companyId}`),
                                  { method: 'POST', credentials: 'include' }
                                    )
                                      if (!res.ok) throw new Error(await res.text())
                                        return res.json()
                                        }

                                        /** 서식 목록 조회 */
                                        export async function getPromotionForms(companyId = 1, channel = null) {
                                          const params = new URLSearchParams({ companyId })
                                            if (channel) params.set('channel', channel)
                                              const res = await fetch(buildApiUrl(`${BASE}/forms?${params}`), {
                                                  credentials: 'include',
                                                    })
                                                      if (!res.ok) throw new Error(await res.text())
                                                        return res.json()
                                                        }

                                                        /**
                                                         * 프로모션 내역 조회 (채널별 집계)
                                                          * channel: 'online' | 'offline' | 'export' | null(전체)
                                                           */
                                                           export async function getPromotionHistory(companyId = 1, channel = null) {
                                                             const params = new URLSearchParams({ companyId })
                                                               if (channel) params.set('channel', channel)
                                                                 const res = await fetch(buildApiUrl(`${BASE}/history?${params}`), {
                                                                     credentials: 'include',
                                                                       })
                                                                         if (!res.ok) throw new Error(await res.text())
                                                                           return res.json()
                                                                           }

                                                                           /** 실시간 실적 갱신 */
                                                                           export async function updatePromotionActuals(historyId, payload) {
                                                                             const res = await fetch(buildApiUrl(`${BASE}/history/${historyId}/actuals`), {
                                                                                 method: 'PUT',
                                                                                     headers: { 'Content-Type': 'application/json' },
                                                                                         credentials: 'include',
                                                                                             body: JSON.stringify(payload),
                                                                                               })
                                                                                                 if (!res.ok) throw new Error(await res.text())
                                                                                                   return res.json()
                                                                                                   }
