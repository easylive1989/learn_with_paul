# Learn with Paul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static blog that renders Notion database articles, deployed on GitHub Pages.

**Architecture:** Astro SSG pulls content from Notion API at build time, renders Notion blocks as Astro components, downloads images locally, and deploys via GitHub Actions.

**Tech Stack:** Astro 5, @notionhq/client, TypeScript, Playwright, GitHub Actions

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/pages/index.astro` (placeholder)

**Step 1: Initialize Astro project**

Run:
```bash
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict
```

**Step 2: Install dependencies**

Run:
```bash
npm install @notionhq/client yaml
npm install -D @astrojs/sitemap @playwright/test
```

**Step 3: Configure Astro for GitHub Pages**

Modify `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://paulwu.github.io',
  base: '/learn_with_paul',
  integrations: [sitemap()],
  output: 'static',
});
```

Note: `site` and `base` will be read from `site.config.yaml` later, but Astro config needs them statically. The user should update these values.

**Step 4: Update `.gitignore`**

Append to `.gitignore`:
```
public/images/notion/
.env
```

**Step 5: Create `.env.example`**

Create `.env.example`:
```
NOTION_API_KEY=your_notion_integration_token_here
```

**Step 6: Verify the project builds**

Run: `npx astro build`
Expected: Build succeeds, output in `dist/`

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project with dependencies"
```

---

## Task 2: Configuration System

**Files:**
- Create: `site.config.yaml`
- Create: `src/lib/config.ts`
- Create: `tests/lib/config.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig, type SiteConfig } from '../../src/lib/config';

describe('loadConfig', () => {
  it('loads and parses site.config.yaml', () => {
    const config = loadConfig();

    expect(config.site.title).toBe('Learn with Paul');
    expect(config.author.name).toBeDefined();
    expect(config.author.links).toBeInstanceOf(Array);
    expect(config.notion.databases).toBeInstanceOf(Array);
    expect(config.notion.databases.length).toBeGreaterThan(0);

    const db = config.notion.databases[0];
    expect(db.id).toBeDefined();
    expect(db.slug).toBeDefined();
    expect(db.name).toBeDefined();
  });
});
```

**Step 2: Install vitest and configure**

Run: `npm install -D vitest`

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
  },
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/config.test.ts`
Expected: FAIL — module not found

**Step 4: Create `site.config.yaml`**

```yaml
site:
  title: "Learn with Paul"
  description: "Paul 的技術學習筆記"
  url: "https://paulwu.github.io/learn_with_paul"

author:
  name: "Paul"
  avatar: "/images/avatar.jpg"
  bio: "技術愛好者"
  links:
    - type: github
      url: "https://github.com/anthropics"
    - type: email
      url: "mailto:hello@example.com"

notion:
  databases:
    - id: "placeholder-database-id"
      name: "示範系列"
      slug: "demo-series"
      description: "這是一個示範系列"

build:
  schedule: "0 0 * * *"
```

**Step 5: Implement `src/lib/config.ts`**

```ts
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
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run tests/lib/config.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add site.config.yaml src/lib/config.ts tests/lib/config.test.ts vitest.config.ts .env.example
git commit -m "feat: add YAML configuration system with types"
```

---

## Task 3: Notion API Client

**Files:**
- Create: `src/lib/notion.ts`
- Create: `tests/lib/notion.test.ts`

**Step 1: Write the failing test for `fetchDatabase`**

Create `tests/lib/notion.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @notionhq/client before importing our module
vi.mock('@notionhq/client', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      databases: {
        query: vi.fn(),
      },
      blocks: {
        children: {
          list: vi.fn(),
        },
      },
    })),
  };
});

import { Client } from '@notionhq/client';
import { fetchDatabase, fetchPageBlocks } from '../../src/lib/notion';

describe('fetchDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries database and returns published articles', async () => {
    const mockPages = [
      {
        id: 'page-1',
        properties: {
          Title: { title: [{ plain_text: 'First Post' }] },
          Slug: { rich_text: [{ plain_text: 'first-post' }] },
          Description: { rich_text: [{ plain_text: 'My first post' }] },
          Tags: { multi_select: [{ name: 'typescript' }] },
          PublishedDate: { date: { start: '2026-01-15' } },
          Status: { select: { name: 'Published' } },
          Order: { number: 1 },
          Cover: { files: [] },
        },
        cover: null,
      },
    ];

    const mockClient = new Client({ auth: 'test' });
    (mockClient.databases.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: mockPages,
      has_more: false,
    });

    const articles = await fetchDatabase(mockClient, 'db-id-1');

    expect(mockClient.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({
        database_id: 'db-id-1',
        filter: expect.objectContaining({
          property: 'Status',
        }),
      })
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('First Post');
    expect(articles[0].slug).toBe('first-post');
    expect(articles[0].tags).toEqual(['typescript']);
  });
});

