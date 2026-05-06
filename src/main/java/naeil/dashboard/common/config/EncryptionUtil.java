package naeil.dashboard.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Component
public class EncryptionUtil {

    private static final String LEGACY_ALGORITHM = "AES";
    private static final String GCM_ALGORITHM = "AES/GCM/NoPadding";
    private static final String CIPHERTEXT_PREFIX = "v2:";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int GCM_IV_LENGTH_BYTES = 12;

    @Value("${app.encryption.secret-key}")
    private String secretKeyString;

    private static SecretKeySpec secretKey;
    private static final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    public void init() {
        if (secretKeyString == null || secretKeyString.length() < 32) {
            throw new IllegalArgumentException("Encryption secret key must be at least 32 characters long.");
        }

        byte[] keyBytes = new byte[32];
        byte[] originalBytes = secretKeyString.getBytes(StandardCharsets.UTF_8);
        System.arraycopy(originalBytes, 0, keyBytes, 0, Math.min(originalBytes.length, 32));
        secretKey = new SecretKeySpec(keyBytes, LEGACY_ALGORITHM);
    }

    public static String encrypt(String rawValue) {
        if (rawValue == null) {
            return null;
        }

        try {
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(GCM_ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            byte[] encryptedData = cipher.doFinal(rawValue.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + encryptedData.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encryptedData, 0, combined, iv.length, encryptedData.length);

            return CIPHERTEXT_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting value", e);
        }
    }

    public static String decrypt(String encryptedValue) {
        if (encryptedValue == null) {
            return null;
        }

        try {
            if (encryptedValue.startsWith(CIPHERTEXT_PREFIX)) {
                return decryptGcm(encryptedValue.substring(CIPHERTEXT_PREFIX.length()));
            }

            return decryptLegacy(encryptedValue);
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting value", e);
        }
    }

    private static String decryptGcm(String encryptedValue) throws Exception {
        byte[] decodedData = Base64.getDecoder().decode(encryptedValue);
        byte[] iv = Arrays.copyOfRange(decodedData, 0, GCM_IV_LENGTH_BYTES);
        byte[] cipherText = Arrays.copyOfRange(decodedData, GCM_IV_LENGTH_BYTES, decodedData.length);

        Cipher cipher = Cipher.getInstance(GCM_ALGORITHM);
        GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    private static String decryptLegacy(String encryptedValue) throws Exception {
        Cipher cipher = Cipher.getInstance(LEGACY_ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, secretKey);
        byte[] decodedData = Base64.getDecoder().decode(encryptedValue);
        return new String(cipher.doFinal(decodedData), StandardCharsets.UTF_8);
    }
}
