package naeil.dashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    public static final String FEATURE_CREATE_INVITE = "employee.invite";
    public static final String FEATURE_RESET_PASSWORD = "employee.reset_password";
    public static final String FEATURE_MANAGE_MENU_PERMISSIONS = "employee.manage_permissions";
    public static final String FEATURE_DELETE_USERS = "employee.deactivate";
    private static final String MENU_ORGANIZATION = "organization";
    private static final String MENU_EMPLOYEES_LEGACY = "employees";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HASH_ITERATIONS = 120_000;
    private static final int HASH_BITS = 256;
    private static final String PASSWORD_RULE_MESSAGE =
            "비밀번호는 영문 대문자, 소문자, 특수문자(!@#$%&*)를 각각 1개 이상 포함하고, 영문/숫자/특수문자(!@#$%&*)만 사용해 8~16자로 입력하세요.";

    private final AuthProperties authProperties;
    private final AuthTokenService authTokenService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AuthUser platformLogin(String username, String password) {
        String normalizedUsername = required(username, "아이디를 입력하세요.").trim();
        AuthUser user = findPlatformUser(normalizedUsername)
                .orElseGet(() -> tryCreateBootstrapExecutive(1L, normalizedUsername, password));
        if (!"PLATFORM".equals(user.accountScope())) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        return verifySeparatedLogin(user, password);
    }

    public AuthUser tenantLogin(String companyCode, String username, String password) {
        String normalizedUsername = required(username, "아이디를 입력하세요.").trim();
        Long companyId = findCompanyIdByCode(companyCode)
                .orElseThrow(() -> new CustomException(400, "회사 코드를 입력하세요."));
        AuthUser user = findTenantUser(companyId, normalizedUsername)
                .orElseThrow(() -> new CustomException(401, "회사 코드, 아이디 또는 비밀번호가 올바르지 않습니다."));
        return verifySeparatedLogin(user, password);
    }

    private AuthUser verifySeparatedLogin(AuthUser user, String password) {
        if (!"ACTIVE".equals(user.status())) {
            throw new CustomException(403, "비활성화된 계정입니다. 관리자에게 문의하세요.");
        }

        String passwordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM dashboard_user WHERE id = ?",
                String.class,
                user.id()
        );
        if (!verifyPassword(password, passwordHash)) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        jdbcTemplate.update("UPDATE dashboard_user SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", user.id());
        return findUserById(user.id()).orElse(user);
    }

    @Deprecated
    public AuthUser login(String companyCode, String username, String password) {
        String normalizedUsername = required(username, "아이디를 입력하세요.").trim();
        Long companyId = findCompanyIdByCode(companyCode)
                .orElseGet(() -> tryBootstrapCompanyId(normalizedUsername, password));
        AuthUser user = findUser(companyId, normalizedUsername)
                .orElseGet(() -> tryCreateBootstrapExecutive(companyId, normalizedUsername, password));
        if (!"ACTIVE".equals(user.status())) {
            throw new CustomException(403, "비활성화된 계정입니다. 관리자에게 문의하세요.");
        }

        String passwordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM dashboard_user WHERE id = ?",
                String.class,
                user.id()
        );
        if (!verifyPassword(password, passwordHash)) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        jdbcTemplate.update("UPDATE dashboard_user SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", user.id());
        return findUserById(user.id()).orElse(user);
    }

    public String createToken(AuthUser user) {
        return authTokenService.createToken(user.id());
    }

    public Optional<AuthUser> authenticate(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = authorizationHeader.substring("Bearer ".length()).trim();
        return authTokenService.validateAndExtractUserId(token)
                .flatMap(this::findActiveUserById);
    }

    public List<Map<String, Object>> listUsers() {
        return jdbcTemplate.queryForList("""
                SELECT id, username, display_name, department, position_name, role, account_scope,
                       account_level, status, email, allowed_menu_sections, last_login_at, created_at
                FROM dashboard_user
                ORDER BY created_at DESC
                """);
    }

    public List<Map<String, Object>> listInvites() {
        expireOldInvites();
        return jdbcTemplate.queryForList("""
                SELECT id, invite_code, display_name, department, position_name, role, account_scope,
                       account_level, status, invited_by, accepted_by, expires_at, accepted_at, created_at
                FROM dashboard_user_invite
                ORDER BY created_at DESC
                """);
    }

    public List<Map<String, Object>> listPositionPermissionTemplates(AuthUser actor) {
        if (!canAccessEmployeeManagement(actor)) {
            requireRole(actor, UserRole.EXECUTIVE);
        }
        return jdbcTemplate.queryForList("""
                SELECT id, company_id, position_name, permission_group_name, description,
                       permission_payload, created_at, updated_at
                FROM position_permission_template
                WHERE company_id = ?
                ORDER BY position_name
                """, actor.companyId());
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
                "role", invite.get("role"),
                "accountScope", invite.get("account_scope"),
                "accountLevel", invite.get("account_level")
        );
    }

    public Map<String, Object> checkUsernameAvailable(String inviteCode, String username) {
        String normalizedCode = required(inviteCode, "초대 코드를 입력하세요.").trim().toUpperCase();
        String normalizedUsername = required(username, "아이디를 입력하세요.").trim();
        Map<String, Object> invite = findPendingInvite(normalizedCode)
                .orElseThrow(() -> new CustomException(400, "유효하지 않거나 만료된 초대 코드입니다."));
        Long companyId = ((Number) invite.get("company_id")).longValue();
        boolean available = findUser(companyId, normalizedUsername).isEmpty();
        return Map.of(
                "username", normalizedUsername,
                "inviteCode", normalizedCode,
                "companyId", companyId,
                "available", available,
                "message", available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다."
        );
    }

    public Map<String, Object> createInvite(InviteCreateRequest request, AuthUser actor) {
        requireFeature(actor, FEATURE_CREATE_INVITE);
        String role = normalizeInviteRole(request.role(), actor);
        String accountLevel = roleToAccountLevel(role);
        String code = createInviteCode();
        String displayName = required(request.displayName(), "직원 이름을 입력하세요.");

        jdbcTemplate.update("""
                INSERT INTO dashboard_user_invite (
                    company_id, invite_code, display_name, department, position_name, role,
                    account_scope, account_level, status, invited_by, expires_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 'TENANT', ?, 'PENDING', ?, NOW() + INTERVAL '7 days')
                """, actor.companyId(), code, displayName, blankToNull(request.department()), blankToNull(request.positionName()),
                role, accountLevel, actor.username());

        return Map.of(
                "inviteCode", code,
                "displayName", displayName,
                "role", role,
                "accountScope", "TENANT",
                "accountLevel", accountLevel,
                "expiresInDays", 7
        );
    }

    public void deleteInvite(Long inviteId, AuthUser actor) {
        requireFeature(actor, FEATURE_CREATE_INVITE);

        Map<String, Object> invite;
        try {
            invite = jdbcTemplate.queryForMap("""
                    SELECT id, company_id, status
                    FROM dashboard_user_invite
                    WHERE id = ?
                    """, inviteId);
        } catch (EmptyResultDataAccessException exception) {
            throw new CustomException(404, "초대 링크를 찾을 수 없습니다.");
        }

        if (!actor.companyId().equals(((Number) invite.get("company_id")).longValue())) {
            throw new CustomException(403, "다른 회사의 초대 링크는 삭제할 수 없습니다.");
        }
        if ("ACCEPTED".equals(String.valueOf(invite.get("status")))) {
            throw new CustomException(400, "이미 가입 완료된 초대는 삭제할 수 없습니다.");
        }

        jdbcTemplate.update("DELETE FROM dashboard_user_invite WHERE id = ?", inviteId);
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
        requireFeature(actor, FEATURE_RESET_PASSWORD);
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
        requireFeature(actor, FEATURE_DELETE_USERS);
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
        String password = validateNewPassword(request.password());
        Map<String, Object> invite = findPendingInvite(inviteCode)
                .orElseThrow(() -> new CustomException(400, "유효하지 않거나 만료된 초대 코드입니다."));
        Long companyId = ((Number) invite.get("company_id")).longValue();
        if (findUser(companyId, username).isPresent()) {
            throw new CustomException(409, "이미 사용 중인 아이디입니다.");
        }
        String passwordHash = hashPassword(password);

        String defaultPermissions = findPositionPermissionPayload(
                companyId,
                invite.get("position_name")
        ).orElse(null);

        jdbcTemplate.update("""
                INSERT INTO dashboard_user (
                    company_id, username, display_name, department, position_name, role,
                    account_scope, account_level, password_hash, status, allowed_menu_sections
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                companyId,
                username,
                invite.get("display_name"),
                invite.get("department"),
                invite.get("position_name"),
                invite.get("role"),
                invite.get("account_scope"),
                invite.get("account_level"),
                passwordHash,
                defaultPermissions
        );

        jdbcTemplate.update("""
                UPDATE dashboard_user_invite
                SET status = 'ACCEPTED', accepted_by = ?, accepted_at = NOW(), updated_at = NOW()
                WHERE id = ?
                """, username, ((Number) invite.get("id")).longValue());

        return findUser(companyId, username).orElseThrow();
    }

    public void requireRole(AuthUser user, UserRole minimumRole) {
        int current = roleRank(UserRole.from(user.role()));
        int required = roleRank(minimumRole);
        if (current < required) {
            throw new CustomException(403, "접근 권한이 없습니다.");
        }
    }

    public void requireFeature(AuthUser actor, String featureKey) {
        if (!hasFeaturePermission(actor, featureKey)) {
            throw new CustomException(403, "기능 권한이 없습니다.");
        }
    }

    public boolean hasFeaturePermission(AuthUser actor, String featureKey) {
        if (actor == null) {
            return false;
        }
        if (UserRole.from(actor.role()) == UserRole.EXECUTIVE) {
            return true;
        }
        return parseFeaturePermissions(actor.allowedMenuSections()).contains(featureKey);
    }

    public boolean canAccessEmployeeManagement(AuthUser actor) {
        if (actor == null) {
            return false;
        }
        if (UserRole.from(actor.role()) == UserRole.EXECUTIVE) {
            return true;
        }
        Set<String> features = parseFeaturePermissions(actor.allowedMenuSections());
        Set<String> menus = parseMenuPermissions(actor.allowedMenuSections());
        return menus.contains(MENU_ORGANIZATION)
                || menus.contains(MENU_EMPLOYEES_LEGACY)
                || features.contains(FEATURE_CREATE_INVITE)
                || features.contains(FEATURE_RESET_PASSWORD)
                || features.contains(FEATURE_MANAGE_MENU_PERMISSIONS)
                || features.contains(FEATURE_DELETE_USERS);
    }

    private Optional<Long> findCompanyIdByCode(String companyCode) {
        if (companyCode == null || companyCode.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT id
                    FROM company
                    WHERE company_code = ? AND status = 'ACTIVE'
                    """, Long.class, companyCode.trim().toUpperCase()));
        } catch (EmptyResultDataAccessException exception) {
            throw new CustomException(401, "회사 코드, 아이디 또는 비밀번호가 올바르지 않습니다.");
        }
    }

    private Long tryBootstrapCompanyId(String username, String password) {
        if (matches(username, authProperties.username()) && matches(password, authProperties.password())) {
            return 1L;
        }
        throw new CustomException(400, "회사 코드를 입력하세요.");
    }

    private AuthUser tryCreateBootstrapExecutive(Long companyId, String username, String password) {
        if (!matches(username, authProperties.username()) || !matches(password, authProperties.password())) {
            throw new CustomException(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        String passwordHash = hashPassword(password);
        jdbcTemplate.update("""
                INSERT INTO dashboard_user (
                    company_id, username, display_name, department, position_name, role,
                    account_scope, account_level, password_hash, status
                )
                VALUES (?, ?, '대표 관리자', '경영', '대표', 'EXECUTIVE', 'PLATFORM', 'ADMIN', ?, 'ACTIVE')
                ON CONFLICT (company_id, account_scope, username) DO NOTHING
                """, companyId, username, passwordHash);
        return findPlatformUser(username).orElseThrow();
    }

    private Optional<AuthUser> findActiveUserById(Long userId) {
        return findUserById(userId).filter(user -> "ACTIVE".equals(user.status()));
    }

    public void updateMenuPermissions(Long userId, String sectionsJson) {
        jdbcTemplate.update(
                "UPDATE dashboard_user SET allowed_menu_sections = ?, updated_at = NOW() WHERE id = ?",
                sectionsJson, userId);
    }

    @Transactional
    public Map<String, Object> savePositionPermissionTemplate(Map<String, Object> body, AuthUser actor) {
        requireFeature(actor, FEATURE_MANAGE_MENU_PERMISSIONS);
        String positionName = required(text(body.get("positionName")), "직급명을 입력하세요.");
        String permissionGroupName = blankToNull(text(body.get("permissionGroupName")));
        String description = blankToNull(text(body.get("description")));
        String sectionsJson = normalizeSectionsPayload(body.get("sections"));

        jdbcTemplate.update("""
                INSERT INTO position_permission_template (
                    company_id, position_name, permission_group_name, description, permission_payload
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (company_id, position_name)
                DO UPDATE SET
                    permission_group_name = EXCLUDED.permission_group_name,
                    description = EXCLUDED.description,
                    permission_payload = EXCLUDED.permission_payload,
                    updated_at = NOW()
                """,
                actor.companyId(),
                positionName,
                permissionGroupName != null ? permissionGroupName : positionName + " 권한",
                description,
                sectionsJson);

        int updatedUsers = jdbcTemplate.update("""
                UPDATE dashboard_user
                SET allowed_menu_sections = ?, updated_at = NOW()
                WHERE company_id = ?
                  AND COALESCE(NULLIF(position_name, ''), '직원') = ?
                  AND role <> 'EXECUTIVE'
                """, sectionsJson, actor.companyId(), positionName);

        return Map.of(
                "positionName", positionName,
                "updatedUsers", updatedUsers,
                "message", "직급 권한 템플릿이 저장되었습니다."
        );
    }

    private Optional<AuthUser> findUser(Long companyId, String username) {
        if (companyId == null || username == null || username.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT id, company_id, username, display_name, department, position_name, role,
                           account_scope, account_level, status, allowed_menu_sections
                    FROM dashboard_user
                    WHERE company_id = ? AND username = ? AND account_scope = 'TENANT'
                    """, this::mapAuthUser, companyId, username));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<AuthUser> findTenantUser(Long companyId, String username) {
        return findUser(companyId, username)
                .filter(user -> "TENANT".equals(user.accountScope()));
    }

    private Optional<AuthUser> findPlatformUser(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT id, company_id, username, display_name, department, position_name, role,
                           account_scope, account_level, status, allowed_menu_sections
                    FROM dashboard_user
                    WHERE username = ? AND account_scope = 'PLATFORM'
                    ORDER BY id
                    LIMIT 1
                    """, this::mapAuthUser, username));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private Optional<AuthUser> findUserById(Long userId) {
        if (userId == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT id, company_id, username, display_name, department, position_name, role,
                           account_scope, account_level, status, allowed_menu_sections
                    FROM dashboard_user
                    WHERE id = ?
                    """, this::mapAuthUser, userId));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private AuthUser mapAuthUser(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new AuthUser(
                rs.getLong("id"),
                rs.getLong("company_id"),
                rs.getString("username"),
                rs.getString("display_name"),
                rs.getString("department"),
                rs.getString("position_name"),
                rs.getString("role"),
                rs.getString("account_scope"),
                rs.getString("account_level"),
                rs.getString("status"),
                rs.getString("allowed_menu_sections")
        );
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

    private Optional<String> findPositionPermissionPayload(Long companyId, Object positionName) {
        String normalizedPosition = text(positionName);
        if (normalizedPosition == null || normalizedPosition.isBlank()) {
            normalizedPosition = "직원";
        }
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT permission_payload
                    FROM position_permission_template
                    WHERE company_id = ? AND position_name = ?
                    """, String.class, companyId, normalizedPosition.trim()));
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
        if (role == UserRole.EXECUTIVE) {
            throw new CustomException(400, "대표 계정은 초대로 생성할 수 없습니다.");
        }
        return role.name();
    }

    private int roleRank(UserRole role) {
        return switch (role) {
            case EMPLOYEE -> 1;
            case MANAGER -> 2;
            case EXECUTIVE -> 3;
        };
    }

    private String roleToAccountLevel(String role) {
        return switch (UserRole.from(role)) {
            case EXECUTIVE -> "ADMIN";
            case MANAGER -> "MANAGER";
            case EMPLOYEE -> "EMPLOYEE";
        };
    }

    private Set<String> parseFeaturePermissions(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        try {
            Object parsed = objectMapper.readValue(value, new TypeReference<Object>() {});
            Set<String> features = new HashSet<>();
            if (parsed instanceof List<?> entries) {
                for (Object entry : entries) {
                    String text = text(entry);
                    if (text != null && text.startsWith("feature:")) {
                        features.add(normalizeFeaturePermission(text.substring("feature:".length())));
                    }
                }
            } else if (parsed instanceof Map<?, ?> map) {
                Object featureEntries = map.get("features");
                if (featureEntries instanceof List<?> entries) {
                    for (Object entry : entries) {
                        String text = text(entry);
                        if (text != null) {
                            features.add(normalizeFeaturePermission(text));
                        }
                    }
                }
            }
            return features;
        } catch (Exception ignored) {
            return Set.of();
        }
    }

    private Set<String> parseMenuPermissions(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        try {
            Object parsed = objectMapper.readValue(value, new TypeReference<Object>() {});
            Set<String> menus = new HashSet<>();
            if (parsed instanceof List<?> entries) {
                for (Object entry : entries) {
                    String text = text(entry);
                    if (text != null && !text.startsWith("feature:")) {
                        menus.add(text);
                    }
                }
            } else if (parsed instanceof Map<?, ?> map) {
                Object menuEntries = map.get("menus");
                if (menuEntries instanceof List<?> entries) {
                    for (Object entry : entries) {
                        String text = text(entry);
                        if (text != null) {
                            menus.add(text);
                        }
                    }
                }
            }
            return menus;
        } catch (Exception ignored) {
            return Set.of();
        }
    }

    private String normalizeFeaturePermission(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.startsWith("feature:") ? value.substring("feature:".length()) : value;
        return switch (normalized) {
            case "create_invite" -> FEATURE_CREATE_INVITE;
            case "reset_password" -> FEATURE_RESET_PASSWORD;
            case "manage_menu_permissions" -> FEATURE_MANAGE_MENU_PERMISSIONS;
            case "delete_users" -> FEATURE_DELETE_USERS;
            default -> normalized;
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

    private String text(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private String normalizeSectionsPayload(Object sections) {
        if (sections == null) {
            return "[]";
        }
        if (sections instanceof String text) {
            return text.isBlank() ? "[]" : text;
        }
        try {
            return objectMapper.writeValueAsString(sections);
        } catch (Exception exception) {
            throw new CustomException(400, "권한 정보를 저장할 수 없습니다.");
        }
    }

    private String validateNewPassword(String value) {
        String password = required(value, "비밀번호를 입력하세요.");
        if (!password.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%&*])[A-Za-z0-9!@#$%&*]{8,16}$")) {
            throw new CustomException(400, PASSWORD_RULE_MESSAGE);
        }
        return password;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
