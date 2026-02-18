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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getTitleText(props: any): string {
  // Try common title property names
  const titleProp = props.Title ?? props.Name ?? props.name;
  return titleProp?.title?.[0]?.plain_text ?? 'Untitled';
}

export async function fetchDatabase(
  client: Client,
  databaseId: string,
): Promise<Article[]> {
  const pages: Article[] = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const response = await client.databases.query({
        database_id: databaseId,
        filter: {
          property: '狀態',
          select: { equals: '完成' },
        },
        start_cursor: cursor,
      });

      for (const page of response.results) {
        const p = page as any;
        const props = p.properties;
        const title = getTitleText(props);

        pages.push({
          id: p.id,
          title,
          slug: props.Slug?.rich_text?.[0]?.plain_text ?? (slugify(title) || p.id),
          description: props.Description?.rich_text?.[0]?.plain_text ?? '',
          tags: props.Tags?.multi_select?.map((t: any) => t.name) ?? [],
          publishedDate: props.PublishedDate?.date?.start ?? p.created_time?.slice(0, 10) ?? '',
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
  } catch (err: any) {
    console.warn(`Failed to fetch database ${databaseId}: ${err.message}`);
    return [];
  }

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
