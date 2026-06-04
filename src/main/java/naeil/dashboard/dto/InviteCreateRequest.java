package naeil.dashboard.dto;

public record InviteCreateRequest(
        String displayName,
        String department,
        String positionName,
        String role
) {
}
