import type { FixtureMode } from '../java/mainFactory';

export function buildCSharpProgram(mode: FixtureMode): string {
    const labelByMode: Record<FixtureMode, string> = {
        emit: 'csharp_emit',
        disabled: 'csharp_disabled',
        missingSession: 'csharp_missing_session',
        badEndpoint: 'csharp_bad_endpoint',
    };

    return [
        'public static class Program',
        '{',
        '    public static void Main(string[] args)',
        '    {',
        `        DebugProbe.Probe("${labelByMode[mode]}");`,
        '    }',
        '}',
        '',
    ].join('\n');
}

export function buildCSharpProject(targetFramework: string): string {
    return [
        '<Project Sdk="Microsoft.NET.Sdk">',
        '  <PropertyGroup>',
        '    <OutputType>Exe</OutputType>',
        `    <TargetFramework>${targetFramework}</TargetFramework>`,
        '    <ImplicitUsings>enable</ImplicitUsings>',
        '    <Nullable>enable</Nullable>',
        '  </PropertyGroup>',
        '</Project>',
        '',
    ].join('\n');
}
