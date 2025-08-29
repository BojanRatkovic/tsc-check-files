#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import { parseArgs } from './arg-parser.js';
import { buildTempTsconfig } from './config-builder.js';
import { 
  findNearestPackageJson, 
  pickTool, 
  preferLocalBin, 
  getInstallSuggestion 
} from './utils.js';

/**
 * Main entry point for the TypeScript runner
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { fileArgs, passthrough, explicitProject, toolOverride } = parseArgs(argv);

  const pkgJsonPath = findNearestPackageJson(process.cwd());
  if (!pkgJsonPath) {
    console.error('Error: No package.json found in current directory or any parent directory.');
    process.exit(1);
  }

  const tool = pickTool(fileArgs, pkgJsonPath, toolOverride);

  const shouldCreateTempConfig = fileArgs.length > 0 && !explicitProject;

  let cleanup: (() => void) | null = null;
  let configDir = process.cwd();
  let finalArgs: string[] = passthrough.slice();

  if (shouldCreateTempConfig) {
    const tempConfig = await buildTempTsconfig(fileArgs);
    configDir = tempConfig.configDir;
    
    if (tool === 'glint') {
      finalArgs = ['--project', tempConfig.tempPath, ...passthrough];
    } else {
      finalArgs = ['-p', tempConfig.tempPath, ...passthrough];
    }
    
    cleanup = tempConfig.cleanup;
  } else if (explicitProject) {
    const absoluteProject = path.resolve(explicitProject);
    configDir = path.dirname(absoluteProject);
  }

  const { command, args } = preferLocalBin(tool, configDir);
  const cmdArgs = [...args, ...finalArgs];

  const exit = (code?: number) => {
    if (cleanup) {
      cleanup();
    }
    process.exit(code ?? 0);
  };

  process.on('SIGINT', () => exit(130));
  process.on('SIGTERM', () => exit(143));

  const child = spawn(command, cmdArgs, { 
    stdio: 'inherit', 
    cwd: configDir 
  });

  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      const packageName = getInstallSuggestion(tool);
      console.error(
        `Failed to execute "${tool}". It doesn't appear to be installed locally.\n` +
        `Install it in your project (peer dependency) and try again:\n` +
        `  pnpm add -D ${packageName}`
      );
    } else {
      console.error('Failed to start the underlying tool:', err.message);
    }
    exit(1);
  });

  child.on('exit', (code) => {
    exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
