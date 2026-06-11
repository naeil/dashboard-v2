package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.SupportProgramDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
  @RequiredArgsConstructor
  public class SupportProgramService {
        private final JdbcTemplate jdbc;
        private final RowMapper<SupportProgramDTO> rowMapper = (rs, rn) -> {
                  SupportProgramDTO d = new SupportProgramDTO();
                  d.setId(rs.getLong("id")); d.setCompanyId(rs.getLong("company_id"));
                  d.setProgramName(rs.getString("program_name")); d.setOrganization(rs.getString("organization"));
                  Date ad = rs.getDate("applied_date"); if (ad != null) d.setAppliedDate(ad.toLocalDate());
                  d.setAmount(rs.getBigDecimal("amount")); d.setStatus(rs.getString("status"));
                  d.setManagerName(rs.getString("manager_name")); d.setMemo(rs.getString("memo"));
                  d.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime()); return d;
        };
        public List<SupportProgramDTO> findAll(Long companyId) {
                  return jdbc.query("SELECT * FROM support_program WHERE company_id=? ORDER BY created_at DESC", rowMapper, companyId);
        }
        public Map<String, Object> getKpi(Long companyId) {
                  Map<String, Object> k = new HashMap<>();
                  k.put("activeCount", jdbc.queryForObject("SELECT COUNT(*) FROM support_program WHERE company_id=? AND status IN ('APPLYING','REVIEWING')", Object.class, companyId));
                  k.put("activeTotalAmount", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM support_program WHERE company_id=? AND status IN ('APPLYING','REVIEWING')", Object.class, companyId));
                  k.put("selectedTotalAmount", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM support_program WHERE company_id=? AND status='SELECTED'", Object.class, companyId));
                  return k;
        }
        public SupportProgramDTO create(SupportProgramDTO dto) {
                  KeyHolder kh = new GeneratedKeyHolder();
                  jdbc.update(con -> { PreparedStatement ps = con.prepareStatement("INSERT INTO support_program(company_id,program_name,organization,applied_date,amount,status,manager_name,memo) VALUES(?,?,?,?,?,?,?,?)", Statement.RETURN_GENERATED_KEYS);
                                                  ps.setLong(1,dto.getCompanyId()); ps.setString(2,dto.getProgramName()); ps.setString(3,dto.getOrganization());
                                                  ps.setDate(4,dto.getAppliedDate()!=null?Date.valueOf(dto.getAppliedDate()):null); ps.setBigDecimal(5,dto.getAmount());
                                                  ps.setString(6,dto.getStatus()!=null?dto.getStatus():"APPLYING"); ps.setString(7,dto.getManagerName()); ps.setString(8,dto.getMemo()); return ps; }, kh);
                  dto.setId(((Number)kh.getKeys().get("id")).longValue()); return dto;
        }
        public void update(Long id, SupportProgramDTO dto) {
                  jdbc.update("UPDATE support_program SET program_name=?,organization=?,applied_date=?,amount=?,status=?,manager_name=?,memo=? WHERE id=?",
                                          dto.getProgramName(),dto.getOrganization(),dto.getAppliedDate()!=null?Date.valueOf(dto.getAppliedDate()):null,dto.getAmount(),dto.getStatus(),dto.getManagerName(),dto.getMemo(),id);
        }
        public void delete(Long id) { jdbc.update("DELETE FROM support_program WHERE id=?", id); }
  }
