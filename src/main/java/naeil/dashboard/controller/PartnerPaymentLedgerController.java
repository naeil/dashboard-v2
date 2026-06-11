package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.PartnerPaymentLedgerDTO;
import naeil.dashboard.service.PartnerPaymentLedgerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
  @RequestMapping("/api/partner-payment-ledger")
  @RequiredArgsConstructor
  public class PartnerPaymentLedgerController {

    private final PartnerPaymentLedgerService service;

    @GetMapping
        public ResponseEntity<List<PartnerPaymentLedgerDTO>> list(
                      @RequestParam Long companyId,
                      @RequestParam(required = false) String direction) {
                  return ResponseEntity.ok(service.findAll(companyId, direction));
        }

    @GetMapping("/summary")
        public ResponseEntity<Map<String, Object>> summary(@RequestParam Long companyId) {
                  return ResponseEntity.ok(service.getSummary(companyId));
        }

    @PostMapping
        public ResponseEntity<PartnerPaymentLedgerDTO> create(@RequestBody PartnerPaymentLedgerDTO dto) {
                  return ResponseEntity.ok(service.create(dto));
        }

    @PutMapping("/{id}")
        public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody PartnerPaymentLedgerDTO dto) {
                  service.update(id, dto);
                  return ResponseEntity.ok().build();
        }

    @DeleteMapping("/{id}")
        public ResponseEntity<Void> delete(@PathVariable Long id) {
                  service.delete(id);
                  return ResponseEntity.ok().build();
        }

    @PatchMapping("/{id}/toggle-tax-invoice")
        public ResponseEntity<Void> toggleTaxInvoice(@PathVariable Long id) {
                  service.toggleTaxInvoice(id);
                  return ResponseEntity.ok().build();
        }

    @PatchMapping("/{id}/toggle-payment-confirmed")
        public ResponseEntity<Void> togglePaymentConfirmed(@PathVariable Long id) {
                  service.togglePaymentConfirmed(id);
                  return ResponseEntity.ok().build();
        }
  }
