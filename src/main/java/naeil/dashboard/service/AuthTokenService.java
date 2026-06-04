package naeil.dashboard.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.config.AuthProperties;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthTokenService {

    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final AuthProperties authProperties;

    public String createToken(String username) {
        long expiresAt = Instant.now().getEpochSecond() + authProperties.tokenTtlSeconds();
        String payload = username + ":" + expiresAt;
        String signature = sign(payload);
        return URL_ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "."
                + URL_ENCODER.encodeToString(signature.getBytes(StandardCharsets.UTF_8));
    }

    public Optional<String> validateAndExtractUsername(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            return Optional.empty();
        }

        try {
            String payload = new String(URL_DECODER.decode(parts[0]), StandardCharsets.UTF_8);
            String signature = new String(URL_DECODER.decode(parts[1]), StandardCharsets.UTF_8);
            String expectedSignature = sign(payload);

            if (!MessageDigest.isEqual(
                    signature.getBytes(StandardCharsets.UTF_8),
                    expectedSignature.getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            String[] payloadParts = payload.split(":", 2);
            if (payloadParts.length != 2) {
                return Optional.empty();
            }

            long expiresAt = Long.parseLong(payloadParts[1]);
            if (Instant.now().getEpochSecond() > expiresAt) {
                return Optional.empty();
            }

            return Optional.of(payloadParts[0]);
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(authProperties.tokenSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signatureBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return URL_ENCODER.encodeToString(signatureBytes);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign auth token", exception);
        }
    }
}
