[![npm version](https://badge.fury.io/js/typescript-file-checker.svg)](https://www.npmjs.com/package/typescript-file-checker) [![CI](https://github.com/BojanRatkovic/typescript-file-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/BojanRatkovic/typescript-file-checker/actions/workflows/ci.yml) &nbsp; [![Tests](https://github.com/BojanRatkovic/typescript-file-checker/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/BojanRatkovic/typescript-file-checker/actions/workflows/test.yml)

# typescript-file-checker

Smart TypeScript checker for individual files (while respecting tsconfig.json) or full projects with automatic tool detection (tsc/glint/vue-tsc).

## Why typescript-file-checker?

Traditional TypeScript compilers like `tsc` are designed for full project compilation and don't easily support checking individual files while respecting the project's configuration. This tool bridges that gap by:

- 🔍 **Single-file checking** - Type check specific files without compiling the entire project
- ⚙️ **Respects tsconfig.json** - Maintains all your project's TypeScript configuration
- 🧠 **Smart tool detection** - Automatically chooses between `tsc`, `glint`, or `vue-tsc`
- 📦 **Monorepo friendly** - Works correctly from any subdirectory
- 🚀 **Fast execution** - Only checks what you need, when you need it

Perfect for:
- **Git hooks** and **lint-staged** workflows
- **IDE integrations** and custom tooling
- **CI/CD pipelines** that need to check specific changed files
- **Development workflows** where you want quick feedback on individual files

## Installation

Install as a development dependency in your project:

```bash
# npm
npm install --save-dev typescript-file-checker

# yarn
yarn add --dev typescript-file-checker

# pnpm
pnpm add --save-dev typescript-file-checker
```

### Peer Dependencies

You'll also need one or more of these TypeScript tools (likely already in your project):

```bash
# For standard TypeScript projects
pnpm add --save-dev typescript

# For Vue projects
pnpm add --save-dev vue-tsc

# For Ember/Glint projects  
pnpm add --save-dev @glint/core
```

## Usage

### Basic Examples

```bash
# Check a single TypeScript file
typescript-file-checker src/utils/helpers.ts
# or use short alias:
tsc-check src/utils/helpers.ts

# Check multiple files
tsc-check src/components/Button.tsx src/utils/api.ts

# Check Glint template files (Ember.js)
tsc-check app/components/my-component.gts

# Check Vue files
tsc-check src/components/HelloWorld.vue

# Full project check (passes through to underlying tool)
tsc-check

# Pass additional TypeScript flags
tsc-check src/file.ts --strict --noImplicitAny
```

### Advanced Usage

```bash
# Force a specific tool
tsc-check --tool=glint app/components/test.gts
tsc-check --tool=vue-tsc src/components/App.vue
tsc-check --tool=tsc src/utils/helpers.ts

# Use explicit project configuration
tsc-check --project ./custom-tsconfig.json src/file.ts

# Combine with other tools
tsc-check $(git diff --name-only --diff-filter=AM | grep '\\.ts$')
```

## How It Works

### 1. Tool Detection

The tool automatically detects which TypeScript checker to use:

| Condition | Tool Used | Reason |
|-----------|-----------|---------|
| `.vue` files present | `vue-tsc` | Vue Single File Components |
| `.gts` or `.gjs` files present | `glint` | Ember Glint templates |
| `@glint/core` in dependencies | `glint` | Explicit Glint project |
| `vue-tsc` or `vue` in dependencies | `vue-tsc` | Vue project |
| Default | `tsc` | Standard TypeScript |

### 2. Configuration Inheritance

When checking specific files, typescript-file-checker:

1. **Finds your project's `tsconfig.json`** using TypeScript's built-in discovery
2. **Creates a temporary configuration** that inherits ALL settings from your project
3. **Adds the specific files** to the `files` array
4. **Adjusts compiler options** for type-checking only:
   - Sets `noEmit: true` (no output files)
   - Removes `rootDir`, `outDir` (not needed for checking)
   - Disables `composite`, `incremental` (incompatible with explicit files)

### 3. Temporary Files

Temporary configurations are created alongside your existing tsconfig.json:

```
your-project/
├── tsconfig.json
├── tsconfig.tsc-runner.1234567890.json  ← temporary config
├── tsconfig.tsc-runner.shims.d.ts       ← temporary type shims
└── src/
    └── your-files.ts
```

This ensures tools like Glint can properly resolve environments and dependencies.

### 4. Cleanup

All temporary files are automatically cleaned up on:
- Normal process exit
- `SIGINT` (Ctrl+C)  
- `SIGTERM` (process termination)

## Configuration

### Tool Override

Force a specific tool when auto-detection isn't sufficient:

```bash
# Long form
tsc-check --tool=glint src/file.ts

# Short form  
tsc-check --tool glint src/file.ts
```

Valid tools: `tsc`, `glint`, `vue-tsc`

### Project Configuration

Specify a custom TypeScript configuration:

```bash
tsc-check --project ./tsconfig.build.json src/file.ts
tsc-check -p ./configs/strict.json src/file.ts
```

When using `--project`, no temporary configuration is created - the specified config is used directly.

## Binary Resolution

The tool finds TypeScript binaries in this order:

1. **Local `.bin` directory** - `node_modules/.bin/tsc`
2. **Package resolution** - Direct path to the binary from package
3. **System PATH** - Global installation fallback

This works correctly with all package managers (npm, yarn, pnpm) and handles edge cases like JavaScript-based binaries.

## File Type Support

| Extension | Description | Tool |
|-----------|-------------|------|
| `.ts`, `.tsx` | TypeScript files | `tsc` (default) |
| `.gts`, `.gjs` | Glint template files (Ember) | `glint` |
| `.vue` | Vue Single File Components | `vue-tsc` |

## Error Handling

### Missing Dependencies

```bash
$ tsc-check src/file.ts
Failed to execute "tsc". It doesn't appear to be installed locally.
Install it in your project (peer dependency) and try again:
  pnpm add -D typescript
```

### Configuration Errors

```bash
$ tsc-check src/file.ts  
Error reading tsconfig.json: Cannot read file 'tsconfig.json'.
```

### File Not Found

```bash
$ tsc-check src/missing.ts
# No error - invalid files are filtered out automatically
```

## Integration Examples

### Git Hooks (lint-staged)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["tsc-check", "eslint --fix"],
    "*.gts": ["tsc-check --tool=glint"],
    "*.vue": ["tsc-check --tool=vue-tsc"]
  }
}
```

## Monorepo Support

The tool correctly works in monorepos by:

1. **Searching upward** for `package.json` and `tsconfig.json`
2. **Executing from project root** (where configuration files are located)
3. **Converting file paths** to be relative to the configuration directory

```bash
# Works from any subdirectory
cd packages/frontend/src/components
tsc-check Button.tsx  # ✅ Finds root tsconfig.json

