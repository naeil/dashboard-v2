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

    // ===== 비밀번호 찾기 - SMS OTP =====

    public Map<String, Object> requestPasswordReset(String companyCode, String loginId, String phoneNumber) {
        // 회사코드 + 로그인ID + 휴대폰번호 전하여 사용자 확인
        Map<String, Object> user = null;
        try {
            user = jdbcTemplate.queryForMap("""
                SELECT id, username, phone_number
                FROM dashboard_user
                WHERE company_code = ?
                  AND username = ?
                  AND status = 'active'
                """, companyCode, loginId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new CustomException(404, "일치하는 계정 정보가 없습니다.");
        }

        // 휴대폰 번호 검증 - 저장된 번호와 일치 확인
        String storedPhone = (String) user.get("phone_number");
        if (storedPhone == null || storedPhone.isBlank()) {
            throw new CustomException(400, "등록된 휴대폰 번호가 없습니다. 관리자에게 문의하세요.");
        }
        // 휴대폰 번호 마스킹 비교 (숨긴 부분 허용: 010****1234)
        String normalizedInput = phoneNumber.replaceAll("[^0-9]", "");
        String normalizedStored = storedPhone.replaceAll("[^0-9]", "");
        if (!normalizedInput.equals(normalizedStored)) {
            throw new CustomException(400, "휴대폰 번호가 일치하지 않습니다.");
        }

        // 6자리 OTP 생성
        String otp = String.format("%06d", new SecureRandom().nextInt(1000000));

        // 기존 미사용 OTP 삭제
        jdbcTemplate.update(
            "DELETE FROM password_reset_otp WHERE company_code = ? AND login_id = ? AND used = false",
            companyCode, loginId
        );

        // OTP DB저장 (5분 유효)
        jdbcTemplate.update("""
            INSERT INTO password_reset_otp (company_code, login_id, phone_number, otp_code, expires_at)
            VALUES (?, ?, ?, ?, NOW() + INTERVAL '5 minutes')
            """, companyCode, loginId, normalizedStored, otp);

        // SMS 발송
        boolean smsSent = sendSmsOtp(normalizedStored, otp);

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("success", true);
        result.put("message", smsSent
            ? "인증번호가 발송되었습니다."
            : "인증번호: " + otp + " (SMS 문자 발송 미설정)");
        result.put("masked_phone", maskPhone(normalizedStored));
        return result;
    }

    public void verifyAndResetPassword(String companyCode, String loginId, String phoneNumber, String otpCode, String newPassword) {
        String normalizedPhone = phoneNumber.replaceAll("[^0-9]", "");

        // OTP 검증
        Map<String, Object> otpRow = null;
        try {
            otpRow = jdbcTemplate.queryForMap("""
                SELECT id FROM password_reset_otp
                WHERE company_code = ?
                  AND login_id = ?
                  AND phone_number = ?
                  AND otp_code = ?
                  AND used = false
                  AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
                """, companyCode, loginId, normalizedPhone, otpCode);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new CustomException(400, "인증번호가 일치하지 않거나 만료되었습니다.");
        }

        // 비밀번호 유효성 검사
        if (newPassword == null || newPassword.length() < 8) {
            throw new CustomException(400, "비밀번호는 8자 이상이어야 합니다.");
        }

        // 비밀번호 변경
        Long userId = ((Number) jdbcTemplate.queryForObject(
            "SELECT id FROM dashboard_user WHERE company_code = ? AND username = ? AND status = 'active'",
            Long.class, companyCode, loginId
        )).longValue();

        jdbcTemplate.update(
            "UPDATE dashboard_user SET password_hash = ?, updated_at = NOW() WHERE id = ?",
            hashPassword(newPassword), userId
        );

        // OTP 사용 처리
        jdbcTemplate.update(
            "UPDATE password_reset_otp SET used = true WHERE id = ?",
            otpRow.get("id")
        );
    }

    private boolean sendSmsOtp(String phoneNumber, String otpCode) {
        String apiKey = System.getenv("COOLSMS_API_KEY");
        String apiSecret = System.getenv("COOLSMS_API_SECRET");
        String fromNumber = System.getenv("COOLSMS_FROM_NUMBER");

        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            // SMS 설정 없으면 로깅만 하고 false 반환
            System.out.println("[SMS OTP] " + phoneNumber + " 로그 (API미설정): " + otpCode);
            return false;
        }

        try {
            String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
            String salt = java.util.UUID.randomUUID().toString().replaceAll("-", "").substring(0, 16);
            String signature = hmacSha256(apiSecret, timestamp + salt);

            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            headers.set("Authorization", "HMAC-SHA256 apiKey=" + apiKey
                + ", date=" + timestamp
                + ", salt=" + salt
                + ", signature=" + signature);

            Map<String, Object> requestBody = new java.util.HashMap<>();
            requestBody.put("message", Map.of(
                "to", phoneNumber,
                "from", fromNumber != null ? fromNumber : "0",
                "text", "[내일그룹] 비밀번호 찾기 인증번호: " + otpCode + " (5분 유효)"
            ));

            org.springframework.http.HttpEntity<Map<String, Object>> entity =
                new org.springframework.http.HttpEntity<>(requestBody, headers);

            restTemplate.postForObject("https://api.coolsms.co.kr/messages/v4/send", entity, String.class);
            return true;
        } catch (Exception e) {
            System.err.println("[SMS OTP] 발송 실패: " + e.getMessage());
            return false;
        }
    }

    private String hmacSha256(String key, String data) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 8) return phone;
        int len = phone.length();
        return phone.substring(0, 3) + "****" + phone.substring(len - 4);
    }

}
