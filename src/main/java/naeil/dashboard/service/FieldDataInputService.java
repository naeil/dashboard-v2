package naeil.dashboard.service;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * L0 field-input layer service: lets operations staff create, edit and delete the raw
   * sales, ad-cost, inventory/order and other-cost entries described in the
   * "Bottom-up" dashboard proposal. This service is purely additive and does not
   * modify any existing sales/inventory sync logic.
   */
@Service
  @RequiredArgsConstructor
  @Transactional
  public class FieldDataInputService {

private final FieldSalesEntryRepository salesRepository;
    private final FieldAdCostEntryRepository adCostRepository;
    private final FieldInventoryOrderEntryRepository inventoryRepository;
    private final FieldOtherCostEntryRepository otherCostRepository;

// Sales entries

public List<FieldSalesEntry> getSalesEntries(Long companyId) {
  return salesRepository.findAllByCompanyIdOrderByEntryDateDescIdDesc(companyId);
}

public FieldSalesEntry createSalesEntry(Long companyId, String createdBy, FieldSalesEntry payload) {
  payload.setCompanyId(companyId);
  payload.setCreatedBy(createdBy);
  return salesRepository.save(payload);
}

public FieldSalesEntry updateSalesEntry(Long companyId, Long id, FieldSalesEntry payload) {
  FieldSalesEntry existing = salesRepository.findByIdAndCompanyId(id, companyId)
    .orElseThrow(() -> new IllegalArgumentException("Sales entry not found: " + id));
  existing.setBrandId(payload.getBrandId());
  existing.setProductId(payload.getProductId());
  existing.setChannelName(payload.getChannelName());
  existing.setEntryDate(payload.getEntryDate());
  existing.setQuantity(payload.getQuantity());
  existing.setSalesAmount(payload.getSalesAmount());
  existing.setCostAmount(payload.getCostAmount());
  existing.setMemo(payload.getMemo());
  return salesRepository.save(existing);
}

public void deleteSalesEntry(Long companyId, Long id) {
  salesRepository.deleteByIdAndCompanyId(id, companyId);
}

// Ad cost entries

public List<FieldAdCostEntry> getAdCostEntries(Long companyId) {
  return adCostRepository.findAllByCompanyIdOrderByEntryDateDescIdDesc(companyId);
}

public FieldAdCostEntry createAdCostEntry(Long companyId, String createdBy, FieldAdCostEntry payload) {
  payload.setCompanyId(companyId);
  payload.setCreatedBy(createdBy);
  return adCostRepository.save(payload);
}

public FieldAdCostEntry updateAdCostEntry(Long companyId, Long id, FieldAdCostEntry payload) {
  FieldAdCostEntry existing = adCostRepository.findByIdAndCompanyId(id, companyId)
    .orElseThrow(() -> new IllegalArgumentException("Ad cost entry not found: " + id));
  existing.setBrandId(payload.getBrandId());
  existing.setProductId(payload.getProductId());
  existing.setChannelName(payload.getChannelName());
  existing.setEntryDate(payload.getEntryDate());
  existing.setAdCostAmount(payload.getAdCostAmount());
  existing.setImpressions(payload.getImpressions());
  existing.setClicks(payload.getClicks());
  existing.setConversions(payload.getConversions());
  existing.setMemo(payload.getMemo());
  return adCostRepository.save(existing);
}

public void deleteAdCostEntry(Long companyId, Long id) {
  adCostRepository.deleteByIdAndCompanyId(id, companyId);
}

// Inventory / order entries

public List<FieldInventoryOrderEntry> getInventoryEntries(Long companyId) {
  return inventoryRepository.findAllByCompanyIdOrderByEntryDateDescIdDesc(companyId);
}

public FieldInventoryOrderEntry createInventoryEntry(Long companyId, String createdBy, FieldInventoryOrderEntry payload) {
  payload.setCompanyId(companyId);
  payload.setCreatedBy(createdBy);
  return inventoryRepository.save(payload);
}

public FieldInventoryOrderEntry updateInventoryEntry(Long companyId, Long id, FieldInventoryOrderEntry payload) {
  FieldInventoryOrderEntry existing = inventoryRepository.findByIdAndCompanyId(id, companyId)
    .orElseThrow(() -> new IllegalArgumentException("Inventory entry not found: " + id));
  existing.setBrandId(payload.getBrandId());
  existing.setProductId(payload.getProductId());
  existing.setEntryType(payload.getEntryType());
  existing.setEntryDate(payload.getEntryDate());
  existing.setQuantity(payload.getQuantity());
  existing.setMemo(payload.getMemo());
  return inventoryRepository.save(existing);
}

public void deleteInventoryEntry(Long companyId, Long id) {
  inventoryRepository.deleteByIdAndCompanyId(id, companyId);
}

// Other cost entries

public List<FieldOtherCostEntry> getOtherCostEntries(Long companyId) {
  return otherCostRepository.findAllByCompanyIdOrderByEntryDateDescIdDesc(companyId);
}

public FieldOtherCostEntry createOtherCostEntry(Long companyId, String createdBy, FieldOtherCostEntry payload) {
  payload.setCompanyId(companyId);
  payload.setCreatedBy(createdBy);
  return otherCostRepository.save(payload);
}

public FieldOtherCostEntry updateOtherCostEntry(Long companyId, Long id, FieldOtherCostEntry payload) {
  FieldOtherCostEntry existing = otherCostRepository.findByIdAndCompanyId(id, companyId)
    .orElseThrow(() -> new IllegalArgumentException("Other cost entry not found: " + id));
  existing.setBrandId(payload.getBrandId());
  existing.setProductId(payload.getProductId());
  existing.setCostCategory(payload.getCostCategory());
  existing.setEntryDate(payload.getEntryDate());
  existing.setAmount(payload.getAmount());
  existing.setMemo(payload.getMemo());
  return otherCostRepository.save(existing);
}

public void deleteOtherCostEntry(Long companyId, Long id) {
  otherCostRepository.deleteByIdAndCompanyId(id, companyId);
}
  }
