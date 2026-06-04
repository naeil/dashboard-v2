package naeil.dashboard.dto;

public record RegisterRequest(
        String inviteCode,
        String username,
        String password
) {
}
