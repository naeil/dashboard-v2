package naeil.dashboard.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import naeil.dashboard.common.api.PlayAutoApiClient;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.CollectionExecutionHistoryDto;
import naeil.dashboard.dto.IntegrationSettingDto;
import naeil.dashboard.entity.CollectionExecutionHistory;
import naeil.dashboard.entity.IntegrationSetting;
import naeil.dashboard.enums.CollectionExecutionStatus;
import naeil.dashboard.enums.CollectionJobType;
import naeil.dashboard.enums.CollectionUnit;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.CollectionExecutionHistoryRepository;
import naeil.dashboard.repository.IntegrationSettingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class IntegrationSettingService {

    private static final Duration PLAYAUTO_TOKEN_VALIDITY = Duration.ofHours(24);
    private static final Duration PLAYAUTO_REFRESH_BUFFER = Duration.ofMinutes(30);
    private static final int DEFAULT_HISTORY_LIMIT = 10;

    private final IntegrationSettingRepository settingRepository;
    private final CollectionExecutionHistoryRepository collectionExecutionHistoryRepository;
    private final PlayAutoApiClient playAutoApiClient;

    public IntegrationSettingService(
            IntegrationSettingRepository settingRepository,
            CollectionExecutionHistoryRepository collectionExecutionHistoryRepository,
            PlayAutoApiClient playAutoApiClient
    ) {
        this.settingRepository = settingRepository;
        this.collectionExecutionHistoryRepository = collectionExecutionHistoryRepository;
        this.playAutoApiClient = playAutoApiClient;
    }

    public List<IntegrationSettingDto.Response> getSettingsByCompanyId(Long companyId) {
        return settingRepository.findByCompanyId(companyId).stream()
                .map(s -> new IntegrationSettingDto.Response(
                        s.getIntegrationType(),
                        s.getApiKey(),
                        s.getApiEmail(),
                        s.getApiPassword(),
                        s.getIsActive(),
                        s.getCollectionUnit(),
                        s.getCollectionValue(),
                        s.getScheduleUnit(),
                        s.getScheduleValue(),
                        s.getAutoCollectEnabled(),
                        s.getLastCollectedAt(),
                        s.getLastOrderCollectedAt(),
                        s.getLastInventoryCollectedAt(),
                        s.getAuthUpdatedAt(),
                        s.getCollectionUpdatedAt()
                ))
                .collect(Collectors.toList());
    }

    public List<IntegrationSetting> getActivePlayAutoSettings() {
        return settingRepository.findByIntegrationTypeAndIsActiveTrue(IntegrationType.PLAYAUTO);
    }

    public List<IntegrationSetting> getAutoCollectPlayAutoSettings() {
        return settingRepository.findByIntegrationTypeAndAutoCollectEnabledTrueAndIsActiveTrue(IntegrationType.PLAYAUTO);
    }

    public List<CollectionExecutionHistoryDto> getCollectionExecutionHistory(
            Long companyId,
            IntegrationType integrationType,
            Integer limit
    ) {
        int historyLimit = limit == null || limit <= 0 ? DEFAULT_HISTORY_LIMIT : Math.min(limit, 50);
        return collectionExecutionHistoryRepository
                .findByCompanyIdAndIntegrationTypeOrderByStartedAtDesc(
                        companyId,
                        integrationType,
                        PageRequest.of(0, historyLimit)
                )
                .stream()
                .map(history -> new CollectionExecutionHistoryDto(
                        history.getId(),
                        history.getIntegrationType(),
                        history.getJobType(),
                        history.getStatus(),
                        history.getMessage(),
                        history.getStartedAt(),
                        history.getFinishedAt()
                ))
                .toList();
    }

    public boolean validateApiKey(IntegrationSettingDto.ValidateRequest request) {
        String apiKey = request.getApiKey();
        if (isBlank(apiKey)) {
            return false;
        }

        if (request.getIntegrationType() == IntegrationType.PLAYAUTO) {
            try {
                issuePlayAutoToken(apiKey, request.getEmail(), request.getPassword());
                return true;
            } catch (CustomException e) {
                return false;
            }
        }

        if (request.getIntegrationType() == IntegrationType.NAVER_SMARTSTORE
                || request.getIntegrationType() == IntegrationType.COUPANG
                || request.getIntegrationType() == IntegrationType.ELEVEN_STREET
                || request.getIntegrationType() == IntegrationType.AUCTION
                || request.getIntegrationType() == IntegrationType.GMARKET) {
            return apiKey.length() > 5;
        }

        return false;
    }

    @Transactional
    public IntegrationSettingDto.Response saveSetting(Long companyId, IntegrationSettingDto.SaveRequest request) {
        IntegrationSetting setting = settingRepository.findByCompanyIdAndIntegrationType(companyId, request.getIntegrationType())
                .orElse(new IntegrationSetting(companyId, request.getIntegrationType()));

        setting.setApiKey(request.getApiKey());
        setting.setApiEmail(request.getEmail());
        setting.setApiPassword(request.getPassword());
        setting.setAuthUpdatedAt(LocalDateTime.now());
        validateCollectionSettings(
                request.getCollectionUnit(),
                request.getCollectionValue(),
                request.getScheduleUnit(),
                request.getScheduleValue(),
                request.getAutoCollectEnabled()
        );
        applyCollectionSettings(setting, request);

        if (request.getIntegrationType() == IntegrationType.PLAYAUTO) {
            TokenIssueResult tokenIssueResult = issuePlayAutoToken(
                    request.getApiKey(),
                    request.getEmail(),
                    request.getPassword()
            );
            applyPlayAutoToken(setting, tokenIssueResult);
        }

        IntegrationSetting saved = settingRepository.save(setting);
        return new IntegrationSettingDto.Response(
                saved.getIntegrationType(),
                saved.getApiKey(),
                saved.getApiEmail(),
                saved.getApiPassword(),
                saved.getIsActive(),
                saved.getCollectionUnit(),
                saved.getCollectionValue(),
                saved.getScheduleUnit(),
                saved.getScheduleValue(),
                saved.getAutoCollectEnabled(),
                saved.getLastCollectedAt(),
                saved.getLastOrderCollectedAt(),
                saved.getLastInventoryCollectedAt(),
                saved.getAuthUpdatedAt(),
                saved.getCollectionUpdatedAt()
        );
    }

    @Transactional
    public IntegrationSettingDto.Response saveAuthSetting(Long companyId, IntegrationSettingDto.SaveAuthRequest request) {
        IntegrationSetting setting = settingRepository.findByCompanyIdAndIntegrationType(companyId, request.getIntegrationType())
                .orElse(new IntegrationSetting(companyId, request.getIntegrationType()));

        setting.setApiKey(request.getApiKey());
        setting.setApiEmail(request.getEmail());
        setting.setApiPassword(request.getPassword());
        setting.setAuthUpdatedAt(LocalDateTime.now());

        if (request.getIntegrationType() == IntegrationType.PLAYAUTO) {
            TokenIssueResult tokenIssueResult = issuePlayAutoToken(
                    request.getApiKey(),
                    request.getEmail(),
                    request.getPassword()
            );
            applyPlayAutoToken(setting, tokenIssueResult);
        }

        IntegrationSetting saved = settingRepository.save(setting);
        return toResponse(saved);
    }

    @Transactional
    public IntegrationSettingDto.Response saveCollectionSetting(Long companyId, IntegrationSettingDto.SaveCollectionRequest request) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        validateCollectionSettings(
                request.getCollectionUnit(),
                request.getCollectionValue(),
                request.getScheduleUnit(),
                request.getScheduleValue(),
                request.getAutoCollectEnabled()
        );
        applyCollectionSettings(setting, request);
        setting.setCollectionUpdatedAt(LocalDateTime.now());
        IntegrationSetting saved = settingRepository.save(setting);
        return toResponse(saved);
    }

    @Transactional
    public String refreshPlayAutoToken(Long companyId) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        TokenIssueResult tokenIssueResult = issuePlayAutoToken(
                setting.getApiKey(),
                setting.getApiEmail(),
                setting.getApiPassword()
        );
        applyPlayAutoToken(setting, tokenIssueResult);
        settingRepository.save(setting);
        return tokenIssueResult.accessToken();
    }

    @Transactional
    public PlayAutoCredentials getValidPlayAutoCredentials(Long companyId) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        if (shouldRefreshToken(setting)) {
            TokenIssueResult tokenIssueResult = issuePlayAutoToken(
                    setting.getApiKey(),
                    setting.getApiEmail(),
                    setting.getApiPassword()
            );
            applyPlayAutoToken(setting, tokenIssueResult);
            settingRepository.save(setting);
        }

        return new PlayAutoCredentials(setting.getApiKey(), setting.getAccessToken());
    }

    public CollectionWindow getPlayAutoCollectionWindow(Long companyId) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = calculateStartDate(endDate, setting.getCollectionUnit(), setting.getCollectionValue());
        return new CollectionWindow(startDate, endDate);
    }

    @Transactional
    public void markOrderCollectionCompleted(Long companyId, LocalDateTime collectedAt) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        setting.setLastOrderCollectedAt(collectedAt);
        setting.setLastCollectedAt(collectedAt);
        settingRepository.save(setting);
    }

    @Transactional
    public void markInventoryCollectionCompleted(Long companyId, LocalDateTime collectedAt) {
        IntegrationSetting setting = getPlayAutoSetting(companyId);
        setting.setLastInventoryCollectedAt(collectedAt);
        settingRepository.save(setting);
    }

    @Transactional
    public Long recordCollectionExecutionStarted(
            Long companyId,
            IntegrationType integrationType,
            CollectionJobType jobType,
            LocalDateTime startedAt,
            String message
    ) {
        CollectionExecutionHistory history = new CollectionExecutionHistory(
                companyId,
                integrationType,
                jobType,
                CollectionExecutionStatus.RUNNING,
                message,
                startedAt
        );
        return collectionExecutionHistoryRepository.save(history).getId();
    }

    @Transactional
    public void markCollectionExecutionSucceeded(Long historyId, LocalDateTime finishedAt, String message) {
        CollectionExecutionHistory history = getCollectionExecutionHistory(historyId);
        history.setStatus(CollectionExecutionStatus.SUCCESS);
        history.setFinishedAt(finishedAt);
        history.setMessage(message);
        collectionExecutionHistoryRepository.save(history);
    }

    @Transactional
    public void markCollectionExecutionFailed(Long historyId, LocalDateTime finishedAt, String message) {
        CollectionExecutionHistory history = getCollectionExecutionHistory(historyId);
        history.setStatus(CollectionExecutionStatus.FAILED);
        history.setFinishedAt(finishedAt);
        history.setMessage(message);
        collectionExecutionHistoryRepository.save(history);
    }

    private IntegrationSetting getPlayAutoSetting(Long companyId) {
        return settingRepository.findByCompanyIdAndIntegrationType(companyId, IntegrationType.PLAYAUTO)
                .orElseThrow(() -> new CustomException(404, "PlayAuto integration setting not found"));
    }

    private CollectionExecutionHistory getCollectionExecutionHistory(Long historyId) {
        return collectionExecutionHistoryRepository.findById(historyId)
                .orElseThrow(() -> new CustomException(404, "Collection execution history not found"));
    }

    private TokenIssueResult issuePlayAutoToken(String apiKey, String email, String password) {
        if (isBlank(apiKey) || isBlank(email) || isBlank(password)) {
            throw new CustomException(400, "PlayAuto API key, email, and password are required");
        }

        String accessToken = playAutoApiClient.getPlayToken(email, password, apiKey);
        if (isBlank(accessToken)) {
            throw new CustomException(502, "Failed to issue PlayAuto token");
        }

        return new TokenIssueResult(
                accessToken,
                LocalDateTime.now().plus(PLAYAUTO_TOKEN_VALIDITY)
        );
    }

    private boolean shouldRefreshToken(IntegrationSetting setting) {
        if (isBlank(setting.getAccessToken()) || setting.getTokenExpiresAt() == null) {
            return true;
        }

        LocalDateTime refreshThreshold = LocalDateTime.now().plus(PLAYAUTO_REFRESH_BUFFER);
        return !setting.getTokenExpiresAt().isAfter(refreshThreshold);
    }

    private void applyPlayAutoToken(IntegrationSetting setting, TokenIssueResult tokenIssueResult) {
        setting.setAccessToken(tokenIssueResult.accessToken());
        setting.setTokenExpiresAt(tokenIssueResult.expiresAt());
    }

    private void applyCollectionSettings(IntegrationSetting setting, IntegrationSettingDto.SaveRequest request) {
        setting.setCollectionUnit(request.getCollectionUnit());
        setting.setCollectionValue(request.getCollectionValue());
        setting.setScheduleUnit(request.getScheduleUnit());
        setting.setScheduleValue(request.getScheduleValue());
        setting.setAutoCollectEnabled(Boolean.TRUE.equals(request.getAutoCollectEnabled()));
    }

    private void applyCollectionSettings(IntegrationSetting setting, IntegrationSettingDto.SaveCollectionRequest request) {
        setting.setCollectionUnit(request.getCollectionUnit());
        setting.setCollectionValue(request.getCollectionValue());
        setting.setScheduleUnit(request.getScheduleUnit());
        setting.setScheduleValue(request.getScheduleValue());
        setting.setAutoCollectEnabled(Boolean.TRUE.equals(request.getAutoCollectEnabled()));
    }

    private void validateCollectionSettings(
            CollectionUnit collectionUnit,
            Integer collectionValue,
            CollectionUnit scheduleUnit,
            Integer scheduleValue,
            Boolean autoCollectEnabled
    ) {
        if (collectionUnit == null || collectionValue == null || collectionValue <= 0) {
            throw new CustomException(400, "Order collection period is required");
        }

        if (Boolean.TRUE.equals(autoCollectEnabled)
                && (scheduleUnit == null || scheduleValue == null || scheduleValue <= 0)) {
            throw new CustomException(400, "Order collection schedule is required when auto collection is enabled");
        }
    }

    private IntegrationSettingDto.Response toResponse(IntegrationSetting setting) {
        return new IntegrationSettingDto.Response(
                setting.getIntegrationType(),
                setting.getApiKey(),
                setting.getApiEmail(),
                setting.getApiPassword(),
                setting.getIsActive(),
                setting.getCollectionUnit(),
                setting.getCollectionValue(),
                setting.getScheduleUnit(),
                setting.getScheduleValue(),
                setting.getAutoCollectEnabled(),
                setting.getLastCollectedAt(),
                setting.getLastOrderCollectedAt(),
                setting.getLastInventoryCollectedAt(),
                setting.getAuthUpdatedAt(),
                setting.getCollectionUpdatedAt()
        );
    }

    private LocalDate calculateStartDate(LocalDate endDate, CollectionUnit unit, Integer value) {
        if (unit == null || value == null || value <= 0) {
            throw new CustomException(400, "Collection period settings are required");
        }

        return switch (unit) {
            case DAY -> endDate.minusDays(value);
            case WEEK -> endDate.minusWeeks(value);
            case MONTH -> endDate.minusMonths(value);
        };
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record PlayAutoCredentials(String apiKey, String accessToken) {}
    public record CollectionWindow(LocalDate startDate, LocalDate endDate) {}

    private record TokenIssueResult(String accessToken, LocalDateTime expiresAt) {}
}