cd ../../../../backend  
tsc-check utils.ts     # ✅ Finds backend tsconfig.json
```

## Troubleshooting

### "No tsconfig.json found"

Make sure you're running the command from within a TypeScript project:

```bash
# Check if tsconfig.json exists
find . -name "tsconfig.json" -type f | head -5

# Or create one
tsc --init
```

### "Unable to resolve environment" (Glint)

This usually means Glint can't find its environment packages. Make sure:

1. You're running from the correct directory
2. Environment packages are installed (`@glint/environment-ember-loose`, etc.)
3. Your `tsconfig.json` has proper Glint configuration

### Performance Issues

For large projects, consider:

1. Using more specific file patterns
2. Checking files in smaller batches
3. Using `--project` with a minimal configuration for CI

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup

```bash
git clone <repository>
cd typescript-file-checker
pnpm install
pnpm build

# Test with a sample file
pnpm test
# or
node dist/index.js test/fixtures/test-file.ts
```

## License

MIT

## Related Projects

- [TypeScript](https://github.com/microsoft/TypeScript) - The TypeScript compiler
- [Glint](https://github.com/typed-ember/glint) - TypeScript tooling for Ember.js
- [Vue TSC](https://github.com/vuejs/language-tools) - TypeScript support for Vue
- [lint-staged](https://github.com/okonet/lint-staged) - Run linters on git staged files
