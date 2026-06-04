package naeil.dashboard.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {
            "/invite/{code}",
            "/register",
            "/app",
            "/app/**"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
