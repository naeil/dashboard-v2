package naeil.dashboard.common.config;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

public class DotEnvPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // 현재 디렉토리 기준으로 .env 탐색 (최대 3단계 상위까지)
        File envFile = findEnvFile();
        if (envFile == null) {
            return;
        }

        Map<String, Object> properties = new HashMap<>();
        try {
            for (String line : Files.readAllLines(envFile.toPath(), StandardCharsets.UTF_8)) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int idx = line.indexOf('=');
                if (idx < 0) {
                    continue;
                }
                String key = line.substring(0, idx).trim();
                String value = line.substring(idx + 1).trim();
                if (!key.isEmpty()) {
                    properties.put(key, value);
                }
            }
            if (!properties.isEmpty()) {
                environment.getPropertySources().addFirst(new MapPropertySource("dotenv", properties));
            }
        } catch (Exception ignored) {
        }
    }

    private File findEnvFile() {
        // 탐색 순서: 현재 디렉토리 → 상위 1단계 → 상위 2단계
        File dir = new File(System.getProperty("user.dir", "."));
        for (int i = 0; i < 3; i++) {
            File candidate = new File(dir, ".env");
            if (candidate.exists() && candidate.isFile()) {
                return candidate;
            }
            File parent = dir.getParentFile();
            if (parent == null) break;
            dir = parent;
        }
        return null;
    }
}
