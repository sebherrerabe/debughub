import type { FixtureMode } from '../java/mainFactory';

export function buildRustMain(mode: FixtureMode): string {
    const labelByMode: Record<FixtureMode, string> = {
        emit: 'rust_emit',
        disabled: 'rust_disabled',
        missingSession: 'rust_missing_session',
        badEndpoint: 'rust_bad_endpoint',
    };

    return [
        'mod debug_probe;',
        '',
        'use debug_probe::debug_probe;',
        '',
        'fn main() {',
        `    debug_probe("${labelByMode[mode]}", None, None);`,
        '}',
        '',
    ].join('\n');
}
