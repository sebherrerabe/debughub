export type DebugHubEvent = {
    ts: string;
    sessionId: string;
    label: string;
    data: unknown;
    hypothesisId: string | null;
    loc: string | null;
    level: 'info' | 'warn' | 'error';
    tags: Record<string, string> | null;
    runtime: string;
};

export function validateEventContract(
    value: unknown,
    expectedRuntime: string,
    expectedLabel: string,
    expectedSessionId: string
): DebugHubEvent {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Event must be an object');
    }

    const event = value as Record<string, unknown>;
    for (const key of ['ts', 'sessionId', 'label', 'data', 'hypothesisId', 'loc', 'level', 'tags', 'runtime']) {
        if (!(key in event)) {
            throw new Error(`Missing required key: ${key}`);
        }
    }
    assertIsoTimestamp(event.ts);
    assertString(event.sessionId, 'sessionId');
    assertString(event.label, 'label');
    assertLevel(event.level);
    assertNullableString(event.hypothesisId, 'hypothesisId');
    assertNullableString(event.loc, 'loc');
    assertNullableTags(event.tags);
    assertString(event.runtime, 'runtime');

    if (event.label !== expectedLabel) {
        throw new Error(`Unexpected label: ${event.label}`);
    }
    if (event.runtime !== expectedRuntime) {
        throw new Error(`Unexpected runtime: ${event.runtime}`);
    }
    if (event.sessionId !== expectedSessionId) {
        throw new Error(`Unexpected sessionId: ${event.sessionId}`);
    }

    return event as unknown as DebugHubEvent;
}

function assertString(value: unknown, key: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid string field: ${key}`);
    }
}

function assertNullableString(value: unknown, key: string): void {
    if (value !== null && typeof value !== 'string') {
        throw new Error(`Invalid nullable string field: ${key}`);
    }
}

function assertLevel(value: unknown): void {
    if (value !== 'info' && value !== 'warn' && value !== 'error') {
        throw new Error('Invalid level');
    }
}

function assertNullableTags(value: unknown): void {
    if (value === null) {
        return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid tags field');
    }
}

function assertIsoTimestamp(value: unknown): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error('Invalid string field: ts');
    }

    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
    if (!iso8601Regex.test(value)) {
        throw new Error('Invalid ISO-8601 timestamp: ts');
    }

    if (Number.isNaN(Date.parse(value))) {
        throw new Error('Invalid ISO-8601 timestamp: ts');
    }
}
