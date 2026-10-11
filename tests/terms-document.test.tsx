import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TermsDocument from '@/components/TermsDocument';
import TermsBackLink from '@/components/TermsBackLink';
import TermsPage from '@/app/terms/page';
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';

const termsSource = readFileSync(path.join(process.cwd(), 'TERMS.md'), 'utf8');

function sourceWords(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const normalized: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith('|') && index + 1 < lines.length && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1].trim())) {
      normalized.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\|/g, ' '));
      index += 1;
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('|')) {
        index += 1;
        normalized.push(lines[index].trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\|/g, ' '));
      }
      continue;
    }
    normalized.push(line);
  }
  return normalized.join('\n')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderedWords(root: Element): string {
  const blockTags = new Set(['ARTICLE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const chunks: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent ?? '');
      return;
    }
    if (node instanceof Element && blockTags.has(node.tagName)) chunks.push(' ');
    node.childNodes.forEach(walk);
    if (node instanceof Element && blockTags.has(node.tagName)) chunks.push(' ');
  };
  walk(root);
  return chunks.join('').replace(/\s+/g, ' ').trim();
}

describe('TermsDocument', () => {
  it('renders every approved word in source order, including the derived update date', () => {
    const { container } = render(<TermsDocument source={termsSource} />);
    const article = container.querySelector('article');
    expect(article).not.toBeNull();
    expect(renderedWords(article!)).toBe(sourceWords(termsSource));
    const date = /^\*\*Last updated:\*\*\s*(.+)$/m.exec(termsSource)?.[1];
    expect(date).toBeTruthy();
    expect(screen.getByText(date!)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Terms of Service — Prism AAC', level: 1 })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Plan' })).toBeInTheDocument();
    expect(within(table).getByText('Prism AAC Cloud')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'synalux.ai/terms' })).toHaveAttribute('href', 'https://synalux.ai/terms');
    expect(screen.getByRole('link', { name: 'synalux.ai/terms' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'synalux.ai/terms' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders raw HTML and unsafe URLs as text, never as executable markup', () => {
    const { container } = render(<TermsDocument source={'# Safe\n\n<script>alert(1)</script> [click](javascript:alert(1)) [remote](//bad.example)'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText(/\[click\]\(javascript:alert\(1\)\)/)).toBeInTheDocument();
    expect(screen.getByText(/\[remote\]\(\/\/bad\.example\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('only turns HTTPS markdown URLs into links and preserves ordinary text', () => {
    render(<TermsDocument source={'Email support@example.com or [terms](https://example.com/terms).'} />);
    expect(screen.getByText('support@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', 'https://example.com/terms');
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('provides an English scroll region and same-tab return link under the AAC base path', async () => {
    render(await TermsPage());
    const region = screen.getByTestId('terms-scroll');
    expect(region).toHaveAttribute('lang', 'en');
    expect(region).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('link', { name: '← Prism AAC' })).toHaveAttribute('href', PRISM_AAC_BASE_PATH);
    expect(screen.getByRole('link', { name: '← Prism AAC' })).not.toHaveAttribute('target');
  });

  it('closes only a same-origin Terms iframe and otherwise keeps the regular return link', () => {
    const frame = document.createElement('iframe');
    frame.dataset.aacTermsFrame = 'true';
    const previousFrame = Object.getOwnPropertyDescriptor(window, 'frameElement');
    const previousParent = Object.getOwnPropertyDescriptor(window, 'parent');
    const postMessage = vi.fn();
    Object.defineProperty(window, 'frameElement', { configurable: true, value: frame });
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { location: { origin: window.location.origin }, postMessage },
    });
    const { unmount } = render(<TermsBackLink />);
    const link = screen.getByRole('link', { name: '← Prism AAC' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: 'aac-terms-close' }, window.location.origin);
    expect(link).toHaveAttribute('href', PRISM_AAC_BASE_PATH);
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { location: { origin: 'https://other.example' }, postMessage },
    });
    const crossOriginEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(crossOriginEvent);
    expect(crossOriginEvent.defaultPrevented).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
    unmount();
    if (previousFrame) Object.defineProperty(window, 'frameElement', previousFrame);
    else delete (window as Window & { frameElement?: Element | null }).frameElement;
    if (previousParent) Object.defineProperty(window, 'parent', previousParent);
  });
});
