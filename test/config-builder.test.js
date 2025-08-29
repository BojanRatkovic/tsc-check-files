import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTempTsconfig } from '../dist/src/config-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Config Builder', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const originalCwd = process.cwd();

  test('should create temporary tsconfig with correct structure', async () => {
    process.chdir(fixturesDir);

    try {
      const testFiles = ['test-file.ts'];
      const result = await buildTempTsconfig(testFiles);

      assert.ok(result.tempPath, 'Should return temp path');
      assert.ok(result.configDir, 'Should return config directory');
      assert.ok(typeof result.cleanup === 'function', 'Should return cleanup function');

      assert.ok(fs.existsSync(result.tempPath), 'Temp tsconfig should exist');
      
      const tempConfig = JSON.parse(fs.readFileSync(result.tempPath, 'utf8'));
      
      assert.ok(tempConfig.compilerOptions, 'Should have compiler options');
      assert.strictEqual(tempConfig.compilerOptions.noEmit, true, 'Should set noEmit to true');
      assert.strictEqual(tempConfig.compilerOptions.outDir, undefined, 'Should remove outDir');
      assert.strictEqual(tempConfig.compilerOptions.rootDir, undefined, 'Should remove rootDir');
      assert.strictEqual(tempConfig.compilerOptions.composite, false, 'Should disable composite');
      
      assert.ok(Array.isArray(tempConfig.files), 'Should have files array');
      assert.ok(tempConfig.files.includes('test-file.ts'), 'Should include the test file');
      
      result.cleanup();
      
      assert.ok(!fs.existsSync(result.tempPath), 'Temp files should be cleaned up');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle empty file list', async () => {
    process.chdir(fixturesDir);

    try {
      const result = await buildTempTsconfig(null);

      assert.ok(result.tempPath, 'Should return temp path');
      assert.ok(fs.existsSync(result.tempPath), 'Temp tsconfig should exist');
      
      const tempConfig = JSON.parse(fs.readFileSync(result.tempPath, 'utf8'));
      
      assert.strictEqual(tempConfig.files, undefined, 'Should not have files array when no files specified');
      assert.ok(tempConfig.include, 'Should preserve original include');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should create shim file for module resolution', async () => {
    process.chdir(fixturesDir);

    try {
      const testFiles = ['test-file.ts'];
      const result = await buildTempTsconfig(testFiles);

      const shimPath = path.join(result.configDir, 'tsconfig.tsc-runner.shims.d.ts');
      assert.ok(fs.existsSync(shimPath), 'Shim file should exist');
      
      const shimContent = fs.readFileSync(shimPath, 'utf8');
      assert.ok(shimContent.includes("declare module '*'"), 'Shim should contain module declaration');
      
      result.cleanup();
      
      assert.ok(!fs.existsSync(shimPath), 'Shim file should be cleaned up');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should preserve original tsconfig settings', async () => {
    process.chdir(fixturesDir);

    try {
      const testFiles = ['test-file.ts'];
      const result = await buildTempTsconfig(testFiles);

      const tempConfig = JSON.parse(fs.readFileSync(result.tempPath, 'utf8'));
      const originalConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
      
      assert.strictEqual(tempConfig.compilerOptions.target, originalConfig.compilerOptions.target, 'Should preserve target');
      assert.strictEqual(tempConfig.compilerOptions.module, originalConfig.compilerOptions.module, 'Should preserve module');
      assert.strictEqual(tempConfig.compilerOptions.strict, originalConfig.compilerOptions.strict, 'Should preserve strict');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle relative file paths correctly', async () => {
    process.chdir(fixturesDir);

    try {
      const testFiles = [path.resolve('test-file.ts')];
      const result = await buildTempTsconfig(testFiles);

      const tempConfig = JSON.parse(fs.readFileSync(result.tempPath, 'utf8'));
      
      assert.ok(tempConfig.files.includes('test-file.ts'), 'Should convert absolute path to relative');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should find tsconfig.json based on file location in monorepo structure', async () => {
    // Change to root directory first (simulate running from monorepo root)
    process.chdir(__dirname);

    try {
      // Test file in subproject/src/ directory, but tsconfig.json is in subproject/
      const testFiles = ['monorepo-fixtures/subproject/src/component.ts'];
      const result = await buildTempTsconfig(testFiles);

      // Should find tsconfig.json in subproject/ directory, not in root
      const expectedConfigDir = path.join(__dirname, 'monorepo-fixtures', 'subproject');
      assert.strictEqual(result.configDir, expectedConfigDir, 'Should find tsconfig.json in subproject directory');

      // Verify the config was actually read from the subproject
      const tempConfig = JSON.parse(fs.readFileSync(result.tempPath, 'utf8'));
      assert.ok(tempConfig.compilerOptions, 'Should have compiler options from subproject');
      assert.strictEqual(tempConfig.compilerOptions.target, 'ES2020', 'Should have subproject target setting');

      // File path should be relative to the subproject directory
      assert.ok(tempConfig.files.includes('src/component.ts'), 'Should have relative path from subproject root');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should fall back to process.cwd() when no files are provided', async () => {
    process.chdir(fixturesDir);

    try {
      // No files provided - should use process.cwd() for tsconfig search
      const result = await buildTempTsconfig(null);

      // Should find tsconfig.json in current directory (fixtures)
      assert.strictEqual(result.configDir, fixturesDir, 'Should use process.cwd() when no files provided');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle absolute file paths from different starting directory', async () => {
    process.chdir(__dirname);

    try {
      // Absolute path to file in subproject
      const absoluteFilePath = path.join(__dirname, 'monorepo-fixtures', 'subproject', 'src', 'component.ts');
      const result = await buildTempTsconfig([absoluteFilePath]);

      // Should still find the subproject tsconfig.json
      const expectedConfigDir = path.join(__dirname, 'monorepo-fixtures', 'subproject');
      assert.strictEqual(result.configDir, expectedConfigDir, 'Should find tsconfig.json based on file location');
      
      result.cleanup();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
