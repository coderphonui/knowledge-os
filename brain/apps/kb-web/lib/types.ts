export interface KbNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: KbNode[];
}

export interface RecentFile {
  path: string;
  name: string;
  accessedAt: number;
}

export interface KbTemplate {
  name: string;
  displayName: string;
  description: string;
  frontmatterYaml: string;
  body: string;
}
