import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FittedTileLabel from '@/components/FittedTileLabel';

describe('FittedTileLabel', () => {
  let queuedFrames: FrameRequestCallback[];

  beforeEach(() => {
    queuedFrames = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const style = document.createElement('style');
    style.dataset.testid = 'fitted-label-style';
    style.textContent = '.test-fitted-label { font-size: 20px; }';
    document.head.appendChild(style);
  });

  afterEach(() => {
    document.querySelector('[data-testid="fitted-label-style"]')?.remove();
    vi.unstubAllGlobals();
  });

  it('shrinks an unbreakable translated word instead of splitting or clipping it', () => {
    render(
      <FittedTileLabel
        text="I don't understand"
        testId="fitted-label"
        className="test-fitted-label"
      />,
    );
    const label = screen.getByTestId('fitted-label');
    Object.defineProperties(label, {
      clientWidth: { configurable: true, value: 95 },
      clientHeight: { configurable: true, value: 50 },
      scrollWidth: {
        configurable: true,
        get: () => Number.parseFloat(label.style.fontSize || '20') < 17 ? 95 : 119,
      },
      scrollHeight: { configurable: true, value: 50 },
    });

    act(() => {
      queuedFrames.shift()?.(0);
    });

    expect(label.style.fontSize).toBe('15.5px');
    expect(label).toHaveAttribute('data-fit-status', 'fit');
    expect(label).toHaveTextContent("I don't understand");
  });

  it.each([
    'Donaudampfschifffahrtsgesellschaftskapitän',
    'epäjärjestelmällistyttämättömyydelläänsäkäänköhän',
    'muvaffakiyetsizleştiricileştiriveremeyebileceklerimizdenmişsinizcesine',
    'responsabilităților',
    'المسؤوليات',
    'যোগাযোগেরপ্রয়োজনীয়তা',
  ])('keeps the complete label when %s must shrink below the preferred floor', (text) => {
    render(
      <FittedTileLabel
        text={text}
        testId="fitted-label"
        className="test-fitted-label"
        minFontSizePx={12}
      />,
    );
    const label = screen.getByTestId('fitted-label');
    Object.defineProperties(label, {
      clientWidth: { configurable: true, value: 95 },
      clientHeight: { configurable: true, value: 50 },
      scrollWidth: {
        configurable: true,
        get: () => Number.parseFloat(label.style.fontSize || '20') * 12,
      },
      scrollHeight: { configurable: true, value: 50 },
    });

    act(() => {
      queuedFrames.shift()?.(0);
    });

    expect(Number.parseFloat(label.style.fontSize)).toBeLessThan(12);
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
    expect(label).toHaveAttribute('data-fit-status', 'fit-below-min');
    expect(label).toHaveTextContent(text);
  });

  it('refits when its tile changes size', () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    });

    render(
      <FittedTileLabel
        text="responsabilităților"
        testId="fitted-label"
        className="test-fitted-label"
      />,
    );
    const label = screen.getByTestId('fitted-label');
    let clientWidth = 140;
    Object.defineProperties(label, {
      clientWidth: { configurable: true, get: () => clientWidth },
      clientHeight: { configurable: true, value: 50 },
      scrollWidth: {
        configurable: true,
        get: () => Number.parseFloat(label.style.fontSize || '20') * 6,
      },
      scrollHeight: { configurable: true, value: 50 },
    });

    act(() => {
      queuedFrames.shift()?.(0);
    });
    expect(label.style.fontSize).toBe('');
    expect(observe).toHaveBeenCalledWith(label.parentElement);

    clientWidth = 80;
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
      queuedFrames.shift()?.(0);
    });

    expect(Number.parseFloat(label.style.fontSize)).toBeLessThan(20);
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
  });
});
