import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import resolveFrom from 'resolve-from';

import type { Tool, CommandConfig, PackageJson } from './types.js';

import { FILE_EXTS } from './types.js';

export function isFileArg(arg: string): boolean {
  const resolvedPath = path.resolve(arg);
  const ext = path.extname(resolvedPath);
  return (FILE_EXTS as readonly string[]).includes(ext) && fs.existsSync(resolvedPath);
}

export function findNearestPackageJson(startDir: string): string | null {
  let current = path.resolve(startDir);
  
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  
  return null;
}

export function resolvePackageBin(pkgName: string, binName?: string): string | null {
  const pkgJsonPath = resolveFrom.silent?.(process.cwd(), `${pkgName}/package.json`) as string | undefined;
  if (!pkgJsonPath) {
    return null;
  }

  const pkgRoot = path.dirname(pkgJsonPath);
  
  try {
    const pkgJson: PackageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const binField = pkgJson.bin;

    if (!binField) {
      return null;
    }
    
    if (typeof binField === 'string') {
      return path.resolve(pkgRoot, binField);
    }

    if (binName && binField[binName]) {
      return path.resolve(pkgRoot, binField[binName]);
    }
    
    const firstBin = Object.values(binField)[0];
    return firstBin ? path.resolve(pkgRoot, firstBin) : null;
  } catch {
    return null;
  }
}

export function preferLocalBin(cmd: Tool): CommandConfig {
  const cwd = process.cwd();
  const binExtension = process.platform === 'win32' ? '.cmd' : '';
  const localBinPath = path.join(cwd, 'node_modules', '.bin', cmd + binExtension);
  
  if (fs.existsSync(localBinPath)) {
    return { command: localBinPath, args: [] };
  }

  const toolConfig = {
    'vue-tsc': { pkgName: 'vue-tsc', binName: 'vue-tsc' },
    'glint': { pkgName: '@glint/core', binName: 'glint' },
    'tsc': { pkgName: 'typescript', binName: 'tsc' }
  };

  const config = toolConfig[cmd];
  const resolvedBin = resolvePackageBin(config.pkgName, config.binName);

  if (resolvedBin) {
    if (/\.(c?m)?jsx?$/.test(resolvedBin)) {
      return { command: process.execPath, args: [resolvedBin] };
    }
    return { command: resolvedBin, args: [] };
  }
  
  return { command: cmd, args: [] };
}

export function pickTool(fileArgs: string[], pkgJsonPath: string, override?: Tool): Tool {
  if (override) {
    return override;
  }
  
  if (fileArgs.some(f => f.endsWith('.vue'))) {
    return 'vue-tsc';
  }
  
  if (fileArgs.some(f => f.endsWith('.gts') || f.endsWith('.gjs'))) {
    return 'glint';
  }

  try {
    const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (allDeps?.['@glint/core']) {
      return 'glint';
    }
    
    if (allDeps?.['vue-tsc'] || allDeps?.['vue']) {
      return 'vue-tsc';
    }
  } catch {
  }
  
  return 'tsc';
}

export function getInstallSuggestion(tool: Tool): string {
  const packageMap = {
    'tsc': 'typescript',
    'vue-tsc': 'vue-tsc',
    'glint': '@glint/core'
  };
  
  return packageMap[tool];
}

export async function requireTypeScript(): Promise<typeof import('typescript')> {
  try {
    const ts = await import('typescript') as typeof import('typescript');
    return ts;
  } catch {
    console.error('Please install "typescript" in your project (peer dependency).');
    process.exit(1);
  }
}
