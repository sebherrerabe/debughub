import type { FixtureMode } from '../java/mainFactory';

export function buildPythonMain(mode: FixtureMode): string {
    const labelByMode: Record<FixtureMode, string> = {
        emit: 'python_emit',
        disabled: 'python_disabled',
        missingSession: 'python_missing_session',
        badEndpoint: 'python_bad_endpoint',
    };

    return [
        'from debugProbe import debugProbe',
        '',
        `debugProbe("${labelByMode[mode]}")`,
        '',
    ].join('\n');
}
