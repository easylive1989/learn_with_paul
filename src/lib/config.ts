import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export interface AuthorLink {
  type: string;
  url: string;
}

export interface Author {
  name: string;
  avatar: string;
  bio: string;
  links: AuthorLink[];
}

export interface NotionDatabase {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface SiteConfig {
  site: {
    title: string;
    description: string;
    url: string;
  };
  author: Author;
  notion: {
    databases: NotionDatabase[];
  };
  build: {
    schedule: string;
  };
}

let cached: SiteConfig | null = null;

export function loadConfig(): SiteConfig {
  if (cached) return cached;

  const configPath = path.resolve(process.cwd(), 'site.config.yaml');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = parse(raw) as SiteConfig;
  cached = parsed;
  return parsed;
}
