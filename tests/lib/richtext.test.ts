import { describe, it, expect } from 'vitest';
import { renderRichText } from '../../src/lib/richtext';

describe('renderRichText', () => {
  it('renders plain text', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'Hello world', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'Hello world',
      },
    ];
    expect(renderRichText(richText)).toBe('Hello world');
  });

  it('renders bold text', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'bold', link: null },
        annotations: {
          bold: true, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'bold',
      },
    ];
    expect(renderRichText(richText)).toBe('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'const x', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: true, color: 'default',
        },
        plain_text: 'const x',
      },
    ];
    expect(renderRichText(richText)).toBe('<code>const x</code>');
  });

  it('renders links', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'click here', link: { url: 'https://example.com' } },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'click here',
      },
    ];
    expect(renderRichText(richText)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">click here</a>'
    );
  });

  it('renders combined annotations', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'bold italic', link: null },
        annotations: {
          bold: true, italic: true, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: 'bold italic',
      },
    ];
    expect(renderRichText(richText)).toBe('<strong><em>bold italic</em></strong>');
  });

  it('escapes HTML in text content', () => {
    const richText = [
      {
        type: 'text',
        text: { content: '<script>alert("xss")</script>', link: null },
        annotations: {
          bold: false, italic: false, strikethrough: false,
          underline: false, code: false, color: 'default',
        },
        plain_text: '<script>alert("xss")</script>',
      },
    ];
    const result = renderRichText(richText);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});
