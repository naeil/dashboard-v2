package naeil.dashboard.dto;

public record ChangePasswordRequest(
        String currentPassword,
        String newPassword
) {
}
