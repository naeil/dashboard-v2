package naeil.dashboard.dto;

public record AuthSessionResponse(
        boolean authenticated,
        String username,
        String displayName,
        String department,
        String positionName,
        String role,
        String token,
        String allowedMenuSections   // JSON 배열 문자열 또는 null
) {
}
