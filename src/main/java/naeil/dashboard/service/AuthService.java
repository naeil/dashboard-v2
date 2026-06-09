package naeil.dashboard.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.config.AuthProperties;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.ChangePasswordRequest;
import naeil.dashboard.dto.InviteCreateRequest;
import naeil.dashboard.dto.RegisterRequest;
import naeil.dashboard.dto.ResetPasswordRequest;
import naeil.dashboard.dto.UserRole;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    public static final String AUTHENTICATED_USERNAME_ATTR = "authenticatedUsername";
    public static final String AUTHENTICATED_ROLE_ATTR = "authenticatedRole";
    public static final String AUTHENTICATED_USER_ATTR = "authenticatedUser";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HASH_ITERATIONS = 120_000;
    private static final int HASH_BITS = 256;

    private final AuthProperties authProperties;
    private final AuthTokenService authTokenService;
    private final JdbcTemplate jdbcTemplate;

    public AuthUser login(String username, String password) {
        AuthUser user = findUser(username).orElseGet(() -> tryCreateBootstrapExecutive(username, password));
        if (!"ACTIVE".equals(user.status())) {
            throw new CustomException(403, "비활성화된 계정입니다. 관리자에게 문의하세요.");
        }

        String passwordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM dashboard_user WHERE username = ?",
                String.class,
                username
        );
        if (!verifyPassword(password, passwordHash)) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        jdbcTemplate.update("UPDATE dashboard_user SET last_login_at = NOW(), updated_at = NOW() WHERE username = ?", username);
        return user;
    }

    public String createToken(AuthUser user) {
        return authTokenService.createToken(user.username());
    }

    public Optional<AuthUser> authenticate(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = authorizationHeader.substring("Bearer ".length()).trim();
        return authTokenService.validateAndExtractUsername(token)
                .flatMap(this::findActiveUser);
    }

    public List<Map<String, Object>> listUsers() {
        return jdbcTemplate.queryForList("""
                SELECT id, username, display_name, department, position_name, role, status, email, allowed_menu_sections, last_login_at, created_at
                FROM dashboard_user
                ORDER BY created_at DESC
                """);
    }

    public List<Map<String, Object>> listInvites() {
        expireOldInvites();
        return jdbcTemplate.queryForList("""
                SELECT id, invite_code, display_name, department, position_name, role, status, invited_by,
                       accepted_by, expires_at, accepted_at, created_at
                FROM dashboard_user_invite
                ORDER BY created_at DESC
                """);
    }

    public Map<String, Object> previewInvite(String inviteCode) {
        String normalizedCode = required(inviteCode, "초대 코드를 입력하세요.").trim().toUpperCase();
        Map<String, Object> invite = findPendingInvite(normalizedCode)
                .orElseThrow(() -> new CustomException(400, "유효하지 않거나 만료된 초대 코드입니다."));
        return Map.of(
                "inviteCode", invite.get("invite_code"),
                "displayName", invite.get("display_name"),
                "department", invite.get("department") != null ? invite.get("department") : "",
                "positionName", invite.get("position_name") != null ? invite.get("position_name") : "",
                "role", invite.get("role")
        );
    }

    public Map<String, Object> createInvite(InviteCreateRequest request, AuthUser actor) {
        requireManagerOrExecutive(actor);
        String role = normalizeInviteRole(request.role(), actor);
        String code = createInviteCode();
        String displayName = required(request.displayName(), "직원 이름을 입력하세요.");

        jdbcTemplate.update("""
                INSERT INTO dashboard_user_invite (
                    company_id, invite_code, display_name, department, position_name, role, status,
                    invited_by, expires_at
                )
                VALUES (1, ?, ?, ?, ?, ?, 'PENDING', ?, NOW() + INTERVAL '7 days')
                """, code, displayName, blankToNull(request.department()), blankToNull(request.positionName()),
                role, actor.username());

        return Map.of(
                "inviteCode", code,
                "displayName", displayName,
                "role", role,
                "expiresInDays", 7
        );
    }

    public void changePassword(ChangePasswordRequest request, AuthUser actor) {
        String currentPassword = required(request.currentPassword(), "현재 비밀번호를 입력하세요.");
        String newPassword = validateNewPassword(request.newPassword());
        String passwordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM dashboard_user WHERE id = ?",
                String.class,
                actor.id()
        );

        if (!verifyPassword(currentPassword, passwordHash)) {
            throw new CustomException(401, "현재 비밀번호가 올바르지 않습니다.");
        }

        jdbcTemplate.update(
                "UPDATE dashboard_user SET password_hash = ?, updated_at = NOW() WHERE id = ?",
                hashPassword(newPassword),
                actor.id()
        );
    }

    public void resetPassword(Long userId, ResetPasswordRequest request, AuthUser actor) {
        requireRole(actor, UserRole.EXECUTIVE);
        String newPassword = validateNewPassword(request.newPassword());
        int updated = jdbcTemplate.update(
                "UPDATE dashboard_user SET password_hash = ?, updated_at = NOW() WHERE id = ?",
                hashPassword(newPassword),
                userId
        );
        if (updated == 0) {
            throw new CustomException(404, "계정을 찾을 수 없습니다.");
        }
    }

    public void deleteUser(Long userId, AuthUser actor) {
        requireRole(actor, UserRole.EXECUTIVE);
        if (actor.id().equals(userId)) {
            throw new CustomException(400, "본인 계정은 삭제할 수 없습니다.");
        }

        Map<String, Object> target;
        try {
            target = jdbcTemplate.queryForMap("""
                    SELECT id, role, status
                    FROM dashboard_user
                    WHERE id = ?
                    """, userId);
        } catch (EmptyResultDataAccessException exception) {
            throw new CustomException(404, "계정을 찾을 수 없습니다.");
        }

        if (UserRole.from(String.valueOf(target.get("role"))) == UserRole.EXECUTIVE) {
            throw new CustomException(400, "대표 관리자 계정은 삭제할 수 없습니다.");
        }
        if ("LEFT".equals(String.valueOf(target.get("status")))) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE dashboard_user
                SET status = 'LEFT', allowed_menu_sections = NULL, updated_at = NOW()
                WHERE id = ?
                """, userId);
    }

    @Transactional
    public AuthUser register(RegisterRequest request) {
        String inviteCode = required(request.inviteCode(), "초대 코드를 입력하세요.").trim().toUpperCase();
        String username = required(request.username(), "아이디를 입력하세요.").trim();
        String password = required(request.password(), "비밀번호를 입력하세요.");
        if (password.length() < 8) {
            throw new CustomException(400, "비밀번호는 8자 이상이어야 합니다.");
        }
        if (findUser(username).isPresent()) {
            throw new CustomException(409, "이미 사용 중인 아이디입니다.");
        }

        Map<String, Object> invite = findPendingInvite(inviteCode)
                .orElseThrow(() -> new CustomException(400, "유효하지 않거나 만료된 초대 코드입니다."));
        String passwordHash = hashPassword(password);

        jdbcTemplate.update("""
                INSERT INTO dashboard_user (
                    company_id, username, display_name, department, position_name, role, password_hash, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
                """,
                ((Number) invite.get("company_id")).longValue(),
                username,
                invite.get("display_name"),
                invite.get("department"),
                invite.get("position_name"),
                invite.get("role"),
                passwordHash
        );

        jdbcTemplate.update("""
                UPDATE dashboard_user_invite
                SET status = 'ACCEPTED', accepted_by = ?, accepted_at = NOW(), updated_at = NOW()
                WHERE id = ?
                """, username, ((Number) invite.get("id")).longValue());

        return findUser(username).orElseThrow();
    }

    public void requireRole(AuthUser user, UserRole minimumRole) {
        int current = roleRank(UserRole.from(user.role()));
        int required = roleRank(minimumRole);
        if (current < required) {
            throw new CustomException(403, "접근 권한이 없습니다.");
        }
    }

    private AuthUser tryCreateBootstrapExecutive(String username, String password) {
        if (!matches(username, authProperties.username()) || !matches(password, authProperties.password())) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        String passwordHash = hashPassword(password);
        jdbcTemplate.update("""
                INSERT INTO dashboard_user (
                    company_id, username, display_name, department, position_name, role, password_hash, status
                )
                VALUES (1, ?, '대표 관리자', '경영', '대표', 'EXECUTIVE', ?, 'ACTIVE')
                ON CONFLICT (username) DO NOTHING
                """, username, passwordHash);
        return findUser(username).orElseThrow();
    }

    private Optional<AuthUser> findActiveUser(String username) {
        return findUser(username).filter(user -> "ACTIVE".equals(user.status()));
    }

    public void updateMenuPermissions(Long userId, String sectionsJson) {
        jdbcTemplate.update(
                "UPDATE dashboard_user SET allowed_menu_sections = ?, updated_at = NOW() WHERE id = ?",
                sectionsJson, userId);
    }

    private Optional<AuthUser> findUser(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT id, company_id, username, display_name, department, position_name, role, status, allowed_menu_sections
                    FROM dashboard_user
                    WHERE username = ?
                    """, (rs, rowNum) -> new AuthUser(
                    rs.getLong("id"),
                    rs.getLong("company_id"),
                    rs.getString("username"),
                    rs.getString("display_name"),
                    rs.getString("department"),
                    rs.getString("position_name"),
                    rs.getString("role"),
                    rs.getString("status"),
                    rs.getString("allowed_menu_sections")
            ), username));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<Map<String, Object>> findPendingInvite(String inviteCode) {
        expireOldInvites();
        try {
            return Optional.of(jdbcTemplate.queryForMap("""
                    SELECT *
                    FROM dashboard_user_invite
                    WHERE invite_code = ? AND status = 'PENDING' AND expires_at > NOW()
                    """, inviteCode));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private void expireOldInvites() {
        jdbcTemplate.update("""
                UPDATE dashboard_user_invite
                SET status = 'EXPIRED', updated_at = NOW()
                WHERE status = 'PENDING' AND expires_at <= NOW()
                """);
    }

    private String normalizeInviteRole(String requestedRole, AuthUser actor) {
        UserRole role = UserRole.from(requestedRole);
        if (role == UserRole.EXECUTIVE && !"EXECUTIVE".equals(actor.role())) {
            throw new CustomException(403, "대표 권한 초대는 대표만 생성할 수 있습니다.");
        }
        return role.name();
    }

    private void requireManagerOrExecutive(AuthUser actor) {
        UserRole role = UserRole.from(actor.role());
        if (role != UserRole.MANAGER && role != UserRole.EXECUTIVE) {
            throw new CustomException(403, "직원 초대 권한이 없습니다.");
        }
    }

    private int roleRank(UserRole role) {
        return switch (role) {
            case EMPLOYEE -> 1;
            case MANAGER -> 2;
            case EXECUTIVE -> 3;
        };
    }

    private String createInviteCode() {
        for (int attempt = 0; attempt < 10; attempt += 1) {
            String code = "NAEIL-" + randomCode(6);
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM dashboard_user_invite WHERE invite_code = ?",
                    Integer.class,
                    code
            );
            if (count == null || count == 0) {
                return code;
            }
        }
        throw new CustomException(500, "초대 코드를 생성하지 못했습니다.");
    }

    private String randomCode(int length) {
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i += 1) {
            builder.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return builder.toString();
    }

    private String hashPassword(String password) {
        try {
            byte[] salt = new byte[16];
            RANDOM.nextBytes(salt);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, HASH_ITERATIONS, HASH_BITS);
            byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return "pbkdf2$" + HASH_ITERATIONS + "$"
                    + Base64.getEncoder().encodeToString(salt) + "$"
                    + Base64.getEncoder().encodeToString(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash password", exception);
        }
    }

    private boolean verifyPassword(String password, String storedHash) {
        try {
            String[] parts = storedHash.split("\\$");
            if (parts.length != 4 || !"pbkdf2".equals(parts[0])) {
                return false;
            }
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expectedHash = Base64.getDecoder().decode(parts[3]);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, expectedHash.length * 8);
            byte[] actualHash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return MessageDigest.isEqual(actualHash, expectedHash);
        } catch (Exception exception) {
            return false;
        }
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

    private String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new CustomException(400, message);
        }
        return value.trim();
    }

    private String validateNewPassword(String value) {
        String password = required(value, "새 비밀번호를 입력하세요.");
        if (password.length() < 8) {
            throw new CustomException(400, "비밀번호는 8자 이상이어야 합니다.");
        }
        return password;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
