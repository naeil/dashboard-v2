package naeil.dashboard.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.FieldAdCostEntry;
import naeil.dashboard.entity.FieldInventoryOrderEntry;
import naeil.dashboard.entity.FieldOtherCostEntry;
import naeil.dashboard.entity.FieldSalesEntry;
import naeil.dashboard.repository.FieldAdCostEntryRepository;
import naeil.dashboard.repository.FieldInventoryOrderEntryRepository;
import naeil.dashboard.repository.FieldOtherCostEntryRepository;
import naeil.dashboard.repository.FieldSalesEntryRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * L0 field-input layer: parses Excel files uploaded by operations staff for the
   * sales / ad-cost / inventory-order / other-cost entry tables, and bulk-saves the
   * parsed rows through the existing repositories. Also builds simple xlsx templates
   * so staff know the expected column layout.
   *
   * Additive-only: does not touch any other sync/aggregation logic.
   *
   * Expected column order (row 1 = header, data starts at row 2):
 * - Sales : brandId, productId, channelName, entryDate, quantity, salesAmount, costAmount, memo
   * - Ad cost : brandId, productId, channelName, entryDate, adCostAmount, impressions, clicks, conversions, memo
   * - Inventory : brandId, productId, entryType(inbound/outbound/order request), entryDate, quantity, memo
   * - Other cost : brandId, productId, costCategory, entryDate, amount, memo
   */
