import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDatabase, fetchPageBlocks } from '../../src/lib/notion';

function createMockClient() {
  return {
    dataSources: {
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

    const mockClient = createMockClient();
    mockClient.dataSources.query.mockResolvedValue({
      results: mockPages,
      has_more: false,
    });

    const articles = await fetchDatabase(mockClient as any, 'db-id-1');

    expect(mockClient.dataSources.query).toHaveBeenCalledWith(
      expect.objectContaining({
        data_source_id: 'db-id-1',
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
