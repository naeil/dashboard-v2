package kr.co.highfree.event.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app")
public class EventProps {

    private String adminKey;
    private String corsOrigins;
    private List<RewardConfig> rewards;

    @Getter
    @Setter
    public static class RewardConfig {
        private String key;
        private String label;
        private int points;
        private int weight;
    }
}