describe('fetchPageBlocks', () => {
  it('fetches all blocks recursively', async () => {
    const mockBlocks = [
      {
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        paragraph: {
          rich_text: [{ plain_text: 'Hello world', annotations: {}, type: 'text', text: { content: 'Hello world', link: null } }],
        },
      },
      {
        id: 'block-2',
        type: 'toggle',
        has_children: true,
        toggle: {
          rich_text: [{ plain_text: 'Toggle title', annotations: {}, type: 'text', text: { content: 'Toggle title', link: null } }],
        },
      },
    ];

    const childBlocks = [
      {
        id: 'block-3',
        type: 'paragraph',
        has_children: false,
        paragraph: {
          rich_text: [{ plain_text: 'Inside toggle', annotations: {}, type: 'text', text: { content: 'Inside toggle', link: null } }],
        },
      },
    ];

    const mockClient = new Client({ auth: 'test' });
    const listFn = mockClient.blocks.children.list as ReturnType<typeof vi.fn>;

    // First call: top-level blocks
    listFn.mockResolvedValueOnce({ results: mockBlocks, has_more: false });
    // Second call: children of toggle block
    listFn.mockResolvedValueOnce({ results: childBlocks, has_more: false });

    const blocks = await fetchPageBlocks(mockClient, 'page-1');

    expect(blocks).toHaveLength(2);
    expect(blocks[1].children).toHaveLength(1);
    expect(blocks[1].children![0].id).toBe('block-3');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/notion.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `src/lib/notion.ts`**

```ts
import type { Client } from '@notionhq/client';

export interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  publishedDate: string;
  order: number | null;
  cover: string | null;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
  [key: string]: unknown;
}

export async function fetchDatabase(
  client: Client,
  databaseId: string,
): Promise<Article[]> {
  const pages: Article[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await client.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        select: { equals: 'Published' },
      },
      sorts: [{ property: 'PublishedDate', direction: 'descending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      const p = page as any;
      const props = p.properties;

      pages.push({
        id: p.id,
        title: props.Title?.title?.[0]?.plain_text ?? 'Untitled',
        slug: props.Slug?.rich_text?.[0]?.plain_text ?? p.id,
        description: props.Description?.rich_text?.[0]?.plain_text ?? '',
        tags: props.Tags?.multi_select?.map((t: any) => t.name) ?? [],
        publishedDate: props.PublishedDate?.date?.start ?? '',
        order: props.Order?.number ?? null,
        cover: props.Cover?.files?.[0]?.file?.url
          ?? props.Cover?.files?.[0]?.external?.url
          ?? p.cover?.file?.url
          ?? p.cover?.external?.url
          ?? null,
      });
    }

    cursor = response.has_more ? (response as any).next_cursor : undefined;
  } while (cursor);

  return pages;
}

export async function fetchPageBlocks(
  client: Client,
  pageId: string,
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });

    for (const block of response.results) {
      const b = block as any;
      const notionBlock: NotionBlock = { ...b };

      if (b.has_children) {
        notionBlock.children = await fetchPageBlocks(client, b.id);
      }

      blocks.push(notionBlock);
    }

    cursor = response.has_more ? (response as any).next_cursor : undefined;
  } while (cursor);

  return blocks;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/notion.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/notion.ts tests/lib/notion.test.ts
git commit -m "feat: add Notion API client with database query and block fetching"
```

---

## Task 4: Image Downloader

**Files:**
- Create: `src/lib/images.ts`
- Create: `tests/lib/images.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/images.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalImagePath, replaceImageUrls } from '../../src/lib/images';
import type { NotionBlock } from '../../src/lib/notion';

describe('getLocalImagePath', () => {
  it('generates a path based on series slug and article slug', () => {
    const url = 'https://prod-files.notion.so/abc123.png?signature=xyz';
    const result = getLocalImagePath(url, 'flutter-notes', 'first-post');

    expect(result).toMatch(/^\/images\/notion\/flutter-notes\/first-post\//);
    expect(result).toMatch(/\.png$/);
  });

  it('uses content hash for filename', () => {
    const url1 = 'https://prod-files.notion.so/abc123.png?sig=1';
    const url2 = 'https://prod-files.notion.so/abc123.png?sig=2';

    // Same base path should produce same hash (ignoring query params that change)
    const path1 = getLocalImagePath(url1, 'series', 'post');
    const path2 = getLocalImagePath(url2, 'series', 'post');

    // Different query params (signed URLs) still point to the same image path
    expect(path1).toBe(path2);
  });
});

describe('replaceImageUrls', () => {
  it('replaces image block URLs with local paths', () => {
    const blocks: NotionBlock[] = [
      {
        id: 'b1',
        type: 'image',
        has_children: false,
        image: {
          type: 'file',
          file: { url: 'https://prod-files.notion.so/img1.png?sig=abc' },
        },
      },
      {
        id: 'b2',
        type: 'paragraph',
        has_children: false,
        paragraph: { rich_text: [] },
      },
    ];

    const { blocks: updated, imageMap } = replaceImageUrls(
      blocks,
      'series-a',
      'my-post'
    );

    expect(Object.keys(imageMap)).toHaveLength(1);
    const localPath = Object.values(imageMap)[0];
    expect(localPath).toMatch(/^\/images\/notion\//);

    const imgBlock = updated[0] as any;
    expect(imgBlock.image.file.url).toBe(localPath);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/images.test.ts`
Expected: FAIL

**Step 3: Implement `src/lib/images.ts`**

```ts
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NotionBlock } from './notion';

export function getLocalImagePath(
  url: string,
  seriesSlug: string,
  articleSlug: string,
): string {
  // Strip query params for hashing (Notion signed URLs change the params)
  const urlObj = new URL(url);
  const basePath = urlObj.origin + urlObj.pathname;
  const hash = createHash('md5').update(basePath).digest('hex').slice(0, 12);
  const ext = path.extname(urlObj.pathname) || '.png';

  return `/images/notion/${seriesSlug}/${articleSlug}/${hash}${ext}`;
}

interface ImageMap {
  [remoteUrl: string]: string; // remote URL → local path
}

export function replaceImageUrls(
  blocks: NotionBlock[],
  seriesSlug: string,
  articleSlug: string,
): { blocks: NotionBlock[]; imageMap: ImageMap } {
  const imageMap: ImageMap = {};

  function processBlocks(blocks: NotionBlock[]): NotionBlock[] {
    return blocks.map((block) => {
      const updated = { ...block };

      if (block.type === 'image') {
        const img = (block as any).image;
        const url = img?.file?.url ?? img?.external?.url;
        if (url) {
          const localPath = getLocalImagePath(url, seriesSlug, articleSlug);
          imageMap[url] = localPath;

          if (img.file) {
            updated.image = { ...img, file: { ...img.file, url: localPath } };
          } else if (img.external) {
            updated.image = { ...img, external: { ...img.external, url: localPath } };
          }
        }
      }

      if (block.children) {
        updated.children = processBlocks(block.children);
      }

      return updated;
    });
  }

  const updatedBlocks = processBlocks(blocks);
  return { blocks: updatedBlocks, imageMap };
}

export async function downloadImages(
  imageMap: ImageMap,
  publicDir: string,
): Promise<void> {
  for (const [remoteUrl, localPath] of Object.entries(imageMap)) {
    const filePath = path.join(publicDir, localPath);
    const dir = path.dirname(filePath);

    if (fs.existsSync(filePath)) {
      continue; // Already downloaded
    }

    fs.mkdirSync(dir, { recursive: true });

    try {
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        console.warn(`Failed to download image: ${remoteUrl} (${response.status})`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      console.warn(`Failed to download image: ${remoteUrl}`, err);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/images.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/images.ts tests/lib/images.test.ts
git commit -m "feat: add image downloader with content hashing and URL replacement"
```

---

## Task 5: Notion Rich Text Renderer

**Files:**
- Create: `src/lib/richtext.ts`
- Create: `tests/lib/richtext.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/richtext.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderRichText } from '../../src/lib/richtext';

describe('renderRichText', () => {
  it('renders plain text', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'Hello world', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'Hello world',
      },
    ];
    expect(renderRichText(richText)).toBe('Hello world');
  });

  it('renders bold text', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'bold', link: null },
        annotations: {
          bold: true, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'bold',
      },
    ];
    expect(renderRichText(richText)).toBe('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'const x', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: true, color: 'default',
        },
        plain_text: 'const x',
      },
    ];
    expect(renderRichText(richText)).toBe('<code>const x</code>');
  });

  it('renders links', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'click here', link: { url: 'https://example.com' } },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'click here',
      },
    ];
    expect(renderRichText(richText)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">click here</a>'
    );
  });

  it('renders combined annotations', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'bold italic', link: null },
        annotations: {
          bold: true, italic: true, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'bold italic',
      },
    ];
    expect(renderRichText(richText)).toBe('<strong><em>bold italic</em></strong>');
  });

  it('escapes HTML in text content', () => {
    const richText = [
      {
        type: 'text',
        text: { content: '<script>alert("xss")</script>', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: '<script>alert("xss")</script>',
      },
    ];
    const result = renderRichText(richText);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/richtext.test.ts`
Expected: FAIL

**Step 3: Implement `src/lib/richtext.ts`**

```ts
export interface RichTextItem {
  type: string;
  text: {
    content: string;
    link: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRichText(richText: RichTextItem[]): string {
  return richText
    .map((item) => {
      let text = escapeHtml(item.text.content);

      if (item.annotations.code) {
        text = `<code>${text}</code>`;
      }
      if (item.annotations.italic) {
        text = `<em>${text}</em>`;
      }
      if (item.annotations.bold) {
        text = `<strong>${text}</strong>`;
      }
      if (item.annotations.strikethrough) {
        text = `<s>${text}</s>`;
      }
      if (item.annotations.underline) {
        text = `<u>${text}</u>`;
      }

      if (item.text.link) {
        text = `<a href="${escapeHtml(item.text.link.url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }

      return text;
    })
    .join('');
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/richtext.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/richtext.ts tests/lib/richtext.test.ts
git commit -m "feat: add Notion rich text renderer with HTML escaping"
```

---

## Task 6: Notion Block Renderer Components

**Files:**
- Create: `src/components/notion/NotionRenderer.astro`
- Create: `src/components/notion/Paragraph.astro`
- Create: `src/components/notion/Heading.astro`
- Create: `src/components/notion/Code.astro`
- Create: `src/components/notion/Image.astro`
- Create: `src/components/notion/Video.astro`
- Create: `src/components/notion/BulletedList.astro`
- Create: `src/components/notion/NumberedList.astro`
- Create: `src/components/notion/Quote.astro`
- Create: `src/components/notion/Callout.astro`
- Create: `src/components/notion/Toggle.astro`
- Create: `src/components/notion/Divider.astro`
- Create: `src/components/notion/Bookmark.astro`
- Create: `src/components/notion/Table.astro`

**Step 1: Create `NotionRenderer.astro`**

This is the main dispatcher that maps block types to components.

```astro
---
import type { NotionBlock } from '../../lib/notion';
import Paragraph from './Paragraph.astro';
import Heading from './Heading.astro';
import Code from './Code.astro';
import ImageBlock from './Image.astro';
import Video from './Video.astro';
import BulletedList from './BulletedList.astro';
import NumberedList from './NumberedList.astro';
import Quote from './Quote.astro';
import Callout from './Callout.astro';
import Toggle from './Toggle.astro';
import Divider from './Divider.astro';
import Bookmark from './Bookmark.astro';
import Table from './Table.astro';

interface Props {
  blocks: NotionBlock[];
}

const { blocks } = Astro.props;

// Group consecutive list items into lists
function groupBlocks(blocks: NotionBlock[]): (NotionBlock | NotionBlock[])[] {
  const grouped: (NotionBlock | NotionBlock[])[] = [];
  let currentList: NotionBlock[] = [];
  let currentListType: string | null = null;

  for (const block of blocks) {
    if (
      block.type === 'bulleted_list_item' ||
      block.type === 'numbered_list_item'
    ) {
      if (currentListType === block.type) {
        currentList.push(block);
      } else {
        if (currentList.length > 0) {
          grouped.push(currentList);
        }
        currentList = [block];
        currentListType = block.type;
      }
    } else {
      if (currentList.length > 0) {
        grouped.push(currentList);
        currentList = [];
        currentListType = null;
      }
      grouped.push(block);
    }
  }

  if (currentList.length > 0) {
    grouped.push(currentList);
  }

  return grouped;
}

const groupedBlocks = groupBlocks(blocks);
---

{groupedBlocks.map((item) => {
  if (Array.isArray(item)) {
    const listType = item[0].type;
    if (listType === 'bulleted_list_item') {
      return <BulletedList items={item} />;
    } else {
      return <NumberedList items={item} />;
    }
  }

  const block = item;

  switch (block.type) {
    case 'paragraph':
      return <Paragraph block={block} />;
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return <Heading block={block} />;
    case 'code':
      return <Code block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'video':
      return <Video block={block} />;
    case 'quote':
      return <Quote block={block} />;
    case 'callout':
      return <Callout block={block} />;
    case 'toggle':
      return <Toggle block={block} />;
    case 'divider':
      return <Divider />;
    case 'bookmark':
      return <Bookmark block={block} />;
    case 'table':
      return <Table block={block} />;
    default:
      return null;
  }
})}
```

**Step 2: Create each block component**

`src/components/notion/Paragraph.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const text = renderRichText((block as any).paragraph.rich_text);
---
<p set:html={text} />
```

`src/components/notion/Heading.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const level = block.type.replace('heading_', '');
const data = (block as any)[block.type];
const text = renderRichText(data.rich_text);
const id = data.rich_text.map((t: any) => t.plain_text).join('').toLowerCase().replace(/[^a-z0-9]+/g, '-');
---
{level === '1' && <h2 id={id} set:html={text} />}
{level === '2' && <h3 id={id} set:html={text} />}
{level === '3' && <h4 id={id} set:html={text} />}
```

Note: We map Notion h1→HTML h2, h2→h3, h3→h4 because the page `<h1>` is reserved for the article title.

`src/components/notion/Code.astro`:
```astro
---
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const code = (block as any).code;
const language = code.language || 'plain text';
const text = code.rich_text.map((t: any) => t.plain_text).join('');
const caption = code.caption?.map((t: any) => t.plain_text).join('') ?? '';
---
<div class="code-block">
  <div class="code-header">
    <span class="code-language">{language}</span>
  </div>
  <pre><code class={`language-${language}`}>{text}</code></pre>
  {caption && <p class="code-caption">{caption}</p>}
</div>
```

`src/components/notion/Image.astro`:
```astro
---
import type { NotionBlock } from '../../lib/notion';
import { loadConfig } from '../../lib/config';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const img = (block as any).image;
const url = img?.file?.url ?? img?.external?.url ?? '';
const caption = img.caption?.map((t: any) => t.plain_text).join('') ?? '';
const config = loadConfig();
const base = config.site.url.endsWith('/') ? config.site.url.slice(0, -1) : '';
---
<figure>
  <img src={url} alt={caption || 'Article image'} loading="lazy" />
  {caption && <figcaption>{caption}</figcaption>}
</figure>
```

`src/components/notion/Video.astro`:
```astro
---
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const video = (block as any).video;
const url = video?.file?.url ?? video?.external?.url ?? '';
const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
const isVimeo = url.includes('vimeo.com');

function getYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match?.[1] ?? '';
}

function getVimeoId(url: string): string {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match?.[1] ?? '';
}
---
<div class="video-container">
  {isYoutube && (
    <iframe
      src={`https://www.youtube.com/embed/${getYoutubeId(url)}`}
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy"
    />
  )}
  {isVimeo && (
    <iframe
      src={`https://player.vimeo.com/video/${getVimeoId(url)}`}
      frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      loading="lazy"
    />
  )}
  {!isYoutube && !isVimeo && (
    <video controls preload="metadata">
      <source src={url} />
    </video>
  )}
</div>
```

`src/components/notion/BulletedList.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import NotionRenderer from './NotionRenderer.astro';
import type { NotionBlock } from '../../lib/notion';

interface Props { items: NotionBlock[]; }
const { items } = Astro.props;
---
<ul>
  {items.map((item) => {
    const text = renderRichText((item as any).bulleted_list_item.rich_text);
    return (
      <li>
        <span set:html={text} />
        {item.children && <NotionRenderer blocks={item.children} />}
      </li>
    );
  })}
</ul>
```

`src/components/notion/NumberedList.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import NotionRenderer from './NotionRenderer.astro';
import type { NotionBlock } from '../../lib/notion';

interface Props { items: NotionBlock[]; }
const { items } = Astro.props;
---
<ol>
  {items.map((item) => {
    const text = renderRichText((item as any).numbered_list_item.rich_text);
    return (
      <li>
        <span set:html={text} />
        {item.children && <NotionRenderer blocks={item.children} />}
      </li>
    );
  })}
</ol>
```

`src/components/notion/Quote.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const text = renderRichText((block as any).quote.rich_text);
---
<blockquote set:html={text} />
```

`src/components/notion/Callout.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const callout = (block as any).callout;
const icon = callout.icon?.emoji ?? '';
const text = renderRichText(callout.rich_text);
---
<div class="callout">
  {icon && <span class="callout-icon">{icon}</span>}
  <div class="callout-content" set:html={text} />
</div>
```

`src/components/notion/Toggle.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import NotionRenderer from './NotionRenderer.astro';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const text = renderRichText((block as any).toggle.rich_text);
---
<details>
  <summary set:html={text} />
  {block.children && <NotionRenderer blocks={block.children} />}
</details>
```

`src/components/notion/Divider.astro`:
```astro
<hr />
```

`src/components/notion/Bookmark.astro`:
```astro
---
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const bookmark = (block as any).bookmark;
const url = bookmark.url;
const caption = bookmark.caption?.map((t: any) => t.plain_text).join('') ?? '';
---
<div class="bookmark">
  <a href={url} target="_blank" rel="noopener noreferrer">
    {caption || url}
  </a>
</div>
```

`src/components/notion/Table.astro`:
```astro
---
import { renderRichText } from '../../lib/richtext';
import type { NotionBlock } from '../../lib/notion';

interface Props { block: NotionBlock; }
const { block } = Astro.props;
const table = (block as any).table;
const hasHeader = table.has_column_header;
const rows = block.children ?? [];
---
<div class="table-wrapper">
  <table>
    {rows.map((row: any, i: number) => {
      const cells = row.table_row.cells;
      const isHeader = hasHeader && i === 0;
      return (
        <tr>
          {cells.map((cell: any) => {
            const content = renderRichText(cell);
            return isHeader
              ? <th set:html={content} />
              : <td set:html={content} />;
          })}
        </tr>
      );
    })}
  </table>
</div>
```

**Step 3: Verify build succeeds**

Run: `npx astro check` (if Astro check is available)
Run: `npx astro build`
Expected: Build succeeds (pages won't render yet since we haven't created real pages)

**Step 4: Commit**

```bash
git add src/components/notion/
git commit -m "feat: add Notion block renderer components"
```

---

## Task 7: Data Fetching Layer

**Files:**
- Create: `src/lib/data.ts`
- Create: `tests/lib/data.test.ts`

This module ties together Notion client, image processing, and config to provide data for Astro pages.

**Step 1: Write the failing test**

Create `tests/lib/data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/lib/notion', () => ({
  fetchDatabase: vi.fn(),
  fetchPageBlocks: vi.fn(),
}));

