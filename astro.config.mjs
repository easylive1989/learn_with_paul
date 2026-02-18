import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anthropics.github.io',
  base: '/learn_with_paul',
  integrations: [sitemap()],
  output: 'static',
  vite: {
    ssr: {
      external: ['@notionhq/client'],
    },
  },
});
