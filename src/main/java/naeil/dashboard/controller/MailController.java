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

    @PostMapping("/connect")
    public ResponseEntity<Map<String, String>> connectMail(@RequestBody MailConnectRequest request) {
        if (!StringUtils.hasText(request.loginId()) || !StringUtils.hasText(request.password())) {
            return ResponseEntity.badRequest().body(Map.of("message", "메일 ID와 비밀번호를 입력해주세요."));
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
}
