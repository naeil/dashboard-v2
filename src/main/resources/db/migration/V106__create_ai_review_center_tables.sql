-- AI 고객 인텔리전스 센터: 리뷰 관련 테이블 생성

-- 1. 리뷰 메인 테이블
CREATE TABLE IF NOT EXISTS ai_reviews (
      id BIGSERIAL PRIMARY KEY,
      review_id VARCHAR(255) NOT NULL,
      channel VARCHAR(100) NOT NULL,
      brand VARCHAR(100),
      product_name VARCHAR(500),
      option_name VARCHAR(500),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_content TEXT,
      review_date TIMESTAMP,
      review_images TEXT,
      customer_name VARCHAR(100),
      order_number VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_ai_reviews_channel_review_id UNIQUE (channel, review_id)
  );

-- 2. AI 분석 결과 테이블
CREATE TABLE IF NOT EXISTS ai_review_analyses (
      id BIGSERIAL PRIMARY KEY,
      review_id BIGINT NOT NULL REFERENCES ai_reviews(id) ON DELETE CASCADE,
      sentiment VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL',
      is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
      urgent_keywords TEXT,
      keywords TEXT,
      reply_draft TEXT,
      reply_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      analysis_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      analyzed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- 3. VOC 통계 스냅샷 테이블
CREATE TABLE IF NOT EXISTS ai_voc_snapshots (
      id BIGSERIAL PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      snapshot_date DATE NOT NULL,
      total_reviews INTEGER NOT NULL DEFAULT 0,
      avg_rating NUMERIC(3,2),
      positive_count INTEGER NOT NULL DEFAULT 0,
      neutral_count INTEGER NOT NULL DEFAULT 0,
      negative_count INTEGER NOT NULL DEFAULT 0,
      repurchase_mention_count INTEGER NOT NULL DEFAULT 0,
      keyword_stats TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_voc_snapshot_brand_date UNIQUE (brand, snapshot_date)
  );

-- 4. CEO 인사이트 테이블
CREATE TABLE IF NOT EXISTS ai_ceo_insights (
      id BIGSERIAL PRIMARY KEY,
      insight_date DATE NOT NULL,
      brand VARCHAR(100),
      insight_text TEXT NOT NULL,
      insight_type VARCHAR(50) DEFAULT 'DAILY',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_reviews_channel ON ai_reviews(channel);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_brand ON ai_reviews(brand);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_rating ON ai_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_review_date ON ai_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_ai_review_analyses_review_id ON ai_review_analyses(review_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_analyses_reply_status ON ai_review_analyses(reply_status);
CREATE INDEX IF NOT EXISTS idx_ai_review_analyses_is_urgent ON ai_review_analyses(is_urgent);
CREATE INDEX IF NOT EXISTS idx_ai_voc_snapshots_brand ON ai_voc_snapshots(brand);
CREATE INDEX IF NOT EXISTS idx_ai_ceo_insights_date ON ai_ceo_insights(insight_date);
