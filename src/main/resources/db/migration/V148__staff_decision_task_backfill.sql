-- 관제실 '실무진 판단'이 이미 내려진 거래처의 AI 배정 업무 상태를 1회 맞춘다 (이후는 StaffDecisionService.syncTasks 가 처리)
-- 승인·진행 중 → IN_PROGRESS / 보류 → BLOCKED / 거절 → DONE
WITH d AS (
    SELECT DISTINCT ON (company_id, item_key)
           company_id, status, reason, decided_by, partner_email,
           TRIM(CASE WHEN POSITION('|' IN partner_name) > 0
                     THEN SUBSTRING(partner_name FROM POSITION('|' IN partner_name) + 1)
                     ELSE partner_name END) AS name
    FROM staff_decision
    ORDER BY company_id, item_key, decided_at DESC
)
UPDATE executive_work_task t
SET status = CASE d.status WHEN 'REJECTED' THEN 'DONE' WHEN 'HOLD' THEN 'BLOCKED' ELSE 'IN_PROGRESS' END,
    progress_rate = CASE WHEN d.status = 'REJECTED' THEN 100 ELSE GREATEST(t.progress_rate, 10) END,
    completed_date = CASE WHEN d.status = 'REJECTED' THEN CURRENT_DATE ELSE t.completed_date END,
    blocker_text = CASE WHEN d.status = 'HOLD' THEN d.reason ELSE t.blocker_text END,
    review_comment = CONCAT_WS(E'\n', t.review_comment, '[실무진 판단 반영 · ' || COALESCE(d.decided_by, '-') || ']'),
    updated_at = NOW()
FROM d
WHERE t.company_id = d.company_id
  AND t.status NOT IN ('DONE', 'CANCELLED')
  AND t.source_type IN ('AI_AGENT', 'AI_DIRECTIVE')
  AND (STRPOS(LOWER(t.task_name), LOWER('] ' || d.name)) > 0
       OR (COALESCE(d.partner_email, '') <> '' AND STRPOS(LOWER(COALESCE(t.next_action, '')), LOWER(d.partner_email)) > 0));
