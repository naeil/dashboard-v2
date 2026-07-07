package naeil.dashboard.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.SiteNotice;
import naeil.dashboard.repository.SiteNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages the login-page notice/update board shown on the redesigned login
 * screen and edited from the platform admin console. Additive-only service.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SiteNoticeService {

    private final SiteNoticeRepository noticeRepository;

    public List<SiteNotice> getNotices(Long companyId) {
        return noticeRepository.findAllByCompanyIdOrderByCreatedAtDescIdDesc(companyId);
    }

    public SiteNotice createNotice(Long companyId, String createdBy, SiteNotice payload) {
        payload.setCompanyId(companyId);
        payload.setCreatedBy(createdBy);
        if (payload.getIsNew() == null) {
            payload.setIsNew(true);
        }
        return noticeRepository.save(payload);
    }

    public SiteNotice updateNotice(Long companyId, Long id, SiteNotice payload) {
        SiteNotice existing = noticeRepository.findByIdAndCompanyId(id, companyId)
            .orElseThrow(() -> new IllegalArgumentException("Notice not found: " + id));
        existing.setCategory(payload.getCategory());
        existing.setTitle(payload.getTitle());
        existing.setContent(payload.getContent());
        if (payload.getIsNew() != null) {
            existing.setIsNew(payload.getIsNew());
        }
        return noticeRepository.save(existing);
    }

    public void deleteNotice(Long companyId, Long id) {
        noticeRepository.deleteByIdAndCompanyId(id, companyId);
    }
}
