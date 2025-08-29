import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { TempTsconfig } from './types.js';
import { requireTypeScript } from './utils.js';

export async function buildTempTsconfig(files: string[] | null): Promise<TempTsconfig> {
  const ts = await requireTypeScript();

  const configFileName = 
    ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json') ||
    ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (!configFileName) {
    throw new Error(`No tsconfig.json found starting from ${process.cwd()}`);
  }

  const configReadResult = ts.readConfigFile(configFileName, ts.sys.readFile);
  
  if (configReadResult.error) {
    const errorMessage = ts.formatDiagnostic(configReadResult.error, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => ts.sys.newLine
    });
    
    console.error('Error reading tsconfig.json:', errorMessage);
    process.exit(1);
  }

  const configDir = path.dirname(configFileName);
  
  ts.parseJsonConfigFileContent(configReadResult.config, ts.sys, configDir);

  const timestamp = Date.now();
  const tempPath = path.join(configDir, `tsconfig.tsc-runner.${timestamp}.json`);
  const shimPath = path.join(configDir, `tsconfig.tsc-runner.shims.d.ts`);

  const shimContent = `declare module '*' { const anyExport: any; export default anyExport; }`;
  
  try {
    fs.writeFileSync(shimPath, shimContent);
  } catch {
  }

  const originalConfig = configReadResult.config ?? {};
  const tempConfig = createTempConfig(originalConfig, files, configDir, shimPath);

  fs.writeFileSync(tempPath, JSON.stringify(tempConfig, null, 2));

  const cleanup = () => {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
    }
    
    try {
      if (fs.existsSync(shimPath)) {
        fs.unlinkSync(shimPath);
      }
    } catch {
    }
  };

  return { tempPath, configDir, cleanup };
}

function createTempConfig(
  originalConfig: Record<string, unknown>,
  files: string[] | null,
  configDir: string,
  shimPath: string
): Record<string, unknown> {
  const tempConfig: Record<string, unknown> = { ...originalConfig };

  const compilerOptions = {
    ...(originalConfig.compilerOptions as Record<string, unknown> ?? {}),
    noEmit: true,
    outDir: undefined,
    rootDir: undefined,
    composite: false,
    incremental: false,
    tsBuildInfoFile: undefined,
  };

  tempConfig.compilerOptions = compilerOptions;

  if (files && files.length > 0) {
    const relativeFiles = files.map(file => 
      path.relative(configDir, path.resolve(process.cwd(), file))
    );
    
    const relativeShim = path.relative(configDir, shimPath);
    
    tempConfig.files = [...relativeFiles, relativeShim];
    
    delete tempConfig.include;
    delete tempConfig.exclude;
  }

  return tempConfig;
}
