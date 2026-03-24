import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const KB_ROOT = process.env.KB_ROOT || process.cwd();

export const executeTool = tool(
  async ({ command, cwd }) => {
    const workDir = cwd || KB_ROOT;
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 60_000,
        maxBuffer: 1024 * 1024 * 4, // 4MB
      });
      const output = stdout.trim();
      const err = stderr.trim();
      if (!output && err) return `STDERR: ${err}`;
      return output + (err ? `\n[stderr]: ${err}` : '');
    } catch (error: any) {
      return `Error executing command: ${error.message}`;
    }
  },
  {
    name: 'execute',
    description:
      'Execute a shell command. Use this to run Python scripts (search.py, index.py, etc.) and other KB operations.',
    schema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z
        .string()
        .optional()
        .describe('Working directory. Defaults to KB root.'),
    }),
  }
);

export const readFileTool = tool(
  async ({ file_path }) => {
    const absPath = path.isAbsolute(file_path)
      ? file_path
      : path.join(KB_ROOT, file_path);
    try {
      const content = await fs.readFile(absPath, 'utf-8');
      // Truncate very large files
      if (content.length > 50_000) {
        return content.slice(0, 50_000) + '\n...[truncated at 50k chars]';
      }
      return content;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the knowledge base.',
    schema: z.object({
      file_path: z
        .string()
        .describe('Absolute path or path relative to KB root'),
    }),
  }
);

export const writeFileTool = tool(
  async ({ file_path, content }) => {
    const absPath = path.isAbsolute(file_path)
      ? file_path
      : path.join(KB_ROOT, file_path);
    try {
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content, 'utf-8');
      return `Written: ${absPath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  },
  {
    name: 'write_file',
    description:
      'Write content to a file in the knowledge base. Creates parent directories if needed.',
    schema: z.object({
      file_path: z
        .string()
        .describe('Absolute path or path relative to KB root'),
      content: z.string().describe('File content to write'),
    }),
  }
);

export const fetchUrlTool = tool(
  async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'tichat/0.1 (personal knowledge bot)' },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await response.text();
      return text.length > 20_000
        ? text.slice(0, 20_000) + '\n...[truncated]'
        : text;
    } catch (error: any) {
      return `Error fetching URL: ${error.message}`;
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch the HTML/text content of a URL.',
    schema: z.object({
      url: z.string().describe('The URL to fetch'),
    }),
  }
);

export const lsTool = tool(
  async ({ dir_path }) => {
    const absPath = path.isAbsolute(dir_path)
      ? dir_path
      : path.join(KB_ROOT, dir_path);
    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join('\n');
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  },
  {
    name: 'ls',
    description: 'List files and directories in a path.',
    schema: z.object({
      dir_path: z
        .string()
        .describe('Absolute path or path relative to KB root'),
    }),
  }
);

export const allTools = [executeTool, readFileTool, writeFileTool, fetchUrlTool, lsTool];
