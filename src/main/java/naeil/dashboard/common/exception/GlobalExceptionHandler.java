package naeil.dashboard.common.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CustomException.class)
    public ResponseEntity<Map<String, Object>> handleCustomException(CustomException e) {
        return ResponseEntity.status(e.getStatus())
                .body(Map.of(
                        "status", e.getStatus(),
                        "message", e.getMessage()
                ));
    }

    /**
     * 업로드 파일이 제한(60MB)을 넘으면 프레임워크가 요청 파싱 단계에서 던진다.
     * 이 핸들러가 없으면 응답 본문이 비어 프론트에 "등록에 실패했습니다"만 떠서 원인을 알 수 없다.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of(
                        "success", false,
                        "status", 413,
                        "message", "파일이 너무 큽니다 (최대 60MB). 이미지가 많은 PPT는 용량을 줄이거나, PDF·텍스트로 저장해서 올려 주세요."
                ));
    }
}
