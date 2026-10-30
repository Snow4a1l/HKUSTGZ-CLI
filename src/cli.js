#!/usr/bin/env node
import { run } from './main.js';

const result = await run(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(result.payload)}\n`);
process.exitCode = result.exitCode;
