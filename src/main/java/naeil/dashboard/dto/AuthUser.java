package naeil.dashboard.dto;

public record AuthUser(
        Long id,
        Long companyId,
        String username,
        String displayName,
        String department,
        String positionName,
        String role,
        String status,
        String allowedMenuSections   // JSON 배열 문자열 또는 null (null = 부서 기반 기본값)
) {
}
