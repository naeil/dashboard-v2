import { authApi as api } from './authApi'

/** 대시보드 AI 비서 — 로그인 권한 범위의 실데이터 기반 질의응답 */
export const postAiChat = (message, history = []) =>
  api.post('/ai/chat', { message, history }).then((r) => r.data)
