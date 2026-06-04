package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BlogGenerateRequest;
import naeil.dashboard.dto.BlogGenerateResponse;
import naeil.dashboard.service.BlogService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/marketing/blog")
@RequiredArgsConstructor
public class BlogController {

    private final BlogService blogService;

    @PostMapping("/generate")
    public ResponseEntity<BlogGenerateResponse> generate(@RequestBody BlogGenerateRequest request) {
        return ResponseEntity.ok(blogService.generate(request));
    }

    @PostMapping(value = "/publish", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> publish(
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String hashtags,
            @RequestParam String naverUsername,
            @RequestParam String naverPassword,
            @RequestParam(required = false) List<MultipartFile> images,
            @RequestParam(required = false) List<MultipartFile> videos
    ) {
        return ResponseEntity.ok(blogService.publish(title, content, hashtags, naverUsername, naverPassword, images, videos));
    }
}
