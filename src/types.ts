export type Tool = 'glint' | 'vue-tsc' | 'tsc';

export const FILE_EXTS = ['.ts', '.tsx', '.gts', '.vue'] as const;

export interface ParsedArgs {
  fileArgs: string[];
  passthrough: string[];
  explicitProject: string | null;
  toolOverride: Tool | undefined;
}

export interface TempTsconfig {
  tempPath: string;
  configDir: string;
  cleanup: () => void;
}

export interface CommandConfig {
  command: string;
  args: string[];
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  bin?: string | Record<string, string>;
}
