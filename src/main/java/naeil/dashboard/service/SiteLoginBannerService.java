package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.SiteLoginBanner;
import naeil.dashboard.repository.SiteLoginBannerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages the login-page banner image shown on the left panel of the login
 * screen and updated from the platform admin console. Additive-only service.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SiteLoginBannerService {

    private static final int MAX_IMAGE_LENGTH = 3_000_000;

    private final SiteLoginBannerRepository bannerRepository;

    public SiteLoginBanner getBanner(Long companyId) {
        return bannerRepository.findByCompanyId(companyId).orElse(null);
    }

    public SiteLoginBanner saveBanner(Long companyId, String updatedBy, String imageData) {
        if (imageData != null && imageData.length() > MAX_IMAGE_LENGTH) {
            throw new IllegalArgumentException("이미지 용량이 너무 큽니다. 더 작은 이미지를 사용해주세요.");
        }
        SiteLoginBanner banner = bannerRepository.findByCompanyId(companyId)
            .orElseGet(() -> SiteLoginBanner.builder().companyId(companyId).build());
        banner.setImageData(imageData);
        banner.setUpdatedBy(updatedBy);
        return bannerRepository.save(banner);
    }
}
