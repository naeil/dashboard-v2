package naeil.dashboard.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import naeil.dashboard.common.config.DaouProperties;
import naeil.dashboard.dto.MailItemResponse;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 다우오피스 메일 서비스 (REST API 방식)
 *
 * 기존 IMAP(포트 993) 방식에서 다우오피스 REST API 방식으로 전환.
 * IMAP은 방화벽/외부 서버(Render 등)에서 포트가 차단되어 연결 불가.
 * HTTPS REST API(443)를 사용하면 방화벽 우회 가능.
 *
 * ── 필요 환경변수 ──────────────────────────────────────────────────────────
 * [공통 - 개발/배포 모두 설정 필요]
 *   DAOU_BASE_URL      = https://api.daouoffice.com  (기본값, 생략 가능)
 *   DAOU_CLIENT_ID     = 다우오피스 OAuth2 Client ID
 *   DAOU_CLIENT_SECRET = 다우오피스 OAuth2 Client Secret
 *
 * [로컬 개발: src/main/resources/.env 또는 application-local.properties]
 *   daou.client-id=YOUR_CLIENT_ID
 *   daou.client-secret=YOUR_CLIENT_SECRET
 *
 * [Render 배포: Dashboard > naeil-dashboard > Environment > Add Variable]
 *   Key: DAOU_CLIENT_ID    Value: YOUR_CLIENT_ID
 *   Key: DAOU_CLIENT_SECRET Value: YOUR_CLIENT_SECRET
 * ──────────────────────────────────────────────────────────────────────────
 */
@Service
public class MailService {

    private static final int PREVIEW_LENGTH = 100;
    private static final String MAIL_LIST_PATH = "/mail/v3/mailboxes/{mailbox}/mails";

    private final RestTemplate restTemplate;
    private final DaouProperties daouProperties;
    private final DaouAuthService daouAuthService;

    public MailService(RestTemplate restTemplate,
                       DaouProperties daouProperties,
                       DaouAuthService daouAuthService) {
        this.restTemplate = restTemplate;
        this.daouProperties = daouProperties;
        this.daouAuthService = daouAuthService;
    }

    // ── 메일 목록 조회 ─────────────────────────────────────────────────────

    public List<MailItemResponse> getMails(String loginId, String password, int page, int size) {
        return getMails(loginId, password, "inbox", page, size);
    }

    public List<MailItemResponse> getMails(String loginId, String password,
                                           String folderType, int page, int size) {
        return getMails(loginId, password,
                daouProperties.resolvedBaseUrl(), folderType, page, size);
    }

    /**
     * 다우오피스 REST API로 메일 목록 조회.
     * loginId/password 는 하위 호환 파라미터 (인증은 OAuth2 Access Token 사용).
     */
    public List<MailItemResponse> getMails(String loginId, String password,
                                           String baseUrlOrHost, String folderType,
                                           int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);

        String mailbox     = resolveMailbox(folderType);
        String accessToken = obtainAccessToken(loginId, password);

        String url = UriComponentsBuilder
                .fromHttpUrl(daouProperties.resolvedBaseUrl() + MAIL_LIST_PATH)
                .queryParam("page", safePage + 1)
                .queryParam("pageSize", safeSize)
                .buildAndExpand(mailbox)
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET,
                    new HttpEntity<>(headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            Map<String, Object> body = response.getBody();
            return body == null ? List.of() : parseMails(body);

        } catch (HttpClientErrorException.Unauthorized e) {
            daouAuthService.clearCachedAccessToken();
            throw new MailConnectionException(
                    "다우오피스 인증이 만료되었습니다. 잠시 후 다시 시도해주세요. (401)", e);
        } catch (HttpClientErrorException e) {
            throw new MailConnectionException(
                    "다우오피스 메일 API 오류 [" + e.getStatusCode().value()
                    + "]: " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new MailConnectionException(
                    "다우오피스 API 서버 연결 실패. 네트워크/방화벽 또는 API URL 설정을 확인해주세요."
                    + " (" + e.getMessage() + ")", e);
        } catch (RestClientException e) {
            throw new MailConnectionException(
                    "다우오피스 메일 API 호출 오류: " + e.getMessage(), e);
        }
    }

    // ── 연결 검증 ─────────────────────────────────────────────────────────

    public void validateConnection(String loginId, String password) {
        validateConnection(loginId, password, daouProperties.resolvedBaseUrl());
    }

    /**
     * Access Token 발급 성공 여부로 연결 유효성 검증.
     * IMAP 포트 직접 연결 대신 HTTPS REST API를 사용하므로 방화벽 영향 없음.
     */
    public void validateConnection(String loginId, String password, String hostOrBaseUrl) {
        obtainAccessToken(loginId, password);
    }

    // ── 내부 헬퍼 ─────────────────────────────────────────────────────────

    /**
     * OAuth2 Access Token을 발급합니다.
     * 실패 시 환경변수 설정 방법을 안내하는 구체적인 에러 메시지 반환.
     */
    private String obtainAccessToken(String loginId, String password) {
        try {
            return daouAuthService.issueAccessToken();
        } catch (Exception e) {
            String loginHint = (loginId != null && !loginId.isBlank())
                    ? " (로그인 계정: " + loginId + ")" : "";
            throw new MailConnectionException(
                    "다우오피스 API 인증 실패" + loginHint
                    + ". 환경변수 DAOU_CLIENT_ID / DAOU_CLIENT_SECRET 를 확인해주세요."
                    + " [로컬: .env 또는 application.properties, Render: Environment 탭]"
                    + " 원인: " + e.getMessage(), e);
        }
    }

    private String resolveMailbox(String folderType) {
        if (folderType == null) return "inbox";
        return switch (folderType.toLowerCase()) {
            case "sent", "sent messages", "보낸편지함", "보낸 메일함" -> "sent";
            case "trash", "deleted", "휴지통"                        -> "trash";
            case "spam", "junk", "스팸"                              -> "spam";
            default                                                  -> "inbox";
        };
    }

    @SuppressWarnings("unchecked")
    private List<MailItemResponse> parseMails(Map<String, Object> body) {
        Object rawMails = body.get("mails");
        if (!(rawMails instanceof List<?> list)) return List.of();

        List<MailItemResponse> result = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> rawMap)) continue;
            Map<String, Object> mail = (Map<String, Object>) rawMap;

            String subject = asStr(mail.get("subject"),  "(제목 없음)");
            String from    = asStr(mail.get("from"),     "");
            boolean isRead = Boolean.TRUE.equals(mail.get("isRead"));
            String content = asStr(mail.get("content"),  asStr(mail.get("body"), ""));
            String preview = content.length() > PREVIEW_LENGTH
                             ? content.substring(0, PREVIEW_LENGTH) + "…"
                             : content;
            Instant date   = parseInstant(mail.get("receivedDate"));

            result.add(new MailItemResponse(subject, from, date, isRead, preview));
        }

        result.sort((a, b) -> {
            if (a.receivedDate() == null && b.receivedDate() == null) return 0;
            if (a.receivedDate() == null) return 1;
            if (b.receivedDate() == null) return -1;
            return b.receivedDate().compareTo(a.receivedDate());
        });
        return Collections.unmodifiableList(result);
    }

    private String asStr(Object v, String def) {
        if (v == null) return def;
        String s = v.toString().trim();
        return s.isEmpty() ? def : s;
    }

    private Instant parseInstant(Object v) {
        if (v == null) return null;
        try {
            if (v instanceof Number n) return Instant.ofEpochMilli(n.longValue());
            return Instant.parse(v.toString());
        } catch (Exception ignored) {
            return null;
        }
    }
        }
