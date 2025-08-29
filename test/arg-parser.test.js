import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../dist/src/arg-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Argument Parser', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFile = path.join(fixturesDir, 'test-file.ts');

  test('should parse file arguments correctly', () => {
    const argv = [testFile, '--strict'];
    const result = parseArgs(argv);

    assert.ok(Array.isArray(result.fileArgs), 'Should return fileArgs array');
    assert.strictEqual(result.fileArgs.length, 1, 'Should have one file argument');
    assert.ok(result.fileArgs[0].endsWith('test-file.ts'), 'Should include the test file');
    
    assert.ok(Array.isArray(result.passthrough), 'Should return passthrough array');
    assert.ok(result.passthrough.includes('--strict'), 'Should include passthrough arguments');
  });

  test('should parse project flag with equals syntax', () => {
    const argv = ['--project=./custom-tsconfig.json', testFile];
    const result = parseArgs(argv);

    assert.strictEqual(result.explicitProject, './custom-tsconfig.json', 'Should parse project with equals');
  });

  test('should parse project flag with space syntax', () => {
    const argv = ['--project', './custom-tsconfig.json', testFile];
    const result = parseArgs(argv);

    assert.strictEqual(result.explicitProject, './custom-tsconfig.json', 'Should parse project with space');
  });

  test('should parse short project flag', () => {
    const argv = ['-p', './custom-tsconfig.json', testFile];
    const result = parseArgs(argv);

    assert.strictEqual(result.explicitProject, './custom-tsconfig.json', 'Should parse short project flag');
  });

  test('should parse tool override with equals syntax', () => {
    const argv = ['--tool=glint', testFile];
    const result = parseArgs(argv);

    assert.strictEqual(result.toolOverride, 'glint', 'Should parse tool with equals');
    assert.ok(!result.passthrough.includes('--tool=glint'), 'Should remove tool flag from passthrough');
  });

  test('should parse tool override with space syntax', () => {
    const argv = ['--tool', 'vue-tsc', testFile];
    const result = parseArgs(argv);

    assert.strictEqual(result.toolOverride, 'vue-tsc', 'Should parse tool with space');
    assert.ok(!result.passthrough.includes('--tool'), 'Should remove tool flag from passthrough');
    assert.ok(!result.passthrough.includes('vue-tsc'), 'Should remove tool value from passthrough');
  });

  test('should handle multiple files', () => {
    const argv = [testFile, 'non-existent.ts', '--noEmit'];
    const result = parseArgs(argv);

    assert.strictEqual(result.fileArgs.length, 1, 'Should only include existing files');
    assert.ok(result.passthrough.includes('--noEmit'), 'Should preserve other flags');
  });

  test('should handle no file arguments', () => {
    const argv = ['--strict', '--noEmit'];
    const result = parseArgs(argv);

    assert.strictEqual(result.fileArgs.length, 0, 'Should have no file arguments');
    assert.strictEqual(result.passthrough.length, 2, 'Should preserve all flags as passthrough');
  });

  test('should handle mixed arguments', () => {
    const argv = [
      '--strict',
      testFile,
      '--tool=tsc',
      '--project', './tsconfig.json',
      '--noEmit'
    ];
    const result = parseArgs(argv);

    assert.strictEqual(result.fileArgs.length, 1, 'Should have one file');
    assert.strictEqual(result.toolOverride, 'tsc', 'Should parse tool override');
    assert.strictEqual(result.explicitProject, './tsconfig.json', 'Should parse project');
    assert.ok(result.passthrough.includes('--strict'), 'Should preserve strict flag');
    assert.ok(result.passthrough.includes('--noEmit'), 'Should preserve noEmit flag');
    assert.ok(!result.passthrough.includes('--tool=tsc'), 'Should remove tool flag');
  });
});