@Service
  @RequiredArgsConstructor
  public class FieldDataExcelUploadService {

    private final FieldSalesEntryRepository salesRepository;
        private final FieldAdCostEntryRepository adCostRepository;
        private final FieldInventoryOrderEntryRepository inventoryRepository;
        private final FieldOtherCostEntryRepository otherCostRepository;

    private static final DateTimeFormatter[] DATE_FORMATS = {
                  DateTimeFormatter.ofPattern("yyyy-MM-dd"),
                  DateTimeFormatter.ofPattern("yyyy/MM/dd"),
                  DateTimeFormatter.ofPattern("yyyy.MM.dd"),
    };

    public record UploadResult(int insertedCount, List<String> errors) {
    }

    @FunctionalInterface
        private interface RowHandler {
                  void handle(Row row, int rowNum) throws Exception;
        }

    @Transactional
        public UploadResult uploadSales(MultipartFile file, Long companyId, String createdBy) {
                  List<String> errors = new ArrayList<>();
                  List<FieldSalesEntry> entries = new ArrayList<>();
                  eachRow(file, errors, (row, rowNum) -> {
                                LocalDate entryDate = requireDate(row.getCell(3), "entryDate");
                                entries.add(FieldSalesEntry.builder()
                                                                .companyId(companyId)
                                                                .brandId(readLong(row.getCell(0)))
                                                                .productId(readLong(row.getCell(1)))
                                                                .channelName(readString(row.getCell(2)))
                                                                .entryDate(entryDate)
                                                                .quantity(readInt(row.getCell(4)))
                                                                .salesAmount(readDecimal(row.getCell(5)))
                                                                .costAmount(readDecimal(row.getCell(6)))
                                                                .memo(readString(row.getCell(7)))
                                                                .createdBy(createdBy)
                                                                .build());
                  });
                  salesRepository.saveAll(entries);
                  return new UploadResult(entries.size(), errors);
        }

    @Transactional
        public UploadResult uploadAdCosts(MultipartFile file, Long companyId, String createdBy) {
                  List<String> errors = new ArrayList<>();
                  List<FieldAdCostEntry> entries = new ArrayList<>();
                  eachRow(file, errors, (row, rowNum) -> {
                                LocalDate entryDate = requireDate(row.getCell(3), "entryDate");
                                entries.add(FieldAdCostEntry.builder()
                                                                .companyId(companyId)
                                                                .brandId(readLong(row.getCell(0)))
                                                                .productId(readLong(row.getCell(1)))
                                                                .channelName(readString(row.getCell(2)))
                                                                .entryDate(entryDate)
                                                                .adCostAmount(readDecimal(row.getCell(4)))
                                                                .impressions(readInt(row.getCell(5)))
                                                                .clicks(readInt(row.getCell(6)))
                                                                .conversions(readInt(row.getCell(7)))
                                                                .memo(readString(row.getCell(8)))
                                                                .createdBy(createdBy)
                                                                .build());
                  });
                  adCostRepository.saveAll(entries);
                  return new UploadResult(entries.size(), errors);
        }

    @Transactional
        public UploadResult uploadInventory(MultipartFile file, Long companyId, String createdBy) {
                  List<String> errors = new ArrayList<>();
                  List<FieldInventoryOrderEntry> entries = new ArrayList<>();
                  eachRow(file, errors, (row, rowNum) -> {
                                String entryType = mapEntryType(readString(row.getCell(2)));
                                LocalDate entryDate = requireDate(row.getCell(3), "entryDate");
                                entries.add(FieldInventoryOrderEntry.builder()
                                                                .companyId(companyId)
                                                                .brandId(readLong(row.getCell(0)))
                                                                .productId(readLong(row.getCell(1)))
                                                                .entryType(entryType)
                                                                .entryDate(entryDate)
                                                                .quantity(readInt(row.getCell(4)))
                                                                .memo(readString(row.getCell(5)))
                                                                .createdBy(createdBy)
                                                                .build());
                  });
                  inventoryRepository.saveAll(entries);
                  return new UploadResult(entries.size(), errors);
        }

    @Transactional
        public UploadResult uploadOtherCosts(MultipartFile file, Long companyId, String createdBy) {
                  List<String> errors = new ArrayList<>();
                  List<FieldOtherCostEntry> entries = new ArrayList<>();
                  eachRow(file, errors, (row, rowNum) -> {
                                String costCategory = readString(row.getCell(2));
                                if (costCategory == null || costCategory.isBlank()) {
                                                  throw new IllegalArgumentException("costCategory is blank");
                                }
                                LocalDate entryDate = requireDate(row.getCell(3), "entryDate");
                                entries.add(FieldOtherCostEntry.builder()
                                                                .companyId(companyId)
                                                                .brandId(readLong(row.getCell(0)))
                                                                .productId(readLong(row.getCell(1)))
                                                                .costCategory(costCategory)
                                                                .entryDate(entryDate)
                                                                .amount(readDecimal(row.getCell(4)))
                                                                .memo(readString(row.getCell(5)))
                                                                .createdBy(createdBy)
                                                                .build());
                  });
                  otherCostRepository.saveAll(entries);
                  return new UploadResult(entries.size(), errors);
        }

    public byte[] buildSalesTemplate() {
              return buildTemplate(
                                new String[]{"brandId", "productId", "channelName", "entryDate", "quantity", "salesAmount", "costAmount", "memo"},
                                    new Object[]{1, 101, "own-mall", "2026-07-01", 10, 250000, 150000, "sample row, please replace with real data"});
    }

    public byte[] buildAdCostTemplate() {
              return buildTemplate(
                                new String[]{"brandId", "productId", "channelName", "entryDate", "adCostAmount", "impressions", "clicks", "conversions", "memo"},
                                new Object[]{1, 101, "naver-gfa", "2026-07-01", 50000, 12000, 340, 15, "sample row, please replace with real data"});
    }

    public byte[] buildInventoryTemplate() {
              return buildTemplate(
                                new String[]{"brandId", "productId", "entryType(inbound/outbound/order request)", "entryDate", "quantity", "memo"},
                                new Object[]{1, 101, "inbound", "2026-07-01", 100, "sample row, please replace with real data"});
    }

    public byte[] buildOtherCostTemplate() {
              return buildTemplate(
                                new String[]{"brandId", "productId", "costCategory", "entryDate", "amount", "memo"},
                                new Object[]{1, 101, "logistics", "2026-07-01", 30000, "sample row, please replace with real data"});
    }

    private byte[] buildTemplate(String[] headers, Object[] sampleRow) {
              try (Workbook workbook = new XSSFWorkbook()) {
                            Sheet sheet = workbook.createSheet("data");
                            Row headerRow = sheet.createRow(0);
                            for (int i = 0; i < headers.length; i++) {
                                              headerRow.createCell(i).setCellValue(headers[i]);
                            }
                            Row sample = sheet.createRow(1);
                            for (int i = 0; i < sampleRow.length; i++) {
                                              Object value = sampleRow[i];
                                              Cell cell = sample.createCell(i);
                                              if (value instanceof Number number) {
                                                                    cell.setCellValue(number.doubleValue());
                                              } else {
                                                                    cell.setCellValue(String.valueOf(value));
                                              }
                            }
                            ByteArrayOutputStream out = new ByteArrayOutputStream();
                            workbook.write(out);
                            return out.toByteArray();
              } catch (IOException e) {
                            throw new IllegalStateException("failed to build template", e);
              }
    }

    private void eachRow(MultipartFile file, List<String> errors, RowHandler handler) {
              if (file == null || file.isEmpty()) {
                            throw new IllegalArgumentException("uploaded file is empty");
              }
              try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
                            Sheet sheet = workbook.getSheetAt(0);
                            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                                              Row row = sheet.getRow(i);
                                              if (row == null || isRowEmpty(row)) {
                                                                    continue;
                                              }
                                              int rowNum = i + 1;
                                              try {
                                                                    handler.handle(row, rowNum);
                                              } catch (Exception ex) {
                                                                    errors.add(rowNum + ": " + ex.getMessage());
                                              }
                            }
              } catch (IOException e) {
                            throw new IllegalArgumentException("failed to read excel file, please check xlsx/xls format");
              }
    }

    private boolean isRowEmpty(Row row) {
              for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
                            Cell cell = row.getCell(c);
                            if (cell != null && cell.getCellType() != CellType.BLANK) {
                                              String value = readString(cell);
                                              if (value != null && !value.isBlank()) {
                                                                    return false;
                                              }
                            }
              }
              return true;
    }

    private String mapEntryType(String rawValue) {
              if (rawValue == null) {
                            throw new IllegalArgumentException("entryType is blank");
              }
              String value = rawValue.trim().toUpperCase();
              return switch (value) {
                case "INBOUND" -> "INBOUND";
                case "OUTBOUND" -> "OUTBOUND";
                case "ORDER_REQUEST", "ORDER REQUEST" -> "ORDER_REQUEST";
                              default -> throw new IllegalArgumentException("unknown entryType: " + rawValue);
              };
    }

    private String readString(Cell cell) {
              if (cell == null) return null;
              switch (cell.getCellType()) {
                case STRING:
                                  return cell.getStringCellValue().trim();
                case NUMERIC:
                                  double value = cell.getNumericCellValue();
                                  return value == Math.floor(value) ? String.valueOf((long) value) : String.valueOf(value);
                case BOOLEAN:
                                  return String.valueOf(cell.getBooleanCellValue());
                case FORMULA:
                                  return cell.getCellFormula();
                default:
                                  return null;
              }
    }

    private Long readLong(Cell cell) {
              String value = readString(cell);
              if (value == null || value.isBlank()) return null;
              try {
                            return Long.parseLong(value.replace(",", "").trim());
              } catch (NumberFormatException e) {
                            return null;
              }
    }

    private Integer readInt(Cell cell) {
              String value = readString(cell);
              if (value == null || value.isBlank()) return 0;
              try {
                            return (int) Double.parseDouble(value.replace(",", "").trim());
              } catch (NumberFormatException e) {
                            return 0;
              }
    }

    private BigDecimal readDecimal(Cell cell) {
              String value = readString(cell);
              if (value == null || value.isBlank()) return BigDecimal.ZERO;
              try {
                            return new BigDecimal(value.replace(",", "").trim());
              } catch (NumberFormatException e) {
                            return BigDecimal.ZERO;
              }
    }

    private LocalDate requireDate(Cell cell, String fieldLabel) {
              if (cell == null) {
                            throw new IllegalArgumentException(fieldLabel + " is blank");
              }
              if (cell.getCellType() == CellType.NUMERIC) {
                            try {
                                              return cell.getLocalDateTimeCellValue().toLocalDate();
                            } catch (Exception e) {
                                              // fall through to string parsing below
                            }
              }
              String raw = readString(cell);
              if (raw == null || raw.isBlank()) {
                            throw new IllegalArgumentException(fieldLabel + " is blank");
              }
              for (DateTimeFormatter formatter : DATE_FORMATS) {
                            try {
                                              return LocalDate.parse(raw.trim(), formatter);
                            } catch (Exception ignored) {
                                              // try next format
                            }
              }
              throw new IllegalArgumentException(fieldLabel + " format not recognized: " + raw);
    }
  }
