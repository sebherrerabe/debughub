package debughub;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

public final class DebugProbe {

    private static final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    public static void probe(String label, Object data, Map<String, String> meta) {
        sendEvent(label, data, meta);
    }

    public static void probe(String label) {
        sendEvent(label, null, null);
    }

    public static void debugProbe(String label, Object data, Map<String, String> meta) {
        sendEvent(label, data, meta);
    }

    public static void debugProbe(String label) {
        sendEvent(label, null, null);
    }

    private static void sendEvent(String label, Object data, Map<String, String> meta) {
        try {
            String isEnabled = System.getenv("DEBUGHUB_ENABLED");
            String sessionId = System.getenv("DEBUGHUB_SESSION");

            if (!"1".equals(isEnabled) || sessionId == null || sessionId.isEmpty()) {
                return;
            }

            String endpoint = System.getenv("DEBUGHUB_ENDPOINT");
            if (endpoint == null || endpoint.isEmpty()) {
                return;
            }

            String level = "info";
            String hypothesisId = null;
            String loc = null;
            String tagsJson = null;
            if (meta != null) {
                if (meta.get("level") != null && !meta.get("level").isEmpty()) {
                    level = meta.get("level");
                }
                hypothesisId = meta.get("hypothesisId");
                loc = meta.get("loc");
                tagsJson = meta.get("tags");
            }

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"ts\":\"").append(escapeJson(Instant.now().toString())).append("\",");
            json.append("\"sessionId\":\"").append(escapeJson(sessionId)).append("\",");
            json.append("\"label\":\"").append(escapeJson(label)).append("\",");
            if (data == null) {
                json.append("\"data\":null,");
            } else {
                json.append("\"data\":\"").append(escapeJson(data.toString())).append("\",");
            }
            json.append("\"hypothesisId\":").append(asJsonStringOrNull(hypothesisId)).append(",");
            json.append("\"loc\":").append(asJsonStringOrNull(loc)).append(",");
            json.append("\"level\":\"").append(escapeJson(level)).append("\",");
            if (tagsJson == null || tagsJson.isEmpty()) {
                json.append("\"tags\":null,");
            } else {
                json.append("\"tags\":").append(tagsJson).append(",");
            }
            json.append("\"runtime\":\"java\",");
            json.append("\"thread\":\"").append(escapeJson(Thread.currentThread().getName())).append("\"");
            json.append("}");

            String targetUrl = endpoint.endsWith("/") ? endpoint + "event" : endpoint + "/event";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(2))
                    .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                    .build();

            client.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            // Never throw from helper
        }
    }

    private static String asJsonStringOrNull(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + escapeJson(value) + "\"";
    }

    private static String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }
}
