package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.MailConnectRequest;
import naeil.dashboard.dto.MailItemResponse;
import naeil.dashboard.service.IntegrationCredentialService;
import naeil.dashboard.service.MailConnectionException;
import naeil.dashboard.service.MailService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mail")
@RequiredArgsConstructor
public class MailController {

    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final MailService mailService;
    private final IntegrationCredentialService credentialService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getMailStatus(
            @RequestParam(defaultValue = "false") boolean validate
    ) {
        IntegrationCredentialService.DaouMailCredentials credentials =
                credentialService.getDaouMailCredentials(DEFAULT_COMPANY_ID);
        boolean hasCredentials = StringUtils.hasText(credentials.username()) && StringUtils.hasText(credentials.password());
        if (!hasCredentials) {
            return ResponseEntity.ok(Map.of(
                    "connected", false,
                    "host", credentials.host(),
                    "username", maskUsername(credentials.username()),
                    "message", "메일 계정 연결 필요"
            ));
        }

        if (!validate) {
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "host", credentials.host(),
                    "username", maskUsername(credentials.username()),
                    "message", "메일 계정 정보가 저장되어 있습니다."
            ));
        }

        try {
            mailService.validateConnection(credentials.username(), credentials.password(), credentials.host());
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "host", credentials.host(),
                    "username", maskUsername(credentials.username()),
                    "message", "다우오피스 IMAP 연결 테스트 성공"
            ));
        } catch (MailConnectionException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "connected", false,
                    "host", credentials.host(),
                    "username", maskUsername(credentials.username()),
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/connect")
    public ResponseEntity<Map<String, String>> connectMail(@RequestBody MailConnectRequest request) {
        if (!StringUtils.hasText(request.loginId()) || !StringUtils.hasText(request.password())) {
            return ResponseEntity.badRequest().body(Map.of("message", "메일 ID와 비밀번호를 입력해주세요."));
        }
        if (!request.loginId().contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("message", "다우오피스 ID는 admin이 아니라 메일 주소 전체를 입력해주세요. 예: name@company.com"));
        }
        try {
            mailService.validateConnection(request.loginId(), request.password(), request.host());
        } catch (MailConnectionException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", e.getMessage()));
        }
        credentialService.saveDaouMailCredentials(DEFAULT_COMPANY_ID, request.host(), request.loginId(), request.password());
        return ResponseEntity.ok(Map.of("message", "메일 계정이 연결되었습니다."));
    }

    @GetMapping
    public ResponseEntity<?> getMails(
            @RequestParam(defaultValue = "inbox") String folder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        IntegrationCredentialService.DaouMailCredentials credentials =
                credentialService.getDaouMailCredentials(DEFAULT_COMPANY_ID);
        if (!StringUtils.hasText(credentials.username()) || !StringUtils.hasText(credentials.password())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "메일 계정 연결 필요"));
        }

        try {
            List<MailItemResponse> mails = mailService.getMails(
                    credentials.username(),
                    credentials.password(),
                    credentials.host(),
                    folder,
                    page,
                    size
            );
            return ResponseEntity.ok(mails);
        } catch (MailConnectionException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    private String maskUsername(String username) {
        if (!StringUtils.hasText(username)) {
            return "";
        }
        int at = username.indexOf('@');
        String head = at > 0 ? username.substring(0, at) : username;
        String domain = at > 0 ? username.substring(at) : "";
        if (head.length() <= 2) {
            return head.charAt(0) + "*" + domain;
        }
        return head.substring(0, 2) + "*".repeat(Math.max(1, head.length() - 2)) + domain;
    }
}
