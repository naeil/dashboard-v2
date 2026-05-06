package naeil.dashboard.enums;

import java.util.Locale;

public enum IntegrationType {
    PLAYAUTO("플레이오토"),
    NAVER_SMARTSTORE("스마트스토어"),
    COUPANG("쿠팡"),
    ELEVEN_STREET("11번가"),
    AUCTION("옥션"),
    GMARKET("지마켓"),
    KAKAO_TALK_STORE("카카오톡 스토어"),
    IMWEB("아임웹"),
    LOTTE_ON("롯데ON"),
    NONGSAN_SHOPPINGMALL("농수산쇼핑몰"),
    OTHER("기타");

    private final String displayName;

    IntegrationType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static IntegrationType fromShop(String shopName, String shopCode) {
        String normalizedName = normalize(shopName);
        String normalizedCode = normalize(shopCode);

        if (normalizedName.contains("스마트스토어")) {
            return NAVER_SMARTSTORE;
        }
        if (normalizedName.contains("롯데on") || normalizedName.contains("롯데온")) {
            return LOTTE_ON;
        }
        if (normalizedName.contains("농수산쇼핑몰")) {
            return NONGSAN_SHOPPINGMALL;
        }
        if (normalizedName.contains("카카오톡스토어") || normalizedName.contains("카카오톡 스토어")) {
            return KAKAO_TALK_STORE;
        }
        if (normalizedName.contains("지마켓") || normalizedName.contains("g마켓")) {
            return GMARKET;
        }
        if (normalizedName.contains("쿠팡")) {
            return COUPANG;
        }
        if (normalizedName.contains("아임웹")) {
            return IMWEB;
        }
        if (normalizedName.contains("옥션")) {
            return AUCTION;
        }
        if (normalizedName.contains("11번가")) {
            return ELEVEN_STREET;
        }
        if (normalizedCode.equals("A000") || normalizedName.contains("직접입력")) {
            return OTHER;
        }

        return OTHER;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
