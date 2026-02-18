import { describe, it, expect } from 'vitest';
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
