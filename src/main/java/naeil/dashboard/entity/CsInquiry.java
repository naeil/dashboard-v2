package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
  @Table(name = "cs_inquiries")
  @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
  public class CsInquiry {

    @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

    @Column(name = "inq_uniq", unique = true, nullable = false, length = 50)
        private String inqUniq;  // 플레이오토 문의 고유번호

    @Column(name = "channel", length = 50)
        private String channel;  // 스마트스토어, 쿠팡 등

    @Column(name = "brand", length = 100)
        private String brand;    // 하이프리, 국민한상

    @Column(name = "inq_type", length = 50)
        private String inqType;  // 상품문의, 상품평, 긴급메세지 등

    @Column(name = "shop_sale_no", length = 50)
        private String shopSaleNo;

    @Column(name = "shop_sale_name", length = 500)
        private String shopSaleName;

    @Column(name = "shop_ord_no", length = 120)
        private String shopOrdNo;

    @Column(name = "inq_id", length = 50)
        private String inqId;    // 문의자 ID

    @Column(name = "inq_name", length = 100)
        private String inqName;  // 문의자 이름

    @Column(name = "inq_title", length = 300)
        private String inqTitle;

    @Column(name = "inq_content", columnDefinition = "TEXT")
        private String inqContent;

    @Column(name = "rating")
        private Integer rating;  // 별점 (상품평일 때)

    @Column(name = "inq_time")
        private LocalDateTime inqTime;

    @Column(name = "category", length = 50)
        private String category; // 단순감사/상품문의/배송문의/교환반품/불만클레임/기타

    @Column(name = "risk_level", length = 20)
        private String riskLevel; // AUTO(자동발송) / QUEUE(초안대기)

    @Column(name = "status", length = 30)
        @Builder.Default
        private String status = "NEW"; // NEW/REPLIED/PENDING/SENT/REJECTED

    @Column(name = "en_send_cs", length = 1)
        private String enSendCs;  // 답변 전송 가능 여부

    @Column(name = "created_at")
        private LocalDateTime createdAt;

    @Column(name = "updated_at")
        private LocalDateTime updatedAt;

    @PrePersist
        protected void onCreate() {
                  createdAt = LocalDateTime.now();
                  updatedAt = LocalDateTime.now();
        }

    @PreUpdate
        protected void onUpdate() {
                  updatedAt = LocalDateTime.now();
        }
  }
