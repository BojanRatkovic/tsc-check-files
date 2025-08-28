#!/usr/bin/env node
/* eslint-disable no-console */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import resolveFrom from 'resolve-from';

type Tool = 'glint' | 'vue-tsc' | 'tsc';
const FILE_EXTS = ['.ts', '.tsx', '.gts', '.vue'];

// -------------------------------
// Utils
// -------------------------------
function isFileArg(a: string): boolean {
  const p = path.resolve(a);
  const ext = path.extname(p);
  return FILE_EXTS.includes(ext) && fs.existsSync(p);
}

function findNearestPackageJson(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function resolvePackageBin(pkgName: string, binName?: string): string | null {
  const pkgJsonPath = resolveFrom.silent?.(process.cwd(), `${pkgName}/package.json`) as string | undefined;
  if (!pkgJsonPath) return null;

  const pkgRoot = path.dirname(pkgJsonPath);
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const binField = pkgJson.bin as string | Record<string, string> | undefined;

  if (!binField) return null;
  if (typeof binField === 'string') return path.resolve(pkgRoot, binField);

  if (binName && binField[binName]) return path.resolve(pkgRoot, binField[binName]);
  const first = Object.values(binField)[0];
  return first ? path.resolve(pkgRoot, first) : null;
}

function preferLocalBin(cmd: Tool): { command: string; args: string[] } {
  const cwd = process.cwd();
  const exe = path.join(cwd, 'node_modules', '.bin', cmd + (process.platform === 'win32' ? '.cmd' : ''));
  if (fs.existsSync(exe)) return { command: exe, args: [] };

  const pkgName = cmd === 'vue-tsc' ? 'vue-tsc' : cmd === 'glint' ? '@glint/core' : 'typescript';
  const desiredBinName = cmd === 'vue-tsc' ? 'vue-tsc' : cmd === 'glint' ? 'glint' : 'tsc';
  const realBin = resolvePackageBin(pkgName, desiredBinName);

  if (realBin) {
    if (/\.(c?m)?jsx?$/.test(realBin)) return { command: process.execPath, args: [realBin] };
    return { command: realBin, args: [] };
  }
  return { command: cmd, args: [] }; // PATH fallback
}

function pickTool(fileArgs: string[], pkgJsonPath: string, override?: Tool): Tool {
  if (override) return override;
  if (fileArgs.some(f => f.endsWith('.vue'))) return 'vue-tsc';
  if (fileArgs.some(f => f.endsWith('.gts') || f.endsWith('.gjs'))) return 'glint';

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps?.['@glint/core']) return 'glint';
  if (deps?.['vue-tsc'] || deps?.['vue']) return 'vue-tsc';
  return 'tsc';
}

function parseArgs(argv: string[]): {
  fileArgs: string[];
  passthrough: string[];
  explicitProject: string | null;
  toolOverride: Tool | undefined;
} {
  const fileArgs = argv.filter(isFileArg);
  let passthrough = argv.filter(a => !fileArgs.includes(a));

  let explicitProject: string | null = null;
  for (let i = 0; i < passthrough.length; i++) {
    const a = passthrough[i];
    if (a === '--project' || a === '-p') {
      explicitProject = passthrough[i + 1] ?? null;
      break;
    }
    if (a.startsWith('--project=')) {
      explicitProject = a.split('=')[1] ?? null;
      break;
    }
  }

  let toolOverride: Tool | undefined;
  const toolIdxEq = passthrough.findIndex(a => a.startsWith('--tool='));

  if (toolIdxEq !== -1) {
    const val = passthrough[toolIdxEq].split('=')[1];
    if (val === 'tsc' || val === 'vue-tsc' || val === 'glint') toolOverride = val;
    else {
      console.error(`Unknown --tool value: ${val}. Expected one of: tsc | vue-tsc | glint`);
      process.exit(1);
    }
    passthrough.splice(toolIdxEq, 1);
  }

  const toolIdx = passthrough.findIndex(a => a === '--tool');

  if (toolIdx !== -1) {
    const val = passthrough[toolIdx + 1];
    if (val === 'tsc' || val === 'vue-tsc' || val === 'glint') {
      toolOverride = val;
      passthrough.splice(toolIdx, 2);
    } else {
      console.error(`Unknown --tool value: ${val}. Expected one of: tsc | vue-tsc | glint`);
      process.exit(1);
    }
  }

  return { fileArgs, passthrough, explicitProject, toolOverride };
}

async function requireTypeScript(): Promise<typeof import('typescript')> {
  try {
    const ts = (await import('typescript')) as typeof import('typescript');
    return ts;
  } catch {
    console.error('Please install "typescript" in your project (peer dependency).');
    process.exit(1);
  }
}

