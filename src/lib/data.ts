import 'dotenv/config';
import { Client } from '@notionhq/client';
import { loadConfig } from './config';
import { fetchDatabase, fetchPageBlocks, type Article, type NotionBlock } from './notion';
import { replaceImageUrls, downloadImages } from './images';
import path from 'node:path';

function getNotionClient(): Client | null {
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    console.warn('NOTION_API_KEY not set — returning empty data');
    return null;
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
  if (!client) {
    return config.notion.databases.map((db) => ({
      id: db.id, name: db.name, slug: db.slug, description: db.description, articleCount: 0,
    }));
  }

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
  if (!client) return [];
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
  if (!client) return null;
  const db = config.notion.databases.find((d) => d.slug === seriesSlug);

  if (!db) return null;

  const articles = await fetchDatabase(client, db.id);
  const article = articles.find((a) => a.slug === articleSlug);

  if (!article) return null;

  const rawBlocks = await fetchPageBlocks(client, article.id);
  const { blocks, imageMap } = replaceImageUrls(rawBlocks, seriesSlug, articleSlug);

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
  if (!client) return [];
  const paths: { seriesSlug: string; articleSlug: string }[] = [];

  for (const db of config.notion.databases) {
    const articles = await fetchDatabase(client, db.id);
    for (const article of articles) {
      paths.push({ seriesSlug: db.slug, articleSlug: article.slug });
    }
  }

  return paths;
}
