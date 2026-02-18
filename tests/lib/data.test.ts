import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NOTION_API_KEY = 'test-key';
});

vi.mock('@notionhq/client', () => ({
  Client: class MockClient {
    constructor() {}
  },
}));

vi.mock('../../src/lib/notion', () => ({
  fetchDatabase: vi.fn(),
  fetchPageBlocks: vi.fn(),
}));

vi.mock('../../src/lib/images', () => ({
  replaceImageUrls: vi.fn().mockImplementation((blocks: any) => ({
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

import { getAllSeries } from '../../src/lib/data';
import { fetchDatabase } from '../../src/lib/notion';

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
