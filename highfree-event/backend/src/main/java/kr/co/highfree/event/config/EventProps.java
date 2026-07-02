package kr.co.highfree.event.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "app")
public class EventProps {

    private String adminKey;
    private String corsOrigins;
    private List<RewardConfig> rewards;

    public String getAdminKey() { return adminKey; }
    public void setAdminKey(String adminKey) { this.adminKey = adminKey; }

    public String getCorsOrigins() { return corsOrigins; }
    public void setCorsOrigins(String corsOrigins) { this.corsOrigins = corsOrigins; }

    public List<RewardConfig> getRewards() { return rewards; }
    public void setRewards(List<RewardConfig> rewards) { this.rewards = rewards; }

    public static class RewardConfig {
        private String key;
        private String label;
        private int points;
        private int weight;

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public int getPoints() { return points; }
        public void setPoints(int points) { this.points = points; }

        public int getWeight() { return weight; }
        public void setWeight(int weight) { this.weight = weight; }
    }
}
