import { useEffect, useState } from 'react'

const departmentAliases = {
    salesSupport: ['영업지원', '영업 지원', '운영', '물류', '생산', 'CS'],
    marketing: ['마케팅', '마케팅팀', '온라인MD', '온라인 MD', 'MD', '콘텐츠', '광고'],
    accounting: ['회계', '회계팀', '재무', '재무팀', '경리', '정산'],
    sales: ['영업', '영업팀', '해외영업', '수출', '컨설팅', 'B2B'],
}

export const SIDEBAR_MENU_ORDER_KEY = 'sidebar_menu_order_v1'

// group: 'executive' | 'staff' | 'system'
export const defaultMenuSections = [
    // ─── 경영진 그룹 ───────────────────────────────────────────────
  {
        id: 'strategy-finance',
        title: '전략 · 재무',
        group: 'executive',
        departments: ['executive'],
        items: [
          { id: 'ceo-dashboard', icon: 'monitoring', label: 'CEO 전략 대시보드', roles: ['EXECUTIVE'] },
          { id: 'cash-flow', icon: 'account_balance_wallet', label: '현금 흐름', roles: ['EXECUTIVE'] },
          { id: 'profit-management', icon: 'trending_up', label: 'BEP / 손익 시뮬레이션', roles: ['EXECUTIVE'] },
          { id: 'debts', icon: 'credit_score', label: '대출 / 부채', roles: ['EXECUTIVE'] },
          { id: 'operating-expenses', icon: 'receipt_long', label: '운영 비용', roles: ['EXECUTIVE'] },
              ],
  },
  {
        id: 'operations-management',
        title: '운영 · 팀관리',
        group: 'executive',
        departments: ['manager'],
        items: [
          { id: 'work-management', icon: 'assignment', label: '업무 진행 관리', roles: ['EXECUTIVE', 'MANAGER'] },
          { id: 'payment-approval', icon: 'approval', label: '입출금 결재 관리', roles: ['EXECUTIVE', 'MANAGER'] },
          { id: 'employee-performance', icon: 'analytics', label: '직원 성과 분석', roles: ['EXECUTIVE', 'MANAGER'] },
          { id: 'channel-credentials', icon: 'encrypted', label: '채널 계정 관리', roles: ['EXECUTIVE', 'MANAGER'] },
          { id: 'product-cost', icon: 'calculate', label: '제품 원가 관리', roles: ['EXECUTIVE', 'MANAGER'] },
              ],
  },
    // ─── 실무진 그룹 ───────────────────────────────────────────────
  {
        id: 'common',
        title: '공통',
        group: 'staff',
        departments: ['all'],
        items: [
          { id: 'platform', icon: 'apps', label: '업무 홈', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], emphasis: true },
          { id: 'staff-dashboard', icon: 'dashboard', label: '직원 대시보드', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'staff-work-report', icon: 'assignment_add', label: '업무 보고', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true, personalSuffix: '업무 보고' },
          { id: 'staff-project-status', icon: 'view_timeline', label: '프로젝트 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true, personalSuffix: '프로젝트 현황' },
          { id: 'brand-health', icon: 'storefront', label: '브랜드 사업 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'channel-sales', icon: 'leaderboard', label: '실시간 매출', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'work-input', icon: 'edit_note', label: '내 업무 입력', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'], personal: true },
          { id: 'payment-request', icon: 'request_page', label: '지출결의 / 기안서', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
              ],
  },
  {
        id: 'sales-support',
        title: '영업 지원',
        group: 'staff',
        departments: ['salesSupport'],
        items: [
          { id: 'channel-operations', icon: 'storefront', label: '채널 운영', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'inventory', icon: 'warehouse', label: '재고 현황', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'product-movement', icon: 'inventory', label: '제품 출입고', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'partners', icon: 'groups', label: '거래처 관리', roles: ['EXECUTIVE', 'MANAGER'] },
              ],
  },
  {
        id: 'marketing',
        title: '마케팅팀',
        group: 'staff',
        departments: ['marketing'],
        items: [
          { id: 'marketing-projects', icon: 'view_kanban', label: '마케팅 프로젝트', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'promotion-margin', icon: 'sell', label: '프로모션 마진', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'promotion-history', icon: 'receipt_long', label: '프로모션 내역', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'ad-performance', icon: 'campaign', label: '광고 성과', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'marketing-agent', icon: 'auto_awesome', label: '마케팅 에이전트', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'blog-auto-publish', icon: 'rss_feed', label: '블로그 자동 배포 AI', roles: ['EXECUTIVE', 'MANAGER'] },
              ],
  },
  {
        id: 'accounting-sales',
        title: '회계 · 영업팀',
        group: 'staff',
        departments: ['accounting', 'sales'],
        items: [
          { id: 'consulting-revenue', icon: 'business_center', label: '컨설팅 매출', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'export-pipeline', icon: 'public', label: '수출 파이프라인', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'payroll', icon: 'payments', label: '임금 지급 내역', roles: ['EXECUTIVE', 'MANAGER'] },
              ],
  },
    // ─── 시스템 ────────────────────────────────────────────────────
  {
        id: 'system',
        title: '시스템',
        group: 'system',
        departments: ['all'],
        items: [
          { id: 'account', icon: 'account_circle', label: '내 계정', roles: ['EXECUTIVE', 'MANAGER', 'EMPLOYEE'] },
          { id: 'employees', icon: 'manage_accounts', label: '직원 관리', roles: ['EXECUTIVE'] },
          { id: 'attendance-admin', icon: 'badge', label: '출퇴근 기록', roles: ['EXECUTIVE'] },
          { id: 'menu-order-settings', icon: 'swap_vert', label: '카테고리 이동', roles: ['EXECUTIVE'] },
          { id: 'settings', icon: 'settings', label: '설정', roles: ['EXECUTIVE'] },
              ],
  },
  ]