vi.mock('../../src/lib/images', () => ({
  replaceImageUrls: vi.fn().mockImplementation((blocks) => ({
    blocks,
    imageMap: {},
  })),
  downloadImages: vi.fn(),
}));

vi.mock('../../src/lib/config', () => ({
  loadConfig: vi.fn().mockReturnValue({
    site: { title: 'Test', description: 'Test', url: 'http://localhost' },
    author: { name: 'Test', avatar: '', bio: '', links: [] },
    notion: {
      databases: [
        { id: 'db-1', name: 'Series A', slug: 'series-a', description: 'Desc A' },
      ],
    },
    build: { schedule: '0 0 * * *' },
  }),
}));

import { getAllSeries, getSeriesArticles, getArticle } from '../../src/lib/data';
import { fetchDatabase, fetchPageBlocks } from '../../src/lib/notion';

describe('getAllSeries', () => {
  it('returns series from config with article counts', async () => {
    (fetchDatabase as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', title: 'Post 1', slug: 'post-1', description: '', tags: [], publishedDate: '2026-01-01', order: null, cover: null },
      { id: 'p2', title: 'Post 2', slug: 'post-2', description: '', tags: [], publishedDate: '2026-01-02', order: null, cover: null },
    ]);

    const series = await getAllSeries();
    expect(series).toHaveLength(1);
    expect(series[0].slug).toBe('series-a');
    expect(series[0].articleCount).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/data.test.ts`
Expected: FAIL

**Step 3: Implement `src/lib/data.ts`**

```ts
import { Client } from '@notionhq/client';
import { loadConfig } from './config';
import { fetchDatabase, fetchPageBlocks, type Article, type NotionBlock } from './notion';
import { replaceImageUrls, downloadImages } from './images';
import path from 'node:path';

function getNotionClient(): Client {
  const token = import.meta.env.NOTION_API_KEY ?? process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }
  return new Client({ auth: token });
}

export interface Series {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount: number;
}

export async function getAllSeries(): Promise<Series[]> {
  const config = loadConfig();
  const client = getNotionClient();

  const series: Series[] = [];

  for (const db of config.notion.databases) {
    const articles = await fetchDatabase(client, db.id);
    series.push({
      id: db.id,
      name: db.name,
      slug: db.slug,
      description: db.description,
      articleCount: articles.length,
    });
  }

  return series;
}

export async function getSeriesArticles(seriesSlug: string): Promise<Article[]> {
  const config = loadConfig();
  const client = getNotionClient();
  const db = config.notion.databases.find((d) => d.slug === seriesSlug);

  if (!db) return [];

  return fetchDatabase(client, db.id);
}

export interface ArticleWithContent {
  article: Article;
  blocks: NotionBlock[];
  seriesSlug: string;
  seriesName: string;
}

export async function getArticle(
  seriesSlug: string,
  articleSlug: string,
): Promise<ArticleWithContent | null> {
  const config = loadConfig();
  const client = getNotionClient();
  const db = config.notion.databases.find((d) => d.slug === seriesSlug);

  if (!db) return null;

  const articles = await fetchDatabase(client, db.id);
  const article = articles.find((a) => a.slug === articleSlug);

  if (!article) return null;

  const rawBlocks = await fetchPageBlocks(client, article.id);
  const { blocks, imageMap } = replaceImageUrls(rawBlocks, seriesSlug, articleSlug);

  // Download images during build
  const publicDir = path.resolve(process.cwd(), 'public');
  await downloadImages(imageMap, publicDir);

  return {
    article,
    blocks,
    seriesSlug,
    seriesName: db.name,
  };
}

export async function getAllArticlesForStaticPaths(): Promise<
  { seriesSlug: string; articleSlug: string }[]
> {
  const config = loadConfig();
  const client = getNotionClient();
  const paths: { seriesSlug: string; articleSlug: string }[] = [];

  for (const db of config.notion.databases) {
    const articles = await fetchDatabase(client, db.id);
    for (const article of articles) {
      paths.push({ seriesSlug: db.slug, articleSlug: article.slug });
    }
  }

  return paths;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/data.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/data.ts tests/lib/data.test.ts
git commit -m "feat: add data fetching layer tying Notion client, images, and config"
```

---

## Task 8: Layout & Shared Components

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`
- Create: `src/components/AuthorCard.astro`
- Create: `src/components/SeriesCard.astro`
- Create: `src/components/ArticleCard.astro`

**Step 1: Create `BaseLayout.astro`**

```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { loadConfig } from '../lib/config';
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
  ogImage?: string;
}

const config = loadConfig();
const {
  title = config.site.title,
  description = config.site.description,
  ogImage,
} = Astro.props;

const pageTitle = title === config.site.title
  ? title
  : `${title} | ${config.site.title}`;
const canonicalUrl = new URL(Astro.url.pathname, config.site.url);
---

<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl.href} />

    <!-- Open Graph -->
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalUrl.href} />
    {ogImage && <meta property="og:image" content={ogImage} />}

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={pageTitle} />
    <meta name="twitter:description" content={description} />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

**Step 2: Create `Header.astro`**

```astro
---
import { loadConfig } from '../lib/config';
const config = loadConfig();
---

<header>
  <nav>
    <a href={import.meta.env.BASE_URL} class="site-title">{config.site.title}</a>
  </nav>
</header>
```

**Step 3: Create `Footer.astro`**

```astro
---
import { loadConfig } from '../lib/config';
const config = loadConfig();

const iconMap: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  email: 'Email',
};
---

<footer>
  <div class="footer-links">
    {config.author.links.map((link) => (
      <a href={link.url} target="_blank" rel="noopener noreferrer">
        {iconMap[link.type] ?? link.type}
      </a>
    ))}
  </div>
  <p class="copyright">
    &copy; {new Date().getFullYear()} {config.author.name}
  </p>
</footer>
```

**Step 4: Create `AuthorCard.astro`**

```astro
---
import { loadConfig } from '../lib/config';
const config = loadConfig();

const iconMap: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  email: 'Email',
};
---

<div class="author-card">
  <img
    src={`${import.meta.env.BASE_URL}${config.author.avatar}`}
    alt={config.author.name}
    class="author-avatar"
    width="80"
    height="80"
  />
  <div class="author-info">
    <h2 class="author-name">{config.author.name}</h2>
    <p class="author-bio">{config.author.bio}</p>
    <div class="author-links">
      {config.author.links.map((link) => (
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          {iconMap[link.type] ?? link.type}
        </a>
      ))}
    </div>
  </div>
</div>
```

**Step 5: Create `SeriesCard.astro`**

```astro
---
interface Props {
  name: string;
  slug: string;
  description: string;
  articleCount: number;
}

const { name, slug, description, articleCount } = Astro.props;
---

<a href={`${import.meta.env.BASE_URL}${slug}/`} class="series-card">
  <h2 class="series-name">{name}</h2>
  <p class="series-description">{description}</p>
  <span class="series-count">{articleCount} 篇文章</span>
</a>
```

**Step 6: Create `ArticleCard.astro`**

```astro
---
interface Props {
  title: string;
  slug: string;
  seriesSlug: string;
  description: string;
  publishedDate: string;
  tags: string[];
}

const { title, slug, seriesSlug, description, publishedDate, tags } = Astro.props;

const formattedDate = new Date(publishedDate).toLocaleDateString('zh-TW', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
---

<a href={`${import.meta.env.BASE_URL}${seriesSlug}/${slug}/`} class="article-card">
  <h3 class="article-title">{title}</h3>
  {description && <p class="article-description">{description}</p>}
  <div class="article-meta">
    <time datetime={publishedDate}>{formattedDate}</time>
    {tags.length > 0 && (
      <div class="article-tags">
        {tags.map((tag) => <span class="tag">{tag}</span>)}
      </div>
    )}
  </div>
</a>
```

**Step 7: Commit**

```bash
git add src/layouts/ src/components/Header.astro src/components/Footer.astro src/components/AuthorCard.astro src/components/SeriesCard.astro src/components/ArticleCard.astro
git commit -m "feat: add layout and shared UI components"
```

---

## Task 9: Pages

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/[series]/index.astro`
- Create: `src/pages/[series]/[slug].astro`

**Step 1: Create homepage `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AuthorCard from '../components/AuthorCard.astro';
import SeriesCard from '../components/SeriesCard.astro';
import { getAllSeries } from '../lib/data';

const series = await getAllSeries();
---

<BaseLayout>
  <AuthorCard />

  <section class="series-list">
    <h1>文章系列</h1>
    {series.length === 0 && <p>目前沒有文章系列。</p>}
    {series.map((s) => (
      <SeriesCard
        name={s.name}
        slug={s.slug}
        description={s.description}
        articleCount={s.articleCount}
      />
    ))}
  </section>
</BaseLayout>
```

**Step 2: Create series page `src/pages/[series]/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleCard from '../../components/ArticleCard.astro';
import { loadConfig } from '../../lib/config';
import { getSeriesArticles } from '../../lib/data';

export async function getStaticPaths() {
  const config = loadConfig();
  return config.notion.databases.map((db) => ({
    params: { series: db.slug },
    props: { seriesName: db.name, seriesDescription: db.description },
  }));
}

const { series } = Astro.params;
const { seriesName, seriesDescription } = Astro.props;
const articles = await getSeriesArticles(series!);
---

<BaseLayout title={seriesName} description={seriesDescription}>
  <section class="series-page">
    <a href={import.meta.env.BASE_URL} class="back-link">&larr; 回首頁</a>
    <h1>{seriesName}</h1>
    <p class="series-description">{seriesDescription}</p>

    <div class="article-list">
      {articles.map((article) => (
        <ArticleCard
          title={article.title}
          slug={article.slug}
          seriesSlug={series!}
          description={article.description}
          publishedDate={article.publishedDate}
          tags={article.tags}
        />
      ))}
    </div>
  </section>
</BaseLayout>
```

**Step 3: Create article page `src/pages/[series]/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import NotionRenderer from '../../components/notion/NotionRenderer.astro';
import { loadConfig } from '../../lib/config';
import { getArticle, getAllArticlesForStaticPaths, getSeriesArticles } from '../../lib/data';

export async function getStaticPaths() {
  const paths = await getAllArticlesForStaticPaths();
  return paths.map((p) => ({
    params: { series: p.seriesSlug, slug: p.articleSlug },
  }));
}

const { series, slug } = Astro.params;
const data = await getArticle(series!, slug!);

if (!data) {
  return Astro.redirect('/404');
}

const { article, blocks, seriesSlug, seriesName } = data;

// Get prev/next articles
const allArticles = await getSeriesArticles(seriesSlug);
const currentIndex = allArticles.findIndex((a) => a.slug === slug);
const prevArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;
const nextArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;

const formattedDate = new Date(article.publishedDate).toLocaleDateString('zh-TW', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const config = loadConfig();
---

<BaseLayout title={article.title} description={article.description}>
  <article class="article-page">
    <a href={`${import.meta.env.BASE_URL}${seriesSlug}/`} class="back-link">&larr; {seriesName}</a>

    <header class="article-header">
      <h1>{article.title}</h1>
      <div class="article-meta">
        <time datetime={article.publishedDate}>{formattedDate}</time>
        {article.tags.length > 0 && (
          <div class="article-tags">
            {article.tags.map((tag) => <span class="tag">{tag}</span>)}
          </div>
        )}
      </div>
    </header>

    <div class="article-content">
      <NotionRenderer blocks={blocks} />
    </div>

    <nav class="article-nav">
      {prevArticle && (
        <a href={`${import.meta.env.BASE_URL}${seriesSlug}/${prevArticle.slug}/`} class="nav-prev">
          &larr; {prevArticle.title}
        </a>
      )}
      {nextArticle && (
        <a href={`${import.meta.env.BASE_URL}${seriesSlug}/${nextArticle.slug}/`} class="nav-next">
          {nextArticle.title} &rarr;
        </a>
      )}
    </nav>
  </article>

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json" set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.description,
    "datePublished": article.publishedDate,
    "author": {
      "@type": "Person",
      "name": config.author.name,
    },
    "publisher": {
      "@type": "Organization",
      "name": config.site.title,
    },
  })} />
</BaseLayout>
```

**Step 4: Commit**

```bash
git add src/pages/
git commit -m "feat: add homepage, series page, and article page"
```

---

## Task 10: Global Styles

**Files:**
- Create: `src/styles/global.css`

**Step 1: Create `src/styles/global.css`**

```css
/* === Reset & Base === */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  color: #111;
  background: #fff;
  line-height: 1.7;
}

/* === Layout === */
main {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* === Header === */
header {
  border-bottom: 1px solid #eee;
  padding: 1rem 1.5rem;
}

header nav {
  max-width: 720px;
  margin: 0 auto;
}

.site-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111;
  text-decoration: none;
}

.site-title:hover {
  color: #666;
}

/* === Footer === */
footer {
  border-top: 1px solid #eee;
  padding: 2rem 1.5rem;
  text-align: center;
  color: #666;
  font-size: 0.875rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.footer-links a {
  color: #666;
  text-decoration: none;
}

.footer-links a:hover {
  color: #111;
}

/* === Author Card === */
.author-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.author-avatar {
  border-radius: 50%;
  object-fit: cover;
}

.author-name {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.author-bio {
  color: #666;
  margin-bottom: 0.5rem;
}

.author-links {
  display: flex;
  gap: 1rem;
}

.author-links a {
  color: #666;
  text-decoration: none;
  font-size: 0.875rem;
}

.author-links a:hover {
  color: #111;
}

/* === Series Card === */
.series-list h1 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.series-card {
  display: block;
  padding: 1.5rem;
  border: 1px solid #eee;
  text-decoration: none;
  color: inherit;
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}

.series-card:hover {
  border-color: #111;
}

.series-name {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.series-description {
  color: #666;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
}

.series-count {
  font-size: 0.875rem;
  color: #999;
}

/* === Article Card === */
.article-card {
  display: block;
  padding: 1.25rem 0;
  border-bottom: 1px solid #eee;
  text-decoration: none;
  color: inherit;
}

.article-card:first-child {
  border-top: 1px solid #eee;
}

.article-card:hover .article-title {
  color: #666;
}

.article-title {
  font-size: 1.125rem;
  margin-bottom: 0.25rem;
  transition: color 0.2s;
}

.article-description {
  color: #666;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #999;
}

.article-tags {
  display: flex;
  gap: 0.5rem;
}

.tag {
  background: #f5f5f5;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  color: #666;
}

/* === Article Page === */
.back-link {
  display: inline-block;
  margin-bottom: 2rem;
  color: #666;
  text-decoration: none;
  font-size: 0.875rem;
}

.back-link:hover {
  color: #111;
}

.article-header {
  margin-bottom: 2.5rem;
}

.article-header h1 {
  font-size: 2rem;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

/* === Article Content === */
.article-content p {
  margin-bottom: 1.25rem;
}

.article-content h2 {
  font-size: 1.5rem;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
}

.article-content h3 {
  font-size: 1.25rem;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.article-content h4 {
  font-size: 1.125rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.article-content ul,
.article-content ol {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
}

.article-content li {
  margin-bottom: 0.5rem;
}

.article-content a {
  color: #111;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.article-content a:hover {
  color: #666;
}

.article-content blockquote {
  border-left: 3px solid #111;
  padding-left: 1rem;
  color: #666;
  margin-bottom: 1.25rem;
  font-style: italic;
}

.article-content hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 2rem 0;
}

.article-content figure {
  margin: 1.5rem 0;
}

.article-content figure img {
  max-width: 100%;
  height: auto;
  display: block;
}

.article-content figcaption {
  font-size: 0.875rem;
  color: #666;
  text-align: center;
  margin-top: 0.5rem;
}

/* === Code Blocks === */
.code-block {
  margin-bottom: 1.5rem;
  border: 1px solid #e5e5e5;
  overflow: hidden;
}

.code-header {
  background: #1a1a1a;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: #999;
}

.code-block pre {
  background: #1a1a1a;
  padding: 1rem;
  overflow-x: auto;
  margin: 0;
}

.code-block code {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 0.875rem;
  color: #e5e5e5;
  line-height: 1.5;
}

.code-caption {
  font-size: 0.875rem;
  color: #666;
  padding: 0.5rem 1rem;
  border-top: 1px solid #e5e5e5;
}

.article-content code {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  background: #f5f5f5;
  padding: 0.125rem 0.375rem;
  font-size: 0.875em;
}

/* === Callout === */
.callout {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9f9f9;
  border: 1px solid #eee;
  margin-bottom: 1.25rem;
}

.callout-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

/* === Toggle === */
details {
  margin-bottom: 1.25rem;
  border: 1px solid #eee;
  padding: 0.75rem 1rem;
}

details summary {
  cursor: pointer;
  font-weight: 500;
}

details[open] summary {
  margin-bottom: 0.75rem;
}

/* === Video === */
.video-container {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  margin-bottom: 1.5rem;
}

.video-container iframe,
.video-container video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* === Bookmark === */
.bookmark {
  margin-bottom: 1.25rem;
}

.bookmark a {
  display: block;
  padding: 1rem;
  border: 1px solid #eee;
  color: #111;
  text-decoration: none;
  word-break: break-all;
}

.bookmark a:hover {
  border-color: #111;
}

/* === Table === */
.table-wrapper {
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #eee;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

th {
  font-weight: 600;
  background: #f9f9f9;
}

/* === Article Navigation === */
.article-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
  gap: 1rem;
}

.nav-prev,
.nav-next {
  color: #111;
  text-decoration: none;
  font-size: 0.9375rem;
  max-width: 45%;
}

.nav-prev:hover,
.nav-next:hover {
  color: #666;
}

.nav-next {
  margin-left: auto;
  text-align: right;
}

/* === Series Page === */
.series-page h1 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.series-page > .series-description {
  color: #666;
  margin-bottom: 2rem;
}

/* === Responsive === */
@media (max-width: 640px) {
  main {
    padding: 1.5rem 1rem;
  }

  .author-card {
    flex-direction: column;
    text-align: center;
  }

  .author-links {
    justify-content: center;
  }

  .article-header h1 {
    font-size: 1.5rem;
  }

  .article-nav {
    flex-direction: column;
  }

  .nav-prev,
  .nav-next {
    max-width: 100%;
  }

  .nav-next {
    text-align: left;
  }
}
```

**Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add global styles with black-and-white minimalist theme"
```

---

## Task 11: robots.txt

**Files:**
- Create: `public/robots.txt`

**Step 1: Create `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://paulwu.github.io/learn_with_paul/sitemap-index.xml
```

**Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat: add robots.txt for SEO"
```

---

## Task 12: E2E Tests with Playwright

**Files:**
- Create: `e2e/home.spec.ts`
- Create: `e2e/series.spec.ts`
- Create: `e2e/article.spec.ts`
- Create: `playwright.config.ts`

Note: E2E tests run against the built site. During CI, Notion data will be fetched during build. For local E2E testing, you need a `.env` file with `NOTION_API_KEY` and real database IDs in `site.config.yaml`.

**Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321/learn_with_paul/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx astro preview --port 4321',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 2: Create `e2e/home.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('displays site title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header .site-title')).toHaveText('Learn with Paul');
  });

  test('displays author information', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.author-card')).toBeVisible();
    await expect(page.locator('.author-name')).toBeVisible();
    await expect(page.locator('.author-bio')).toBeVisible();
  });

  test('displays series list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.series-card').first()).toBeVisible();
  });

  test('series card links to series page', async ({ page }) => {
    await page.goto('/');
    const firstSeries = page.locator('.series-card').first();
    await firstSeries.click();
    await expect(page).toHaveURL(/\/[a-z-]+\/$/);
  });

  test('has correct meta tags', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toContain('Learn with Paul');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });
});
```

**Step 3: Create `e2e/series.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Series Page', () => {
  test('displays series title and description', async ({ page }) => {
    // Navigate to a series via the homepage
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.series-description')).toBeVisible();
  });

  test('displays article list', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await expect(page.locator('.article-card').first()).toBeVisible();
  });

  test('article card shows title, date, and tags', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    const card = page.locator('.article-card').first();
    await expect(card.locator('.article-title')).toBeVisible();
    await expect(card.locator('time')).toBeVisible();
  });

  test('has back link to homepage', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();

    await page.locator('.back-link').click();
    await expect(page.locator('.series-list')).toBeVisible();
  });
});
```

**Step 4: Create `e2e/article.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Article Page', () => {
  test('displays article content', async ({ page }) => {
    // Navigate: home → series → first article
    await page.goto('/');
    await page.locator('.series-card').first().click();
    await page.locator('.article-card').first().click();

    await expect(page.locator('.article-header h1')).toBeVisible();
    await expect(page.locator('.article-content')).toBeVisible();
    await expect(page.locator('time')).toBeVisible();
  });

  test('has back link to series page', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();
    await page.locator('.article-card').first().click();

    await expect(page.locator('.back-link')).toBeVisible();
    await page.locator('.back-link').click();
    await expect(page.locator('.article-list')).toBeVisible();
  });

  test('images load without errors', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();
    await page.locator('.article-card').first().click();

    const images = page.locator('.article-content img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(
        (el: HTMLImageElement) => el.naturalWidth
      );
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    await page.locator('.series-card').first().click();
    await page.locator('.article-card').first().click();

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();

    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBeTruthy();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.series-card').first().click();
    await page.locator('.article-card').first().click();

    await expect(page.locator('.article-content')).toBeVisible();
    // Content should not overflow
    const content = page.locator('.article-content');
    const box = await content.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
```

**Step 5: Install Playwright browsers**

Run: `npx playwright install chromium`

**Step 6: Add test scripts to `package.json`**

Add to scripts:
```json
"test:e2e": "playwright test",
"preview": "astro preview"
```

**Step 7: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "feat: add Playwright E2E tests for homepage, series, and article pages"
```

---

## Task 13: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main, master]
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build site
        env:
          NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
        run: npx astro build

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests
        env:
          CI: true
        run: npx playwright test

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions workflow for build, test, and deploy"
```

---

## Task 14: Final Setup & Verify

**Step 1: Create placeholder avatar**

Place a placeholder image at `public/images/avatar.jpg` (any small square image).

**Step 2: Add a `.env` file locally (not committed)**

```
NOTION_API_KEY=your_actual_notion_api_key
```

**Step 3: Update `site.config.yaml` with real database IDs**

Replace `placeholder-database-id` with actual Notion database IDs.

**Step 4: Run full build and verify**

Run:
```bash
npx astro build
npx astro preview --port 4321
```

Open `http://localhost:4321/learn_with_paul/` in browser and verify:
- Homepage loads with author info and series list
- Series page shows articles
- Article page renders Notion content correctly
- Code blocks have syntax highlighting
- Images load
- Responsive layout works on mobile

**Step 5: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Run E2E tests**

Run: `npx playwright test`
Expected: All tests pass

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: finalize project setup"
```

---

## Summary of Commits

| # | Message |
|---|---------|
| 1 | `chore: scaffold Astro project with dependencies` |
| 2 | `feat: add YAML configuration system with types` |
| 3 | `feat: add Notion API client with database query and block fetching` |
| 4 | `feat: add image downloader with content hashing and URL replacement` |
| 5 | `feat: add Notion rich text renderer with HTML escaping` |
| 6 | `feat: add Notion block renderer components` |
| 7 | `feat: add data fetching layer tying Notion client, images, and config` |
| 8 | `feat: add layout and shared UI components` |
| 9 | `feat: add homepage, series page, and article page` |
| 10 | `feat: add global styles with black-and-white minimalist theme` |
| 11 | `feat: add robots.txt for SEO` |
| 12 | `feat: add Playwright E2E tests for homepage, series, and article pages` |
| 13 | `feat: add GitHub Actions workflow for build, test, and deploy` |
| 14 | `chore: finalize project setup` |
