package naeil.dashboard.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.config.AuthProperties;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    public static final String AUTHENTICATED_USERNAME_ATTR = "authenticatedUsername";

    private final AuthProperties authProperties;
    private final AuthTokenService authTokenService;

    public String login(String username, String password) {
        if (!matches(username, authProperties.username()) || !matches(password, authProperties.password())) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        return authTokenService.createToken(authProperties.username());
    }

    public Optional<String> authenticate(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = authorizationHeader.substring("Bearer ".length()).trim();
        return authTokenService.validateAndExtractUsername(token);
    }

    private boolean matches(String input, String expected) {
        if (input == null || expected == null) {
            return false;
        }

        return MessageDigest.isEqual(
                input.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
        );
    }
}
