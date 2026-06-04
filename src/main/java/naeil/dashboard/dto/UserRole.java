package naeil.dashboard.dto;

public enum UserRole {
    EMPLOYEE,
    MANAGER,
    EXECUTIVE;

    public static UserRole from(String value) {
        if (value == null || value.isBlank()) {
            return EMPLOYEE;
        }
        return UserRole.valueOf(value.trim().toUpperCase());
    }
}
