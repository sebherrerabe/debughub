import type { FixtureMode } from '../java/mainFactory';

export function buildGoMain(mode: FixtureMode): string {
    const labelByMode: Record<FixtureMode, string> = {
        emit: 'go_emit',
        disabled: 'go_disabled',
        missingSession: 'go_missing_session',
        badEndpoint: 'go_bad_endpoint',
    };

    return [
        'package main',
        '',
        'func main() {',
        `    DebugProbe("${labelByMode[mode]}", nil, nil)`,
        '}',
        '',
    ].join('\n');
}
