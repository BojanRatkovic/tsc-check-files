import process from 'node:process';
import type { Tool, ParsedArgs } from './types.js';
import { isFileArg } from './utils.js';

/**
 * Parse command line arguments into structured data
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const fileArgs = argv.filter(isFileArg);
  let passthrough = argv.filter(arg => !fileArgs.includes(arg));

  // Parse explicit project option
  let explicitProject: string | null = null;
  for (let i = 0; i < passthrough.length; i++) {
    const arg = passthrough[i];
    
    if (arg === '--project' || arg === '-p') {
      explicitProject = passthrough[i + 1] ?? null;
      break;
    }
    
    if (arg.startsWith('--project=')) {
      explicitProject = arg.split('=')[1] ?? null;
      break;
    }
  }

  // Parse tool override option
  let toolOverride: Tool | undefined;
  
  // Handle --tool=value format
  const toolEqIndex = passthrough.findIndex(arg => arg.startsWith('--tool='));
  if (toolEqIndex !== -1) {
    const value = passthrough[toolEqIndex].split('=')[1];
    toolOverride = validateToolValue(value);
    passthrough.splice(toolEqIndex, 1);
  }

  // Handle --tool value format
  const toolIndex = passthrough.findIndex(arg => arg === '--tool');
  if (toolIndex !== -1) {
    const value = passthrough[toolIndex + 1];
    toolOverride = validateToolValue(value);
    passthrough.splice(toolIndex, 2);
  }

  return {
    fileArgs,
    passthrough,
    explicitProject,
    toolOverride
  };
}

/**
 * Validate and return tool value, exit on error
 */
function validateToolValue(value: string): Tool {
  const validTools: Tool[] = ['tsc', 'vue-tsc', 'glint'];
  
  if (!validTools.includes(value as Tool)) {
    console.error(`Unknown --tool value: ${value}. Expected one of: ${validTools.join(' | ')}`);
    process.exit(1);
  }
  
  return value as Tool;
}
