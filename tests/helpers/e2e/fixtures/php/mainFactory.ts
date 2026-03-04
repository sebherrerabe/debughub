import type { FixtureMode } from '../java/mainFactory';

export function buildPhpMain(mode: FixtureMode): string {
    const labelByMode: Record<FixtureMode, string> = {
        emit: 'php_emit',
        disabled: 'php_disabled',
        missingSession: 'php_missing_session',
        badEndpoint: 'php_bad_endpoint',
    };

    return [
        '<?php',
        "require_once __DIR__ . '/DebugProbe.php';",
        '',
        `debugProbe("${labelByMode[mode]}");`,
        '',
    ].join('\n');
}
