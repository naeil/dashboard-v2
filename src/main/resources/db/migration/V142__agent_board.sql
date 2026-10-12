-- V142: AI 관제실 보드 — 에이전트가 올리는 업무 현황 스냅샷(제안 메일 발송·마감·병합 대기 등)
CREATE TABLE IF NOT EXISTS agent_board (
    company_id  BIGINT NOT NULL DEFAULT 1,
    agent_name  VARCHAR(60) NOT NULL,
    board_key   VARCHAR(60) NOT NULL,
    payload     JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, agent_name, board_key)
);
