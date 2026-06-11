package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdApiCredentialService {
    private final JdbcTemplate jdbc;

    public Map<String, Map<String, String>> findByCompany(Long companyId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT platform, key_name, key_value FROM ad_api_credentials WHERE company_id=? ORDER BY platform, key_name",
            companyId);
        Map<String, Map<String, String>> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String platform = (String) row.get("platform");
            String keyName = (String) row.get("key_name");
            String keyValue = (String) row.get("key_value");
            result.computeIfAbsent(platform, k -> new HashMap<>()).put(keyName, keyValue);
        }
        return result;
    }

    public void upsertPlatform(Long companyId, String platform, Map<String, String> keys) {
        for (Map.Entry<String, String> entry : keys.entrySet()) {
            jdbc.update("INSERT INTO ad_api_credentials(company_id,platform,key_name,key_value) VALUES(?,?,?,?) ON CONFLICT(company_id,platform,key_name) DO UPDATE SET key_value=EXCLUDED.key_value,updated_at=NOW()",
                companyId, platform, entry.getKey(), entry.getValue());
        }
    }
}
