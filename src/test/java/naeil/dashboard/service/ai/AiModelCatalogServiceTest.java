package naeil.dashboard.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import org.junit.jupiter.api.Test;

class AiModelCatalogServiceTest {

    @Test
    void returnsCachedModelsForSameProviderAndVersion() {
        MutableClock clock = new MutableClock(Instant.parse("2026-06-19T00:00:00Z"));
        AiModelCatalogService service = new AiModelCatalogService(clock);
        AiProviderSetting setting = setting(AiProvider.GEMINI, "2026-06-19T00:00:00");
        AtomicInteger calls = new AtomicInteger();

        List<AiProviderSettingDto.ModelOption> first = service.getModels(setting, () -> {
            calls.incrementAndGet();
            return List.of(new AiProviderSettingDto.ModelOption("gemini-2.5-flash", "Gemini 2.5 Flash"));
        });
        List<AiProviderSettingDto.ModelOption> second = service.getModels(setting, () -> {
            calls.incrementAndGet();
            return List.of(new AiProviderSettingDto.ModelOption("should-not-run", "Should Not Run"));
        });

        assertThat(calls.get()).isEqualTo(1);
        assertThat(second).isEqualTo(first);
    }

    @Test
    void separatesCacheByProvider() {
        MutableClock clock = new MutableClock(Instant.parse("2026-06-19T00:00:00Z"));
        AiModelCatalogService service = new AiModelCatalogService(clock);
        AtomicInteger calls = new AtomicInteger();

        List<AiProviderSettingDto.ModelOption> openAi = service.getModels(setting(AiProvider.OPENAI, "2026-06-19T00:00:00"), () -> {
            calls.incrementAndGet();
            return List.of(new AiProviderSettingDto.ModelOption("gpt-4o", "gpt-4o"));
        });
        List<AiProviderSettingDto.ModelOption> gemini = service.getModels(setting(AiProvider.GEMINI, "2026-06-19T00:00:00"), () -> {
            calls.incrementAndGet();
            return List.of(new AiProviderSettingDto.ModelOption("gemini-2.5-flash", "Gemini 2.5 Flash"));
        });

        assertThat(calls.get()).isEqualTo(2);
        assertThat(openAi).extracting(AiProviderSettingDto.ModelOption::value).containsExactly("gpt-4o");
        assertThat(gemini).extracting(AiProviderSettingDto.ModelOption::value).containsExactly("gemini-2.5-flash");
    }

    private AiProviderSetting setting(AiProvider provider, String updatedAt) {
        AiProviderSetting setting = new AiProviderSetting(1L, provider);
        try {
            java.lang.reflect.Field field = AiProviderSetting.class.getDeclaredField("updatedAt");
            field.setAccessible(true);
            field.set(setting, java.time.LocalDateTime.parse(updatedAt));
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return setting;
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