// -------------------------------
// Core: TEMP tsconfig u *istom* folderu kao originalni (single-file by default)
// -------------------------------
async function buildTempTsconfig(files: string[] | null): Promise<{ tempPath: string; configDir: string; cleanup: () => void }> {
  const ts = await requireTypeScript();

  const configFileName =
    ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json') ||
    ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (!configFileName) {
    throw new Error(`No tsconfig.json found starting from ${process.cwd()}`);
  }

  const read = ts.readConfigFile(configFileName, ts.sys.readFile);
  if (read.error) {
    console.error(
      'Error reading tsconfig.json:',
      ts.formatDiagnostic(read.error, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: (f) => f,
        getNewLine: () => ts.sys.newLine
      })
    );
    process.exit(1);
  }

  const configDir = path.dirname(configFileName);
  // Validiraj/razreši extends, path mapping, itd.
  ts.parseJsonConfigFileContent(read.config, ts.sys, configDir);

  // Temp fajlovi pored originalnog tsconfig-a
  const tempPath = path.join(configDir, `tsconfig.tsc-runner.${Date.now()}.json`);
  const shimPath = path.join(configDir, `tsconfig.tsc-runner.shims.d.ts`);

  // Globalni "single-file" shim: svaki nepoznati import tretiraj kao any
  // (reši TS2307 u single-file režimu bez praćenja importova)
  const shimContent = `declare module '*' { const anyExport: any; export default anyExport; }`;
  try { fs.writeFileSync(shimPath, shimContent); } catch { /* ignore */ }

  const original = read.config ?? {};
  const compilerOptions = {
    ...(original.compilerOptions ?? {}),
    noEmit: true,
    outDir: undefined,
    rootDir: undefined,
    composite: false,
    incremental: false,
    tsBuildInfoFile: undefined,
  };

  const tempConfig: Record<string, unknown> = {
    ...original,
    compilerOptions
  };

  if (files && files.length) {
    // Putanje relativne na configDir (isto mesto gde je i temp tsconfig)
    const relFiles = files.map(file => path.relative(configDir, path.resolve(process.cwd(), file)));
    // Uvek dodaj shim da uvozi ne pucaju u single-file režimu
    const relShim = path.relative(configDir, shimPath);
    tempConfig.files = [...relFiles, relShim];
    delete (tempConfig as any).include;
    delete (tempConfig as any).exclude;
  }

  fs.writeFileSync(tempPath, JSON.stringify(tempConfig, null, 2));

  const cleanup = () => {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    try { if (fs.existsSync(shimPath)) fs.unlinkSync(shimPath); } catch {}
  };

  return { tempPath, configDir, cleanup };
}


// -------------------------------
// Main
// -------------------------------
(async () => {
  const argv = process.argv.slice(2);
  const { fileArgs, passthrough, explicitProject, toolOverride } = parseArgs(argv);

  const pkgJsonPath = findNearestPackageJson(process.cwd());
  if (!pkgJsonPath) {
    console.error('Error: No package.json found in current directory or any parent directory.');
    process.exit(1);
  }

  const tool = pickTool(fileArgs, pkgJsonPath, toolOverride);

  const shouldMakeTemp = fileArgs.length > 0 && !explicitProject;

  let cleanup: (() => void) | null = null;
  let configDir = process.cwd();
  let finalArgs: string[] = passthrough.slice();

  if (shouldMakeTemp) {
    const built = await buildTempTsconfig(fileArgs);
    configDir = built.configDir;
    if (tool === 'glint') finalArgs = ['--project', built.tempPath, ...passthrough];
    else finalArgs = ['-p', built.tempPath, ...passthrough];
    cleanup = built.cleanup;
  } else if (explicitProject) {
    const abs = path.resolve(explicitProject);
    configDir = path.dirname(abs);
  }

  const { command, args } = preferLocalBin(tool);
  const cmdArgs = [...args, ...finalArgs];

  const tidy = (code?: number) => {
    if (cleanup) cleanup();
    process.exit(code ?? 0);
  };
  process.on('SIGINT', () => tidy(130));
  process.on('SIGTERM', () => tidy(143));

  const child = spawn(command, cmdArgs, { stdio: 'inherit', cwd: configDir });

  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      console.error(
        `Failed to execute "${tool}". It doesn't appear to be installed locally.\n` +
        `Install it in your project (peer dependency) and try again:\n` +
        `  pnpm add -D ${tool === 'tsc' ? 'typescript' : tool === 'vue-tsc' ? 'vue-tsc' : '@glint/core'}`
      );
    } else {
      console.error('Failed to start the underlying tool:', err.message);
    }
    tidy(1);
  });

  child.on('exit', (code) => tidy(code ?? 1));
})();
