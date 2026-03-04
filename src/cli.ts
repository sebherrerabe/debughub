#!/usr/bin/env node
import { Command } from 'commander';
import { install } from './commands/install';
import { start } from './commands/start';
import { stop } from './commands/stop';
import { tail } from './commands/tail';
import { search } from './commands/search';
import { clear } from './commands/clear';
import { verify } from './commands/verify';
import { doctor } from './commands/doctor';
import { _server } from './commands/server';

const pkg = require('../package.json') as { version: string };

export function createProgram(): Command {
    const program = new Command();

    program
        .name('debughub')
        .description('DebugHub: Agent-agnostic local debug loop')
        .version(pkg.version);

    program.command('install')
        .description('Installs vendored DebugHub runtime helpers into the current repo')
        .action(install);

    program.command('start')
        .description('Starts the local collector server')
        .action(start);

    program.command('stop')
        .description('Stops the local collector server')
        .action(stop);

    program.command('tail')
        .description('Tails the last N events')
        .option('-n, --n <number>', 'Number of events', '200')
        .option('--session <id>', 'Session ID')
        .option('--json', 'Print raw JSON instead of pretty output', false)
        .action(tail);

    program.command('search <query>')
        .description('Searches the JSONL file for substring matches')
        .option('--label <label>', 'Filter by label')
        .option('--hypothesis <id>', 'Filter by hypothesisId')
        .option('--level <level>', 'Filter by level')
        .option('--session <id>', 'Session ID')
        .action(search);

    program.command('clear')
        .description('Clears the current session output file')
        .option('--session <id>', 'Session ID')
        .action(clear);

    program.command('verify')
        .description('Verifies integrity of installed vendor files')
        .action(verify);

    program.command('doctor')
        .description('Prints quick diagnostics')
        .action(doctor);

    program.command('_server <sessionId> <port>', { hidden: true })
        .action(_server);

    return program;
}

export function run(argv: string[] = process.argv): void {
    createProgram().parse(argv);
}

if (require.main === module) {
    run();
}
