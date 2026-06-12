package naeil.dashboard.dto;

public record AuthUser(
        Long id,
        Long companyId,
        String username,
        String displayName,
        String department,
        String positionName,
        String role,
        String accountScope,
        String accountLevel,
        String status,
        String allowedMenuSections
) {
}
