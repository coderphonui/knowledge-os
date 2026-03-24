import * as fs from 'fs/promises';
import * as path from 'path';

// Map Claude Code tool names → tichat tool names
const TOOL_MAP: Record<string, string> = {
  AskUserQuestion: 'ask the user a follow-up question in your next response',
  'fetch MCP tool': 'fetch_url tool',
  'filesystem MCP tool': 'read_file tool',
  'filesystem tool': 'read_file tool',
  'Write tool': 'write_file tool',
  'Read tool': 'read_file tool',
  'Bash tool': 'execute tool',
  'Glob tool': 'execute tool (use find or ls command)',
  'Grep tool': 'execute tool (use grep command)',
};

export function adaptSkill(content: string): string {
  return Object.entries(TOOL_MAP).reduce(
    (acc, [from, to]) => acc.replaceAll(from, to),
    content
  );
}

export interface Skill {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

function extractFrontmatterField(content: string, field: string): string {
  // Handle multiline values (block scalar > or |) and single-line
  const singleLine = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const blockScalar = new RegExp(`^${field}:\\s*[>|]\\s*\\n([\\s\\S]*?)(?=\\n\\S)`, 'm');

  const blockMatch = content.match(blockScalar);
  if (blockMatch) {
    return blockMatch[1].replace(/^\s+/gm, '').replace(/\n/g, ' ').trim();
  }

  const singleMatch = content.match(singleLine);
  return singleMatch?.[1]?.trim() ?? '';
}

export async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  let entries;
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    console.warn(`Skills directory not found: ${skillsDir}`);
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillFile, 'utf-8');
      const adapted = adaptSkill(raw);

      const name = extractFrontmatterField(adapted, 'name') || entry.name;
      const description = extractFrontmatterField(adapted, 'description');

      skills.push({ name, description, content: adapted, filePath: skillFile });
    } catch {
      // Skip skills without SKILL.md
    }
  }

  console.log(`Loaded ${skills.length} skills from ${skillsDir}`);
  return skills;
}

export function buildSkillsSummary(skills: Skill[]): string {
  return skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');
}

export function buildFullSkillsPrompt(skills: Skill[]): string {
  return skills
    .map((s) => `<skill name="${s.name}">\n${s.content}\n</skill>`)
    .join('\n\n');
}
