package naeil.dashboard.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.LoadState;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
public class NaverBlogPublisher {

    private static final Path STORAGE_PATH = Paths.get(System.getProperty("user.home"), ".naeil", "naver-session.json");

    public void publish(String title, String content, String hashtags, String naverUsername, String naverPassword,
                        List<MultipartFile> images, List<MultipartFile> videos) {
        if (naverUsername == null || naverUsername.isBlank()) {
            throw new CustomException(400, "네이버 아이디를 입력하세요.");
        }
        if (naverPassword == null || naverPassword.isBlank()) {
            throw new CustomException(400, "네이버 비밀번호를 입력하세요.");
        }

        String fullContent = content + "\n\n" + (hashtags != null ? hashtags : "");

        try (Playwright playwright = Playwright.create()) {
            BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                    .setHeadless(false)
                    .setSlowMo(150);

            try (Browser browser = playwright.chromium().launch(launchOptions)) {
                Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                        .setViewportSize(1280, 900)
                        .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

                if (Files.exists(STORAGE_PATH)) {
                    contextOptions.setStorageStatePath(STORAGE_PATH);
                }

                // 첨부파일 임시 저장
                List<Path> tempFiles = saveTempFiles(images, videos);
                try (BrowserContext context = browser.newContext(contextOptions)) {
                    Page page = context.newPage();
                    ensureLoggedIn(page, context, naverUsername, naverPassword);
                    writePost(page, title, fullContent, tempFiles);
                } finally {
                    // 임시 파일 삭제
                    tempFiles.forEach(p -> { try { Files.deleteIfExists(p); } catch (Exception ignored) {} });
                }
            }
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("네이버 블로그 발행 실패", e);
            throw new CustomException(500, "네이버 블로그 발행에 실패했습니다: " + e.getMessage());
        }
    }

    private void ensureLoggedIn(Page page, BrowserContext context, String username, String password) throws Exception {
        page.navigate("https://www.naver.com");
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);

        boolean isLoggedIn = page.locator("a[href*='nidlogin']").count() == 0;

