function indentBlock(content: string, indent: string): string {
    return content
        .split('\n')
        .map((line) => (line.length > 0 ? `${indent}${line}` : line))
        .join('\n');
}

export const DEFAULT_JAVA_PROBE_LABEL = 'debughub_probe';
export const DEFAULT_JAVA_HYPOTHESIS_ID = 'H1';

export function buildJavaInlineImports(): string[] {
    return [
        'import java.lang.reflect.Array;',
        'import java.net.URI;',
        'import java.net.http.HttpClient;',
        'import java.net.http.HttpRequest;',
        'import java.net.http.HttpResponse;',
        'import java.time.Duration;',
        'import java.time.Instant;',
        'import java.util.Iterator;',
        'import java.util.Map;',
    ];
}

export function buildJavaInlineMembers(): string {
    return INLINE_MEMBERS.trim();
}

export function buildJavaSampleCall(
    label: string = DEFAULT_JAVA_PROBE_LABEL,
    hypothesisId: string = DEFAULT_JAVA_HYPOTHESIS_ID
): string {
    return `debugHubEmit("${label}", Map.of("step", "before-query"), Map.of("hypothesisId", "${hypothesisId}", "level", "info"));`;
}

export function buildJavaHelperClass(packageName: string | null, className = 'DebugHubProbe'): string {
    const headerLines = [...buildJavaInlineImports()];
    if (packageName) {
        headerLines.unshift(`package ${packageName};`, '');
    }

    const classBody = [
        `public final class ${className} {`,
        `    private ${className}() {}`,
        '',
        indentBlock(ALIAS_METHODS.trim(), '    '),
        '',
        indentBlock(buildJavaInlineMembers(), '    '),
        '}',
    ].join('\n');

    return `${headerLines.join('\n')}\n\n${classBody}\n`;
}

export function buildVendoredJavaHelper(packageName: string | null, className = 'DebugProbe'): string {
    const headerLines = [...buildJavaInlineImports()];
    if (packageName) {
        headerLines.unshift(`package ${packageName};`, '');
    }

    const classBody = [
        `public final class ${className} {`,
        `    private ${className}() {}`,
        '',
        indentBlock(ALIAS_METHODS.trim(), '    '),
        '',
        indentBlock(buildJavaInlineMembers(), '    '),
        '}',
    ].join('\n');

    return `${headerLines.join('\n')}\n\n${classBody}\n`;
}

const ALIAS_METHODS = `
public static void probe(String label, Object data, Map<String, ?> meta) {
    debugHubEmit(label, data, meta);
}

public static void probe(String label) {
    debugHubEmit(label, null, null);
}

public static void debugProbe(String label, Object data, Map<String, ?> meta) {
    debugHubEmit(label, data, meta);
}

public static void debugProbe(String label) {
    debugHubEmit(label, null, null);
}
`;

