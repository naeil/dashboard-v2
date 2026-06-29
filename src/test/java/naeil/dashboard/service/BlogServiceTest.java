package naeil.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import naeil.dashboard.dto.BlogGenerateRequest;
import org.junit.jupiter.api.Test;

class BlogServiceTest {

    @Test
    void systemPromptExplainsHowToUseBlogGenerationInputs() throws Exception {
        Field field = BlogService.class.getDeclaredField("SYSTEM_PROMPT");
        field.setAccessible(true);

        String prompt = (String) field.get(null);

        assertThat(prompt)
                .contains("주제")
                .contains("SEO 키워드")
                .contains("카테고리")
                .contains("톤앤매너")
                .contains("글 길이");
    }

    @Test
    void userMessageIncludesTopicKeywordsCategoryToneAndLengthGuide() throws Exception {
        BlogService service = new BlogService(null, null, null, new ObjectMapper());
        Method method = BlogService.class.getDeclaredMethod("buildUserMessage", BlogGenerateRequest.class);
        method.setAccessible(true);

        BlogGenerateRequest request = new BlogGenerateRequest(
                "여름 신제품 출시",
                "쿨링 티셔츠, 여름 패션",
                "friendly",
                "medium",
                "제품 소개",
                "GEMINI",
                "gemini-2.5-flash"
        );

        String message = (String) method.invoke(service, request);

        assertThat(message)
                .contains("주제: 여름 신제품 출시")
                .contains("SEO 키워드: 쿨링 티셔츠, 여름 패션")
                .contains("카테고리: 제품 소개")
                .contains("톤앤매너: 친근함")
                .contains("글 길이: 800~1200자");
    }
}
