package naeil.dashboard.dto;

public enum UserRole {
    EMPLOYEE,
    MANAGER,
    EXECUTIVE,
    HR_MANAGER;

    public static UserRole from(String value) {
        if (value == null || value.isBlank()) {
            return EMPLOYEE;
        }
        try {
            return UserRole.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return EMPLOYEE;
        }
    }
}
