package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.FieldAdCostEntry;
import naeil.dashboard.entity.FieldInventoryOrderEntry;
import naeil.dashboard.entity.FieldOtherCostEntry;
import naeil.dashboard.entity.FieldSalesEntry;
import naeil.dashboard.service.FieldDataAggregationService;
import naeil.dashboard.service.FieldDataExcelUploadService;
import naeil.dashboard.service.FieldDataInputService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
* L0 field-input layer REST API. Lets operations staff type in raw sales,
  * ad-cost, inventory/order and other-cost data, and exposes an L1/L2 summary
  * endpoint used by the new "field input" dashboard page.
  *
  * Additive-only controller: does not modify any existing endpoint.
  */
@RestController
  @RequestMapping("/api/field-input")
  @RequiredArgsConstructor
  public class FieldDataInputController {

private final FieldDataInputService fieldDataInputService;
    private final FieldDataAggregationService fieldDataAggregationService;
    private final FieldDataExcelUploadService fieldDataExcelUploadService;

// Sales entries

@GetMapping("/sales")
    public ResponseEntity<List<FieldSalesEntry>> getSalesEntries(
      @RequestParam(defaultValue = "1") Long companyId) {
      return ResponseEntity.ok(fieldDataInputService.getSalesEntries(companyId));
    }

@PostMapping("/sales")
    public ResponseEntity<FieldSalesEntry> createSalesEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestBody FieldSalesEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.createSalesEntry(companyId, createdBy, payload));
    }

@PutMapping("/sales/{id}")
    public ResponseEntity<FieldSalesEntry> updateSalesEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id,
      @RequestBody FieldSalesEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.updateSalesEntry(companyId, id, payload));
    }

@DeleteMapping("/sales/{id}")
    public ResponseEntity<Map<String, String>> deleteSalesEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id) {
      fieldDataInputService.deleteSalesEntry(companyId, id);
      return ResponseEntity.ok(Map.of("message", "deleted"));
    }

@PostMapping(value = "/sales/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadSalesExcel(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestParam("file") MultipartFile file) {
      FieldDataExcelUploadService.UploadResult result =
        fieldDataExcelUploadService.uploadSales(file, companyId, createdBy);
      return ResponseEntity.ok(Map.of("insertedCount", result.insertedCount(), "errors", result.errors()));
    }

@GetMapping("/sales/template")
    public ResponseEntity<byte[]> downloadSalesTemplate() {
      return excelFileResponse(fieldDataExcelUploadService.buildSalesTemplate(), "sales_template.xlsx");
    }

// Ad cost entries

@GetMapping("/ad-costs")
    public ResponseEntity<List<FieldAdCostEntry>> getAdCostEntries(
      @RequestParam(defaultValue = "1") Long companyId) {
      return ResponseEntity.ok(fieldDataInputService.getAdCostEntries(companyId));
    }

@PostMapping("/ad-costs")
    public ResponseEntity<FieldAdCostEntry> createAdCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestBody FieldAdCostEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.createAdCostEntry(companyId, createdBy, payload));
    }

@PutMapping("/ad-costs/{id}")
    public ResponseEntity<FieldAdCostEntry> updateAdCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id,
      @RequestBody FieldAdCostEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.updateAdCostEntry(companyId, id, payload));
    }

@DeleteMapping("/ad-costs/{id}")
    public ResponseEntity<Map<String, String>> deleteAdCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id) {
      fieldDataInputService.deleteAdCostEntry(companyId, id);
      return ResponseEntity.ok(Map.of("message", "deleted"));
    }

@PostMapping(value = "/ad-costs/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadAdCostExcel(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestParam("file") MultipartFile file) {
      FieldDataExcelUploadService.UploadResult result =
        fieldDataExcelUploadService.uploadAdCosts(file, companyId, createdBy);
      return ResponseEntity.ok(Map.of("insertedCount", result.insertedCount(), "errors", result.errors()));
    }

@GetMapping("/ad-costs/template")
    public ResponseEntity<byte[]> downloadAdCostTemplate() {
      return excelFileResponse(fieldDataExcelUploadService.buildAdCostTemplate(), "ad_costs_template.xlsx");
    }

