export type FixtureMode = 'emit' | 'disabled' | 'missingSession' | 'badEndpoint';

export function buildJavaMain(): string {
    return [
        'import debughub.DebugProbe;',
        '',
        'public class Main {',
        '    public static void main(String[] args) {',
        '        String mode = args.length > 0 ? args[0] : "emit";',
        '        if ("emit".equals(mode)) {',
        '            DebugProbe.debugProbe("java_emit");',
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
        '        if ("badEndpoint".equals(mode)) {',
        '            DebugProbe.debugProbe("java_bad_endpoint");',
        '        }',
        '    }',
        '}',
        '',
    ].join('\n');
}
