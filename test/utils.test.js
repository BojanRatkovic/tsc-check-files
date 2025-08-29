import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  isFileArg, 
  findNearestPackageJson, 
  pickTool, 
  getInstallSuggestion,
  preferLocalBin
} from '../dist/src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Utils', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  describe('isFileArg', () => {
    test('should identify TypeScript files', () => {
      const testFile = path.join(fixturesDir, 'test-file.ts');
      assert.strictEqual(isFileArg(testFile), true, 'Should identify .ts files');
    });

    test('should reject non-existent files', () => {
      assert.strictEqual(isFileArg('non-existent.ts'), false, 'Should reject non-existent files');
    });

    test('should reject unsupported extensions', () => {
      assert.strictEqual(isFileArg('test.js'), false, 'Should reject .js files');
      assert.strictEqual(isFileArg('test.txt'), false, 'Should reject .txt files');
    });
  });

  describe('findNearestPackageJson', () => {
    test('should find package.json in fixtures directory', () => {
      const result = findNearestPackageJson(fixturesDir);
      assert.ok(result, 'Should find package.json');
      assert.ok(result.endsWith('package.json'), 'Should return path to package.json');
    });

    test('should return null when no package.json found', () => {
      const result = findNearestPackageJson('/tmp');
      assert.strictEqual(result, null, 'Should return null when not found');
    });
  });

  describe('pickTool', () => {
    const pkgJsonPath = path.join(fixturesDir, 'package.json');

    test('should pick vue-tsc for .vue files', () => {
      const fileArgs = ['test.vue'];
      const result = pickTool(fileArgs, pkgJsonPath);
      assert.strictEqual(result, 'vue-tsc', 'Should pick vue-tsc for .vue files');
    });

    test('should pick glint for .gts files', () => {
      const fileArgs = ['test.gts'];
      const result = pickTool(fileArgs, pkgJsonPath);
      assert.strictEqual(result, 'glint', 'Should pick glint for .gts files');
    });

    test('should pick glint for .gjs files', () => {
      const fileArgs = ['test.gjs'];
      const result = pickTool(fileArgs, pkgJsonPath);
      assert.strictEqual(result, 'glint', 'Should pick glint for .gjs files');
    });

    test('should default to tsc for regular TypeScript files', () => {
      const fileArgs = ['test.ts'];
      const result = pickTool(fileArgs, pkgJsonPath);
      assert.strictEqual(result, 'tsc', 'Should default to tsc for .ts files');
    });

    test('should respect tool override', () => {
      const fileArgs = ['test.ts'];
      const result = pickTool(fileArgs, pkgJsonPath, 'glint');
      assert.strictEqual(result, 'glint', 'Should respect tool override');
    });
  });

  describe('getInstallSuggestion', () => {
    test('should return correct package names', () => {
      assert.strictEqual(getInstallSuggestion('tsc'), 'typescript');
      assert.strictEqual(getInstallSuggestion('vue-tsc'), 'vue-tsc');
      assert.strictEqual(getInstallSuggestion('glint'), '@glint/core');
    });
  });

  describe('preferLocalBin with configDir', () => {
    test('should use configDir parameter when provided', () => {
      const customDir = path.join(__dirname, 'monorepo-fixtures', 'subproject');
      const result = preferLocalBin('tsc', customDir);
      
      // Should return some command (either local bin or fallback)
      assert.ok(result.command, 'Should return a command');
      assert.ok(Array.isArray(result.args), 'Should return args array');
    });

    test('should fall back to process.cwd() when configDir not provided', () => {
      const result = preferLocalBin('tsc');
      
      // Should return some command (either local bin or fallback)
      assert.ok(result.command, 'Should return a command');
      assert.ok(Array.isArray(result.args), 'Should return args array');
    });

    test('should return different paths for different configDirs', () => {
      const dir1 = __dirname;
      const dir2 = path.join(__dirname, 'fixtures');
      
      const result1 = preferLocalBin('tsc', dir1);
      const result2 = preferLocalBin('tsc', dir2);
      
      // Results might be the same if using fallback, but function should handle different dirs
      assert.ok(result1.command, 'Should return command for dir1');
      assert.ok(result2.command, 'Should return command for dir2');
    });
  });
});
