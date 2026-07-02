package kr.co.highfree.event.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final EventProps eventProps;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String origins = eventProps.getCorsOrigins();
        String[] originList = origins != null ? origins.split(",") : new String[]{"*"};
        registry.addMapping("/api/**")
                .allowedOrigins(originList)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AdminAuthInterceptor(eventProps))
                .addPathPatterns("/api/admin/**");
    }

    public static class AdminAuthInterceptor implements HandlerInterceptor {
        private final EventProps eventProps;

        public AdminAuthInterceptor(EventProps eventProps) {
            this.eventProps = eventProps;
        }

        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
            if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
            String key = request.getHeader("X-Admin-Key");
            if (eventProps.getAdminKey() != null && eventProps.getAdminKey().equals(key)) {
                return true;
            }
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\":\"Unauthorized\"}");
            return false;
        }
    }
}
