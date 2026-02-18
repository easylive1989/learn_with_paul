import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://easylive1989.github.io',
  base: '/learn_with_paul/',
  integrations: [sitemap()],
  output: 'static',
  vite: {
    ssr: {
      external: ['@notionhq/client'],
    },
  },
});
