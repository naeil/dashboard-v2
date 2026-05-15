package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "keyword_trend_logs")
public class KeywordTrendLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "keyword", nullable = false, length = 200)
    private String keyword;

    @Column(name = "channel", nullable = false, length = 20)
    private String channel;

    @Column(name = "title", columnDefinition = "TEXT")
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "link", columnDefinition = "TEXT")
    private String link;

    @Column(name = "published_at", length = 80)
    private String publishedAt;

    @Column(name = "searched_at", nullable = false)
    private LocalDateTime searchedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected KeywordTrendLog() {
    }

    public KeywordTrendLog(
            String keyword,
            String channel,
            String title,
            String description,
            String link,
            String publishedAt,
            LocalDateTime searchedAt
    ) {
        this.keyword = keyword;
        this.channel = channel;
        this.title = title;
        this.description = description;
        this.link = link;
        this.publishedAt = publishedAt;
        this.searchedAt = searchedAt;
    }
}
