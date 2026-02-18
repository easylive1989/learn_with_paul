import { describe, it, expect } from 'vitest';
import { loadConfig, type SiteConfig } from '../../src/lib/config';

describe('loadConfig', () => {
  it('loads and parses site.config.yaml', () => {
    const config = loadConfig();

    expect(config.site.title).toBe('Learn with Paul');
    expect(config.author.name).toBeDefined();
    expect(config.author.links).toBeInstanceOf(Array);
    expect(config.notion.databases).toBeInstanceOf(Array);
    expect(config.notion.databases.length).toBeGreaterThan(0);

    const db = config.notion.databases[0];
    expect(db.id).toBeDefined();
    expect(db.slug).toBeDefined();
    expect(db.name).toBeDefined();
  });
});
