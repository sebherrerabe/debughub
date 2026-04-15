import { buildJavaInlineImports, buildJavaInlineMembers } from '../../../../../src/lib/javaEmitter';

export type FixtureMode = 'emit' | 'disabled' | 'missingSession' | 'badEndpoint';
export type JavaFixtureMode = FixtureMode | 'richPayload' | 'inlineEmit';

export function buildJavaMain(): string {
    return [
        'import debughub.DebugProbe;',
        'import java.util.Map;',
        '',
        'public class Main {',
        '    public static void main(String[] args) {',
        '        String mode = args.length > 0 ? args[0] : "emit";',
        '        if ("emit".equals(mode)) {',
        '            DebugProbe.debugProbe("java_emit");',
        '            sleepBriefly();',
        '            return;',
        '        }',
        '        if ("disabled".equals(mode)) {',
        '            DebugProbe.debugProbe("java_disabled");',
        '            return;',
        '        }',
        '        if ("missingSession".equals(mode)) {',
        '            DebugProbe.debugProbe("java_missing_session");',
        '            return;',
        '        }',
        '        if ("richPayload".equals(mode)) {',
        '            DebugProbe.debugProbe(',
        '                "java_emit_with_data",',
        '                Map.of("count", 2, "items", new String[] { "one", "two" }),',
        '                Map.of(',
        '                    "hypothesisId", "H2",',
        '                    "level", "warn",',
        '                    "loc", "Main.java:17",',
        '                    "tags", Map.of("area", "java-helper")',
        '                )',
        '            );',
        '            sleepBriefly();',
        '            return;',
        '        }',
        '        if ("badEndpoint".equals(mode)) {',
        '            DebugProbe.debugProbe("java_bad_endpoint");',
        '            sleepBriefly();',
        '        }',
        '    }',
        '',
        '    private static void sleepBriefly() {',
        '        try {',
        '            Thread.sleep(250L);',
        '        } catch (InterruptedException ignored) {',
        '            Thread.currentThread().interrupt();',
        '        }',
        '    }',
        '}',
        '',
    ].join('\n');
}

export function buildInlineJavaMain(): string {
    return [
        ...buildJavaInlineImports(),
        '',
        'public class Main {',
        indentMembers(buildJavaInlineMembers()),
        '',
        '    public static void main(String[] args) {',
        '        debugHubEmit(',
        '            "java_inline_emit",',
        '            Map.of("path", "inline"),',
        '            Map.of("hypothesisId", "H3", "level", "info", "tags", Map.of("mode", "inline-http"))',
        '        );',
        '        try {',
        '            Thread.sleep(250L);',
        '        } catch (InterruptedException ignored) {',
        '            Thread.currentThread().interrupt();',
        '        }',
        '    }',
        '}',
        '',
    ].join('\n');
}

function indentMembers(content: string): string {
    return content
        .split('\n')
        .map((line) => (line.length > 0 ? `    ${line}` : line))
        .join('\n');
}
