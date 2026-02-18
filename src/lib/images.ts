import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NotionBlock } from './notion';

export function getLocalImagePath(
  url: string,
  seriesSlug: string,
  articleSlug: string,
): string {
  const urlObj = new URL(url);
  const basePath = urlObj.origin + urlObj.pathname;
  const hash = createHash('md5').update(basePath).digest('hex').slice(0, 12);
  const ext = path.extname(urlObj.pathname) || '.png';

  return `/images/notion/${seriesSlug}/${articleSlug}/${hash}${ext}`;
}

interface ImageMap {
  [remoteUrl: string]: string;
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
      continue;
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
