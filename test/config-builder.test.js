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
});
