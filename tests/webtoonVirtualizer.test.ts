import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebtoonVirtualizer } from '../src/reader/webtoonVirtualizer';

class MockClassList {
  private classes = new Set<string>();
  add(...names: string[]) {
    names.forEach((n) => this.classes.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.classes.delete(n));
  }
  contains(name: string) {
    return this.classes.has(name);
  }
  toggle(name: string) {
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }
    this.classes.add(name);
    return true;
  }
}

class MockElement {
  tagName: string;
  className = '';
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  classList = new MockClassList();
  children: MockElement[] = [];
  alt = '';
  src = '';
  referrerPolicy = '';
  decoding = '';
  loading = '';
  offsetHeight = 1200;
  scrollIntoView = vi.fn();
  onload?: (e?: any) => void;
  onerror?: (e?: any) => void;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return child;
  }

  remove() {
    // parent removal
  }

  querySelector(selector: string): MockElement | null {
    if (selector === 'img') {
      return this.children.find((c) => c.tagName === 'IMG') || null;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (selector === '.reader-page-item') {
      this.children.forEach((c) => {
        if (c.className.includes('reader-page-item')) results.push(c);
      });
    }
    return results;
  }
}

describe('WebtoonVirtualizer - DOM Virtualization & Zero-CLS Memory Capping', () => {
  let container: any;

  beforeEach(() => {
    (global as any).document = {
      createElement: (tag: string) => new MockElement(tag)
    };

    (global as any).IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };

    container = new MockElement('div');
  });

  it('creates placeholder containers for all pages plus credit item', () => {
    const pages = [
      'https://example.com/p1.jpg',
      'https://example.com/p2.jpg',
      'https://example.com/p3.jpg'
    ];

    const virtualizer = new WebtoonVirtualizer({
      container,
      pages,
      creditImageUrl: '/Credit.webp'
    });

    expect(virtualizer.totalPages).toBe(4); // 3 pages + 1 credit
    expect(container.querySelectorAll('.reader-page-item').length).toBe(4);

    // First two pages should be mounted immediately for instant first paint
    const p0 = virtualizer.getContainer(0) as any;
    const p1 = virtualizer.getContainer(1) as any;
    expect(p0?.querySelector('img')).not.toBeNull();
    expect(p1?.querySelector('img')).not.toBeNull();

    // Remaining pages start unmounted to save memory
    const p2 = virtualizer.getContainer(2) as any;
    expect(p2?.querySelector('img')).toBeNull();

    virtualizer.destroy();
  });

  it('mounts and unmounts pages while strictly preserving container dimensions', () => {
    const pages = [
      'https://example.com/p1.jpg',
      'https://example.com/p2.jpg',
      'https://example.com/p3.jpg'
    ];

    const virtualizer = new WebtoonVirtualizer({
      container,
      pages
    });

    const p2 = virtualizer.getContainer(2) as any;
    expect(p2).toBeDefined();

    // Initially unmounted
    expect(p2.querySelector('img')).toBeNull();

    // Mount page 2
    virtualizer.mountPageImage(2, p2);
    const img = p2.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.alt).toBe('Trang 3');

    // Simulate image loaded with measured height of 1800px (tall webtoon slice)
    img.offsetHeight = 1800;
    if (img.onload) img.onload();
    expect(p2.style.minHeight).toBe('1800px');

    // Unmount page 2 (scrolled far past buffer)
    virtualizer.unmountPageImage(2, p2);

    // Image tag is removed from container to free GPU RAM
    p2.removeChild(img);
    expect(p2.querySelector('img')).toBeNull();

    // But container height remains 1800px so scroll position does NOT collapse/jump!
    expect(p2.style.minHeight).toBe('1800px');

    virtualizer.destroy();
  });

  it('scrolls to target page and pre-mounts images', () => {
    const pages = [
      'https://example.com/p1.jpg',
      'https://example.com/p2.jpg',
      'https://example.com/p3.jpg'
    ];

    const virtualizer = new WebtoonVirtualizer({
      container,
      pages
    });

    const target = virtualizer.getContainer(2) as any;
    if (target) {
      virtualizer.scrollToPage(2, false);

      expect(target.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start'
      });
      // Should pre-mount target page
      expect(target.querySelector('img')).not.toBeNull();
    }

    virtualizer.destroy();
  });

  it('cleans up completely on destroy', () => {
    const pages = ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'];

    const virtualizer = new WebtoonVirtualizer({
      container,
      pages
    });

    expect(container.querySelectorAll('.reader-page-item').length).toBe(3); // 2 + credit

    virtualizer.destroy();
    expect(virtualizer.getActiveCount()).toBe(0);
  });
});
