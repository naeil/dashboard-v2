package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.PartnerPaymentLedgerDTO;
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
  public class PartnerPaymentLedgerService {

    private final JdbcTemplate jdbc;

    private final RowMapper<PartnerPaymentLedgerDTO> rowMapper = (rs, rowNum) -> {
              PartnerPaymentLedgerDTO dto = new PartnerPaymentLedgerDTO();
              dto.setId(rs.getLong("id"));
              dto.setCompanyId(rs.getLong("company_id"));
              dto.setPartnerName(rs.getString("partner_name"));
              dto.setDirection(rs.getString("direction"));
              dto.setAmount(rs.getBigDecimal("amount"));
              Date issueDate = rs.getDate("issue_date");
              if (issueDate != null) dto.setIssueDate(issueDate.toLocalDate());
              Date dueDate = rs.getDate("due_date");
              if (dueDate != null) dto.setDueDate(dueDate.toLocalDate());
              dto.setTaxInvoiceIssued(rs.getBoolean("tax_invoice_issued"));
              dto.setPaymentConfirmed(rs.getBoolean("payment_confirmed"));
              dto.setDescription(rs.getString("description"));
              dto.setStatus(rs.getString("status"));
              dto.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
              return dto;
    };

    public List<PartnerPaymentLedgerDTO> findAll(Long companyId, String direction) {
              if (direction != null && !direction.isBlank()) {
                            return jdbc.query(
                                              "SELECT * FROM partner_payment_ledger WHERE company_id = ? AND direction = ? ORDER BY created_at DESC",
                                              rowMapper, companyId, direction);
              }
              return jdbc.query(
                            "SELECT * FROM partner_payment_ledger WHERE company_id = ? ORDER BY created_at DESC",
                            rowMapper, companyId);
    }

    public Map<String, Object> getSummary(Long companyId) {
              Map<String, Object> summary = new HashMap<>();

            // 미수금 합계 (RECEIVABLE + PENDING/DONE 미확인)
            Object unpaidReceivable = jdbc.queryForObject(
                          "SELECT COALESCE(SUM(amount), 0) FROM partner_payment_ledger WHERE company_id = ? AND direction = 'RECEIVABLE' AND payment_confirmed = FALSE AND status != 'CANCELLED'",
                          Object.class, companyId);
              summary.put("unpaidReceivable", unpaidReceivable);

            // 미지급 합계 (PAYABLE + 미확인)
            Object unpaidPayable = jdbc.queryForObject(
                          "SELECT COALESCE(SUM(amount), 0) FROM partner_payment_ledger WHERE company_id = ? AND direction = 'PAYABLE' AND payment_confirmed = FALSE AND status != 'CANCELLED'",
                          Object.class, companyId);
              summary.put("unpaidPayable", unpaidPayable);

            // 이번달 수금 예정
            Object thisMonthReceivable = jdbc.queryForObject(
                          "SELECT COALESCE(SUM(amount), 0) FROM partner_payment_ledger WHERE company_id = ? AND direction = 'RECEIVABLE' AND status = 'PENDING' AND DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE)",
                          Object.class, companyId);
              summary.put("thisMonthReceivable", thisMonthReceivable);

            return summary;
    }

    public PartnerPaymentLedgerDTO create(PartnerPaymentLedgerDTO dto) {
              KeyHolder keyHolder = new GeneratedKeyHolder();
              jdbc.update(con -> {
                            PreparedStatement ps = con.prepareStatement(
                                              "INSERT INTO partner_payment_ledger (company_id, partner_name, direction, amount, issue_date, due_date, tax_invoice_issued, payment_confirmed, description, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
                                              Statement.RETURN_GENERATED_KEYS);
                            ps.setLong(1, dto.getCompanyId());
                            ps.setString(2, dto.getPartnerName());
                            ps.setString(3, dto.getDirection());
                            ps.setBigDecimal(4, dto.getAmount());
                            ps.setDate(5, dto.getIssueDate() != null ? Date.valueOf(dto.getIssueDate()) : null);
                            ps.setDate(6, dto.getDueDate() != null ? Date.valueOf(dto.getDueDate()) : null);
                            ps.setBoolean(7, dto.getTaxInvoiceIssued() != null && dto.getTaxInvoiceIssued());
                            ps.setBoolean(8, dto.getPaymentConfirmed() != null && dto.getPaymentConfirmed());
                            ps.setString(9, dto.getDescription());
                            ps.setString(10, dto.getStatus() != null ? dto.getStatus() : "PENDING");
                            return ps;
              }, keyHolder);
              Long id = ((Number) keyHolder.getKeys().get("id")).longValue();
              dto.setId(id);
              return dto;
    }

    public void update(Long id, PartnerPaymentLedgerDTO dto) {
              jdbc.update(
                            "UPDATE partner_payment_ledger SET partner_name=?, direction=?, amount=?, issue_date=?, due_date=?, tax_invoice_issued=?, payment_confirmed=?, description=?, status=? WHERE id=?",
                            dto.getPartnerName(), dto.getDirection(), dto.getAmount(),
                            dto.getIssueDate() != null ? Date.valueOf(dto.getIssueDate()) : null,
                            dto.getDueDate() != null ? Date.valueOf(dto.getDueDate()) : null,
                            dto.getTaxInvoiceIssued(), dto.getPaymentConfirmed(),
                            dto.getDescription(), dto.getStatus(), id);
    }

    public void delete(Long id) {
              jdbc.update("DELETE FROM partner_payment_ledger WHERE id = ?", id);
    }

    public void toggleTaxInvoice(Long id) {
              jdbc.update("UPDATE partner_payment_ledger SET tax_invoice_issued = NOT tax_invoice_issued WHERE id = ?", id);
    }

    public void togglePaymentConfirmed(Long id) {
              jdbc.update("UPDATE partner_payment_ledger SET payment_confirmed = NOT payment_confirmed WHERE id = ?", id);
    }
  }
