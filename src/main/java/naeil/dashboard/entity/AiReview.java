package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "review_id", nullable = false)
    private String reviewId;

    @Column(name = "channel", nullable = false, length = 100)
    private String channel;

    @Column(name = "brand", length = 100)
    private String brand;

    @Column(name = "product_name", length = 500)
    private String productName;

    @Column(name = "option_name", length = 500)
    private String optionName;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "review_content", columnDefinition = "TEXT")
    private String reviewContent;

    @Column(name = "review_date")
    private LocalDateTime reviewDate;

    @Column(name = "review_images", columnDefinition = "TEXT")
    private String reviewImages;

    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "order_number", length = 255)
    private String orderNumber;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
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