        if (!isLoggedIn) {
            log.info("네이버 로그인 시작");
            doLogin(page, username, password);
            Files.createDirectories(STORAGE_PATH.getParent());
            context.storageState(new BrowserContext.StorageStateOptions().setPath(STORAGE_PATH));
            log.info("네이버 세션 저장 완료");
        } else {
            log.info("기존 세션으로 로그인됨");
        }
    }

    private void doLogin(Page page, String username, String password) {
        page.navigate("https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com");
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);

        page.locator("#id").click();
        page.waitForTimeout(500);
        page.evaluate("(v) => { document.querySelector('#id').value = v; }", username);
        page.locator("#id").press("Tab");
        page.waitForTimeout(300);

        page.locator("#pw").click();
        page.waitForTimeout(500);
        page.evaluate("(v) => { document.querySelector('#pw').value = v; }", password);
        page.locator("#pw").press("Tab");
        page.waitForTimeout(300);

        page.locator("#log\\.login").click();
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
        page.waitForTimeout(2000);

        if (page.url().contains("nidlogin") || page.url().contains("login")) {
            String errorText = page.locator(".error_message").count() > 0
                    ? page.locator(".error_message").first().textContent()
                    : "로그인 페이지에 머물러 있습니다.";
            throw new CustomException(401, "네이버 로그인 실패: " + errorText);
        }

        log.info("네이버 로그인 성공 — 현재 URL: {}", page.url());
    }

    private List<Path> saveTempFiles(List<MultipartFile> images, List<MultipartFile> videos) {
        List<Path> paths = new ArrayList<>();
        try {
            Path tempDir = Files.createTempDirectory("naeil-blog-");
            if (images != null) {
                for (MultipartFile f : images) {
                    if (f != null && !f.isEmpty()) {
                        Path p = tempDir.resolve(f.getOriginalFilename() != null ? f.getOriginalFilename() : "image.jpg");
                        f.transferTo(p);
                        paths.add(p);
                    }
                }
            }
            if (videos != null) {
                for (MultipartFile f : videos) {
                    if (f != null && !f.isEmpty()) {
                        Path p = tempDir.resolve(f.getOriginalFilename() != null ? f.getOriginalFilename() : "video.mp4");
                        f.transferTo(p);
                        paths.add(p);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("첨부파일 임시 저장 실패", e);
        }
        return paths;
    }

    private void writePost(Page page, String title, String content, List<Path> attachments) {
        page.navigate("https://blog.naver.com/PostWriteForm.naver");
        page.waitForLoadState(LoadState.LOAD);
        page.waitForTimeout(3000);

        fillTitle(page, title);
        fillContent(page, content);

        // 첨부파일 삽입
        if (attachments != null && !attachments.isEmpty()) {
            insertAttachments(page, attachments);
        }

        publishPost(page);
    }

    private void insertAttachments(Page page, List<Path> files) {
        for (Path file : files) {
            try {
                String fileName = file.getFileName().toString().toLowerCase();
                boolean isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".avi");

                if (isVideo) {
                    // 동영상 업로드 버튼 클릭
                    var videoBtn = page.locator("button[data-type='video'], .se-toolbar-item-video, button:has-text('동영상')").first();
                    if (videoBtn.count() > 0) {
                        page.onFileChooser(fc -> fc.setFiles(file));
                        videoBtn.click();
                        page.waitForTimeout(3000);
                        log.info("동영상 첨부: {}", file.getFileName());
                    }
                } else {
                    // 이미지 업로드 버튼 클릭
                    var imgBtn = page.locator("button[data-type='image'], .se-toolbar-item-image, button:has-text('사진')").first();
                    if (imgBtn.count() == 0) {
                        // iframe 내부 시도
                        for (Frame frame : page.frames()) {
                            imgBtn = frame.locator("button[data-type='image'], .se-toolbar-item-image").first();
                            if (imgBtn.count() > 0) break;
                        }
                    }
                    if (imgBtn.count() > 0) {
                        page.onFileChooser(fc -> fc.setFiles(file));
                        imgBtn.click();
                        page.waitForTimeout(2000);
                        log.info("이미지 첨부: {}", file.getFileName());
                    }
                }
            } catch (Exception e) {
                log.warn("첨부파일 삽입 실패: {}", file.getFileName(), e);
            }
        }
    }

    private void fillTitle(Page page, String title) {
        String[] titleSelectors = {
                ".se-title-input",
                ".tit_area .input_tit",
                "input[placeholder*='제목']",
                "#subject",
        };

        for (String selector : titleSelectors) {
            try {
                var locator = page.locator(selector).first();
                if (locator.count() > 0) {
                    locator.click();
                    locator.fill(title);
                    log.info("제목 입력 완료 (selector: {})", selector);
                    return;
                }
            } catch (Exception e) {
                log.debug("제목 셀렉터 실패: {}", selector);
            }
        }

        for (Frame frame : page.frames()) {
            try {
                var el = frame.locator(".se-title-input, input[placeholder*='제목']").first();
                if (el.count() > 0) {
                    el.click();
                    el.fill(title);
                    log.info("iframe 내 제목 입력 완료");
                    return;
                }
            } catch (Exception ignored) {}
        }

        throw new CustomException(500, "블로그 제목 입력 필드를 찾을 수 없습니다.");
    }

    private void fillContent(Page page, String content) {
        page.waitForTimeout(1500);

        String[] contentSelectors = {
                ".se-main-container",
                ".se-content",
                ".se2_inputarea",
                "[contenteditable='true']",
        };

        for (String selector : contentSelectors) {
            try {
                var locator = page.locator(selector).first();
                if (locator.count() > 0) {
                    locator.click();
                    page.waitForTimeout(500);
                    page.keyboard().type(content, new com.microsoft.playwright.Keyboard.TypeOptions().setDelay(10));
                    log.info("본문 입력 완료 (selector: {})", selector);
                    return;
                }
            } catch (Exception e) {
                log.debug("본문 셀렉터 실패: {}", selector);
            }
        }

        for (Frame frame : page.frames()) {
            try {
                var el = frame.locator(".se-main-container, [contenteditable='true']").first();
                if (el.count() > 0) {
                    el.click();
                    page.waitForTimeout(500);
                    page.keyboard().type(content, new com.microsoft.playwright.Keyboard.TypeOptions().setDelay(10));
                    log.info("iframe 내 본문 입력 완료");
                    return;
                }
            } catch (Exception ignored) {}
        }

        throw new CustomException(500, "블로그 본문 입력 필드를 찾을 수 없습니다.");
    }

    private void publishPost(Page page) {
        page.waitForTimeout(1000);

        String[] publishSelectors = {
                "button:has-text('발행')",
                ".btn_publish",
                "#publish-btn",
                "button.publish",
                "a:has-text('발행')",
        };

        for (String selector : publishSelectors) {
            try {
                var locator = page.locator(selector).first();
                if (locator.count() > 0) {
                    locator.click();
                    page.waitForTimeout(2000);

                    var confirmBtn = page.locator("button:has-text('확인'), button:has-text('발행하기'), .btn_confirm").first();
                    if (confirmBtn.count() > 0) {
                        confirmBtn.click();
                        page.waitForTimeout(2000);
                    }

                    log.info("블로그 발행 완료");
                    return;
                }
            } catch (Exception e) {
                log.debug("발행 셀렉터 실패: {}", selector);
            }
        }

        throw new CustomException(500, "발행 버튼을 찾을 수 없습니다.");
    }
}
