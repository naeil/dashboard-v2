package naeil.dashboard.dto;

public record AuthSessionResponse(
        boolean authenticated,
        String username,
        String displayName,
        String department,
        String positionName,
        String role,
        String accountScope,
        String accountLevel,
        String token,
        String allowedMenuSections
) {
}
