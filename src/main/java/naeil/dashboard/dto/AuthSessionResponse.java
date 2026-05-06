package naeil.dashboard.dto;

public record AuthSessionResponse(
        boolean authenticated,
        String username,
        String token
) {
}
