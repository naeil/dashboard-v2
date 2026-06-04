package naeil.dashboard.service;

import jakarta.mail.BodyPart;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeUtility;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import naeil.dashboard.dto.MailItemResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MailService {

    private static final String IMAP_HOST = "imap.daouoffice.com";
    private static final int IMAP_PORT = 993;
    private static final int PREVIEW_LENGTH = 100;

    public List<MailItemResponse> getMails(String loginId, String password, int page, int size) {
        return getMails(loginId, password, "inbox", page, size);
    }

    public List<MailItemResponse> getMails(String loginId, String password, String folderType, int page, int size) {
        return getMails(loginId, password, IMAP_HOST, folderType, page, size);
    }

    public List<MailItemResponse> getMails(String loginId, String password, String host, String folderType, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);
        String resolvedHost = resolveHost(host);

        Properties props = new Properties();
        props.put("mail.store.protocol", "imaps");
        props.put("mail.imaps.host", resolvedHost);
        props.put("mail.imaps.port", String.valueOf(IMAP_PORT));
        props.put("mail.imaps.ssl.enable", "true");
        props.put("mail.imaps.connectiontimeout", "10000");
        props.put("mail.imaps.timeout", "10000");
        props.put("mail.imaps.writetimeout", "10000");

        Store store = null;
        Folder inbox = null;
        try {
            Session mailSession = Session.getInstance(props);
            store = mailSession.getStore("imaps");
            store.connect(resolvedHost, IMAP_PORT, loginId, password);

            inbox = resolveFolder(store, folderType);
            if (!inbox.exists()) {
                return List.of();
            }
            inbox.open(Folder.READ_ONLY);

            int total = inbox.getMessageCount();
            int end = total - (safePage * safeSize);
            if (end <= 0) {
                return List.of();
            }
            int start = Math.max(1, end - safeSize + 1);

            Message[] messages = inbox.getMessages(start, end);
            List<MailItemResponse> result = new ArrayList<>(messages.length);
            for (Message message : messages) {
                result.add(toResponse(message));
            }
            Collections.reverse(result);
            return result;
        } catch (AuthenticationFailedException e) {
            throw new MailConnectionException("다우오피스 메일 ID 또는 비밀번호가 맞지 않습니다.", e);
        } catch (MessagingException e) {
            throw new MailConnectionException(toConnectionMessage(e), e);
        } catch (IOException e) {
            throw new MailConnectionException("메일 본문을 읽는 중 오류가 발생했습니다.", e);
        } finally {
            closeQuietly(inbox);
            closeQuietly(store);
        }
    }

    public void validateConnection(String loginId, String password) {
        validateConnection(loginId, password, IMAP_HOST);
    }

    public void validateConnection(String loginId, String password, String host) {
        String resolvedHost = resolveHost(host);
        Properties props = new Properties();
        props.put("mail.store.protocol", "imaps");
        props.put("mail.imaps.host", resolvedHost);
        props.put("mail.imaps.port", String.valueOf(IMAP_PORT));
        props.put("mail.imaps.ssl.enable", "true");
        props.put("mail.imaps.connectiontimeout", "10000");
        props.put("mail.imaps.timeout", "10000");
        props.put("mail.imaps.writetimeout", "10000");

        Store store = null;
        try {
            Session mailSession = Session.getInstance(props);
            store = mailSession.getStore("imaps");
            store.connect(resolvedHost, IMAP_PORT, loginId, password);
        } catch (AuthenticationFailedException e) {
            throw new MailConnectionException("다우오피스 메일 ID 또는 비밀번호가 맞지 않습니다.", e);
        } catch (MessagingException e) {
            throw new MailConnectionException(toConnectionMessage(e), e);
        } finally {
            closeQuietly(store);
        }
    }

    private Folder resolveFolder(Store store, String folderType) throws MessagingException {
        if (!"sent".equalsIgnoreCase(folderType)) {
            return store.getFolder("INBOX");
        }

        String[] sentCandidates = {
                "Sent",
                "Sent Messages",
                "Sent Items",
                "보낸편지함",
                "보낸 메일함",
                "보낸메일함"
        };
        for (String folderName : sentCandidates) {
            Folder folder = store.getFolder(folderName);
            if (folder.exists()) {
                return folder;
            }
        }
        return store.getFolder("Sent");
    }

    private MailItemResponse toResponse(Message message) throws MessagingException, IOException {
        String preview = normalize(extractText(message));
        return new MailItemResponse(
                decode(message.getSubject()),
                formatFrom(message),
                message.getReceivedDate() != null ? message.getReceivedDate().toInstant() : Instant.EPOCH,
                message.isSet(Flags.Flag.SEEN),
                preview.length() > PREVIEW_LENGTH ? preview.substring(0, PREVIEW_LENGTH) : preview
        );
    }

    private String formatFrom(Message message) throws MessagingException {
        if (message.getFrom() == null || message.getFrom().length == 0) {
            return "";
        }
        if (message.getFrom()[0] instanceof InternetAddress address) {
            String personal = decode(address.getPersonal());
            return personal == null || personal.isBlank() ? address.getAddress() : personal + " <" + address.getAddress() + ">";
        }
        return decode(message.getFrom()[0].toString());
    }

    private String extractText(Object part) throws MessagingException, IOException {
        if (part instanceof Message message) {
            return extractTextFromPart(message);
        }
        if (part instanceof BodyPart bodyPart) {
            return extractTextFromPart(bodyPart);
        }
        return "";
    }

    private String extractTextFromPart(jakarta.mail.Part part) throws MessagingException, IOException {
        if (part.isMimeType("text/plain")) {
            Object content = part.getContent();
            return content != null ? content.toString() : "";
        }
        if (part.isMimeType("text/html")) {
            Object content = part.getContent();
            return content != null ? stripHtml(content.toString()) : "";
        }
        if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            String htmlFallback = "";
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart bodyPart = multipart.getBodyPart(i);
                String text = extractText(bodyPart);
                if (bodyPart.isMimeType("text/plain") && !text.isBlank()) {
                    return text;
                }
                if (htmlFallback.isBlank() && !text.isBlank()) {
                    htmlFallback = text;
                }
            }
            return htmlFallback;
        }
        return "";
    }

    private String decode(String value) {
        if (value == null) {
            return "";
        }
        try {
            return MimeUtility.decodeText(value);
        } catch (Exception ignored) {
            return value;
        }
    }

    private String stripHtml(String value) {
        return value.replaceAll("(?is)<(script|style).*?>.*?</\\1>", " ")
                .replaceAll("(?s)<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">");
    }

    private String normalize(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String resolveHost(String host) {
        if (!StringUtils.hasText(host)) {
            return IMAP_HOST;
        }
        return host.trim()
                .replace("https://", "")
                .replace("http://", "")
                .replaceAll("/+$", "");
    }

    private String toConnectionMessage(MessagingException e) {
        String raw = e.getMessage() == null ? "" : e.getMessage();
        String lower = raw.toLowerCase();
        if (lower.contains("connect") || lower.contains("timeout") || lower.contains("unknownhost")) {
            return "다우오피스 IMAP 서버에 연결하지 못했습니다. 사내망/방화벽 또는 IMAP 사용 설정을 확인해주세요.";
        }
        if (lower.contains("ssl") || lower.contains("handshake")) {
            return "다우오피스 IMAP SSL 연결에 실패했습니다.";
        }
        if (lower.contains("folder")) {
            return "메일함을 찾지 못했습니다.";
        }
        return "다우오피스 메일 연결에 실패했습니다. " + raw;
    }

    private void closeQuietly(Folder folder) {
        if (folder != null && folder.isOpen()) {
            try {
                folder.close(false);
            } catch (MessagingException ignored) {
            }
        }
    }

    private void closeQuietly(Store store) {
        if (store != null && store.isConnected()) {
            try {
                store.close();
            } catch (MessagingException ignored) {
            }
        }
    }
}