const INLINE_MEMBERS = String.raw`
private static final HttpClient DEBUGHUB_HTTP_CLIENT = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build();

private static void debugHubEmit(String label, Object data, Map<String, ?> meta) {
    try {
        if (!"1".equals(System.getenv("DEBUGHUB_ENABLED"))) {
            return;
        }

        String sessionId = System.getenv("DEBUGHUB_SESSION");
        String endpoint = System.getenv("DEBUGHUB_ENDPOINT");
        if (isBlank(sessionId) || isBlank(endpoint)) {
            return;
        }

        String level = "info";
        String hypothesisId = null;
        String loc = null;
        Object tags = null;
        if (meta != null) {
            Object levelValue = meta.get("level");
            if (levelValue instanceof String && isValidLevel((String) levelValue)) {
                level = (String) levelValue;
            }

            hypothesisId = asNullableString(meta.get("hypothesisId"));
            loc = asNullableString(meta.get("loc"));
            if (meta.get("tags") instanceof Map<?, ?>) {
                tags = meta.get("tags");
            }
        }

        StringBuilder json = new StringBuilder();
        json.append('{');
        json.append("\"ts\":").append(toJsonValue(Instant.now().toString())).append(',');
        json.append("\"sessionId\":").append(toJsonValue(sessionId)).append(',');
        json.append("\"label\":").append(toJsonValue(label)).append(',');
        json.append("\"data\":").append(toJsonValue(data)).append(',');
        json.append("\"hypothesisId\":").append(toJsonValue(hypothesisId)).append(',');
        json.append("\"loc\":").append(toJsonValue(loc)).append(',');
        json.append("\"level\":").append(toJsonValue(level)).append(',');
        json.append("\"tags\":").append(tags == null ? "null" : toJsonValue(tags)).append(',');
        json.append("\"runtime\":\"java\"");
        json.append('}');

        String targetUrl = endpoint.endsWith("/") ? endpoint + "event" : endpoint + "/event";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(targetUrl))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(2))
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        DEBUGHUB_HTTP_CLIENT
                .sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .exceptionally(error -> null);
    } catch (Exception ignored) {
        // Never throw from debug instrumentation.
    }
}

private static boolean isBlank(String value) {
    return value == null || value.isEmpty();
}

private static boolean isValidLevel(String value) {
    return "info".equals(value) || "warn".equals(value) || "error".equals(value);
}

private static String asNullableString(Object value) {
    return value instanceof String ? (String) value : null;
}

private static String toJsonValue(Object value) {
    if (value == null) {
        return "null";
    }

    if (value instanceof String) {
        return quoteJson((String) value);
    }

    if (value instanceof Number || value instanceof Boolean) {
        return String.valueOf(value);
    }

    if (value instanceof Map<?, ?>) {
        StringBuilder json = new StringBuilder();
        json.append('{');
        Iterator<? extends Map.Entry<?, ?>> iterator = ((Map<?, ?>) value).entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<?, ?> entry = iterator.next();
            json.append(quoteJson(String.valueOf(entry.getKey())));
            json.append(':');
            json.append(toJsonValue(entry.getValue()));
            if (iterator.hasNext()) {
                json.append(',');
            }
        }
        json.append('}');
        return json.toString();
    }

    if (value instanceof Iterable<?>) {
        StringBuilder json = new StringBuilder();
        json.append('[');
        Iterator<?> iterator = ((Iterable<?>) value).iterator();
        while (iterator.hasNext()) {
            json.append(toJsonValue(iterator.next()));
            if (iterator.hasNext()) {
                json.append(',');
            }
        }
        json.append(']');
        return json.toString();
    }

    if (value.getClass().isArray()) {
        StringBuilder json = new StringBuilder();
        json.append('[');
        int length = Array.getLength(value);
        for (int index = 0; index < length; index++) {
            if (index > 0) {
                json.append(',');
            }
            json.append(toJsonValue(Array.get(value, index)));
        }
        json.append(']');
        return json.toString();
    }

    return quoteJson(String.valueOf(value));
}

private static String quoteJson(String value) {
    return "\"" + escapeJson(value) + "\"";
}

private static String escapeJson(String value) {
    StringBuilder escaped = new StringBuilder();
    for (int index = 0; index < value.length(); index++) {
        char character = value.charAt(index);
        switch (character) {
            case '\\':
                escaped.append("\\\\");
                break;
            case '"':
                escaped.append("\\\"");
                break;
            case '\b':
                escaped.append("\\b");
                break;
            case '\f':
                escaped.append("\\f");
                break;
            case '\n':
                escaped.append("\\n");
                break;
            case '\r':
                escaped.append("\\r");
                break;
            case '\t':
                escaped.append("\\t");
                break;
            default:
                if (character < 0x20) {
                    escaped.append(String.format("\\u%04x", (int) character));
                } else {
                    escaped.append(character);
                }
                break;
        }
    }
    return escaped.toString();
}
`;
