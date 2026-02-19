import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalImagePath, replaceImageUrls, downloadImages } from '../../src/lib/images';
import type { NotionBlock } from '../../src/lib/notion';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

    const path1 = getLocalImagePath(url1, 'series', 'post');
    const path2 = getLocalImagePath(url2, 'series', 'post');

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

describe('downloadImages', () => {
  let tmpDir: string;
  let publicDir: string;
  let distDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-test-'));
    publicDir = path.join(tmpDir, 'public');
    distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(publicDir);
    fs.mkdirSync(distDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes downloaded images to both public and dist directories', async () => {
    const fakeImage = Buffer.from('fake-png-data');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeImage.buffer),
    }) as any;

    const imageMap = {
      'https://example.com/img.png': '/images/notion/series/post/abc123.png',
    };

    await downloadImages(imageMap, publicDir, distDir);

    const publicFile = path.join(publicDir, 'images/notion/series/post/abc123.png');
    const distFile = path.join(distDir, 'images/notion/series/post/abc123.png');

    expect(fs.existsSync(publicFile)).toBe(true);
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it('copies cached public images to dist on subsequent runs', async () => {
    // Pre-populate public/ with a cached image
    const imgPath = path.join(publicDir, 'images/notion/series/post/abc123.png');
    fs.mkdirSync(path.dirname(imgPath), { recursive: true });
    fs.writeFileSync(imgPath, 'cached-image');

    const imageMap = {
      'https://example.com/img.png': '/images/notion/series/post/abc123.png',
    };

    await downloadImages(imageMap, publicDir, distDir);

    const distFile = path.join(distDir, 'images/notion/series/post/abc123.png');
    expect(fs.existsSync(distFile)).toBe(true);
    expect(fs.readFileSync(distFile, 'utf-8')).toBe('cached-image');
  });

  it('works without distDir (dev mode)', async () => {
    const fakeImage = Buffer.from('fake-png-data');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeImage.buffer),
    }) as any;

    const imageMap = {
      'https://example.com/img.png': '/images/notion/series/post/abc123.png',
    };

    await downloadImages(imageMap, publicDir);

    const publicFile = path.join(publicDir, 'images/notion/series/post/abc123.png');
    expect(fs.existsSync(publicFile)).toBe(true);
  });
});
