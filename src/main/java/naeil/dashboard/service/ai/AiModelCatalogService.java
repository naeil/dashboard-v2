package naeil.dashboard.service.ai;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import org.springframework.stereotype.Service;

@Service
public class AiModelCatalogService {

    private static final long DEFAULT_CACHE_SECONDS = 21600;

    private final Map<String, CachedModelOptions> cache = new ConcurrentHashMap<>();
    private final Set<String> refreshInFlight = ConcurrentHashMap.newKeySet();
    private final Clock clock;

    public AiModelCatalogService() {
        this(Clock.systemUTC());
    }

    AiModelCatalogService(Clock clock) {
        this.clock = clock;
    }

    public List<AiProviderSettingDto.ModelOption> getModels(
            AiProviderSetting setting,
            Supplier<List<AiProviderSettingDto.ModelOption>> loader
    ) {
        String cacheKey = buildCacheKey(setting);
        CachedModelOptions cached = cache.get(cacheKey);
        if (cached != null) {
            if (!cached.isExpired(now())) {
                return cached.models();
            }
            refreshAsync(cacheKey, loader);
            return cached.models();
        }

        return loadFresh(cacheKey, loader);
    }

    public void warmUpAsync(
            AiProviderSetting setting,
            Supplier<List<AiProviderSettingDto.ModelOption>> loader
    ) {
        String cacheKey = buildCacheKey(setting);
        refreshAsync(cacheKey, loader);
    }

    private List<AiProviderSettingDto.ModelOption> loadFresh(
            String cacheKey,
            Supplier<List<AiProviderSettingDto.ModelOption>> loader
    ) {
        List<AiProviderSettingDto.ModelOption> models = loader.get();
        cache.put(cacheKey, new CachedModelOptions(models, now().plusSeconds(DEFAULT_CACHE_SECONDS)));
        return models;
    }

    private void refreshAsync(
            String cacheKey,
            Supplier<List<AiProviderSettingDto.ModelOption>> loader
    ) {
        if (!refreshInFlight.add(cacheKey)) {
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                loadFresh(cacheKey, loader);
            } catch (Exception ignored) {
                // Keep serving stale cache when refresh fails.
            } finally {
                refreshInFlight.remove(cacheKey);
            }
        });
    }

    private String buildCacheKey(AiProviderSetting setting) {
        String version = setting.getUpdatedAt() == null
                ? "na"
                : String.valueOf(setting.getUpdatedAt());
        return "models:"
                + setting.getProvider().name().toLowerCase()
                + ":" + setting.getCompanyId()
                + ":" + version;
    }

    private Instant now() {
        return clock.instant();
    }

    private record CachedModelOptions(
            List<AiProviderSettingDto.ModelOption> models,
            Instant expiresAt
    ) {
        private boolean isExpired(Instant now) {
            return expiresAt.isBefore(now);
        }
    }
}