// Inventory / order entries

@GetMapping("/inventory")
    public ResponseEntity<List<FieldInventoryOrderEntry>> getInventoryEntries(
      @RequestParam(defaultValue = "1") Long companyId) {
      return ResponseEntity.ok(fieldDataInputService.getInventoryEntries(companyId));
    }

@PostMapping("/inventory")
    public ResponseEntity<FieldInventoryOrderEntry> createInventoryEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestBody FieldInventoryOrderEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.createInventoryEntry(companyId, createdBy, payload));
    }

@PutMapping("/inventory/{id}")
    public ResponseEntity<FieldInventoryOrderEntry> updateInventoryEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id,
      @RequestBody FieldInventoryOrderEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.updateInventoryEntry(companyId, id, payload));
    }

@DeleteMapping("/inventory/{id}")
    public ResponseEntity<Map<String, String>> deleteInventoryEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id) {
      fieldDataInputService.deleteInventoryEntry(companyId, id);
      return ResponseEntity.ok(Map.of("message", "deleted"));
    }

@PostMapping(value = "/inventory/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadInventoryExcel(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestParam("file") MultipartFile file) {
      FieldDataExcelUploadService.UploadResult result =
        fieldDataExcelUploadService.uploadInventory(file, companyId, createdBy);
      return ResponseEntity.ok(Map.of("insertedCount", result.insertedCount(), "errors", result.errors()));
    }

@GetMapping("/inventory/template")
    public ResponseEntity<byte[]> downloadInventoryTemplate() {
      return excelFileResponse(fieldDataExcelUploadService.buildInventoryTemplate(), "inventory_template.xlsx");
    }

// Other cost entries

@GetMapping("/other-costs")
    public ResponseEntity<List<FieldOtherCostEntry>> getOtherCostEntries(
      @RequestParam(defaultValue = "1") Long companyId) {
      return ResponseEntity.ok(fieldDataInputService.getOtherCostEntries(companyId));
    }

@PostMapping("/other-costs")
    public ResponseEntity<FieldOtherCostEntry> createOtherCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestBody FieldOtherCostEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.createOtherCostEntry(companyId, createdBy, payload));
    }

@PutMapping("/other-costs/{id}")
    public ResponseEntity<FieldOtherCostEntry> updateOtherCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id,
      @RequestBody FieldOtherCostEntry payload) {
      return ResponseEntity.ok(fieldDataInputService.updateOtherCostEntry(companyId, id, payload));
    }

@DeleteMapping("/other-costs/{id}")
    public ResponseEntity<Map<String, String>> deleteOtherCostEntry(
      @RequestParam(defaultValue = "1") Long companyId,
      @PathVariable Long id) {
      fieldDataInputService.deleteOtherCostEntry(companyId, id);
      return ResponseEntity.ok(Map.of("message", "deleted"));
    }

@PostMapping(value = "/other-costs/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadOtherCostExcel(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam(required = false) String createdBy,
      @RequestParam("file") MultipartFile file) {
      FieldDataExcelUploadService.UploadResult result =
        fieldDataExcelUploadService.uploadOtherCosts(file, companyId, createdBy);
      return ResponseEntity.ok(Map.of("insertedCount", result.insertedCount(), "errors", result.errors()));
    }

@GetMapping("/other-costs/template")
    public ResponseEntity<byte[]> downloadOtherCostTemplate() {
      return excelFileResponse(fieldDataExcelUploadService.buildOtherCostTemplate(), "other_costs_template.xlsx");
    }

// L1/L2 summary

@GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
      @RequestParam(defaultValue = "1") Long companyId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
      return ResponseEntity.ok(fieldDataAggregationService.getSummary(companyId, startDate, endDate));
    }

private ResponseEntity<byte[]> excelFileResponse(byte[] content, String filename) {
  return ResponseEntity.ok()
    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
    .contentType(MediaType.APPLICATION_OCTET_STREAM)
    .body(content);
}
  }
