import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDatabase, fetchPageBlocks } from '../../src/lib/notion';

function createMockClient() {
  return {
    databases: {
      query: vi.fn(),
    },
    blocks: {
      children: {
        list: vi.fn(),
      },
    },
  };
}

describe('fetchDatabase', () => {
  it('queries database and returns articles with 完成 status', async () => {
    const mockPages = [
      {
        id: 'page-1',
        created_time: '2026-01-15T00:00:00.000Z',
        properties: {
          Name: { title: [{ plain_text: 'First Post' }] },
          '狀態': { select: { name: '完成' } },
        },
        cover: null,
      },
    ];

    const mockClient = createMockClient();
    mockClient.databases.query.mockResolvedValue({
      results: mockPages,
      has_more: false,
    });

    const articles = await fetchDatabase(mockClient as any, 'db-id-1');

    expect(mockClient.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({
        database_id: 'db-id-1',
        filter: expect.objectContaining({
          property: '狀態',
        }),
      })
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('First Post');
    expect(articles[0].slug).toBe('first-post');
    expect(articles[0].publishedDate).toBe('2026-01-15');
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

    const mockClient = createMockClient();
    const listFn = mockClient.blocks.children.list;

    // First call: top-level blocks
    listFn.mockResolvedValueOnce({ results: mockBlocks, has_more: false });
    // Second call: children of toggle block
    listFn.mockResolvedValueOnce({ results: childBlocks, has_more: false });

    const blocks = await fetchPageBlocks(mockClient as any, 'page-1');

    expect(blocks).toHaveLength(2);
    expect(blocks[1].children).toHaveLength(1);
    expect(blocks[1].children![0].id).toBe('block-3');
  });
});
