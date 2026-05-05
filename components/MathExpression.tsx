'use client';

import { useEffect, useRef } from 'react';
import { expressionToLatex } from '@/services/mathLatex';

/**
 * MathExpression — renders a user-built math expression as KaTeX-formatted
 * typography (italic variables, true superscripts, real fraction stacks).
 *
 * Loads KaTeX from CDN on first mount instead of bundling. The math panel
 * is opened from a side panel that's not on the critical path; deferring
 * the ~270KB CSS + JS keeps the initial AAC bundle lean. CDN URL is
 * already allowed by the portal CSP (cdn.jsdelivr.net in script-src and
 * style-src), and serwist caches it after first fetch.
 *
 * Falls back to the plain-text expression if KaTeX fails (CDN blocked,
 * offline first-load, malformed LaTeX). Better to read raw "5 \\times 6"
 * than a blank canvas.
 */

const KATEX_VERSION = '0.16.21';
let cssLoaded = false;
let cssPromise: Promise<void> | null = null;

function loadKatexCss(): Promise<void> {
    if (cssLoaded) return Promise.resolve();
    if (cssPromise) return cssPromise;
    if (typeof document === 'undefined') return Promise.resolve();
    if (document.querySelector('link[data-katex]')) {
        cssLoaded = true;
        return Promise.resolve();
    }
    cssPromise = new Promise<void>((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
        link.crossOrigin = 'anonymous';
        link.dataset.katex = '1';
        link.onload = () => { cssLoaded = true; resolve(); };
        link.onerror = () => { resolve(); /* render plaintext fallback */ };
        document.head.appendChild(link);
    });
    return cssPromise;
}

export interface MathExpressionProps {
    expression: string;
    placeholder?: string;
    className?: string;
}

export default function MathExpression({ expression, placeholder, className }: MathExpressionProps) {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let cancelled = false;
        const node = containerRef.current;
        if (!node) return;

        if (!expression.trim()) {
            node.textContent = placeholder ?? '';
            return;
        }

        (async () => {
            await loadKatexCss();
            // Dynamic import keeps the 280KB KaTeX engine out of the main
            // bundle. Lazy-loaded only when the math panel actually renders.
            const katex = (await import('katex')).default;
            if (cancelled) return;
            const latex = expressionToLatex(expression);
            try {
                katex.render(latex, node, {
                    displayMode: true,
                    throwOnError: false,
                    output: 'htmlAndMathml',
                    strict: 'ignore',
                });
            } catch {
                node.textContent = expression;
            }
        })();

        return () => { cancelled = true; };
    }, [expression, placeholder]);

    return <span ref={containerRef} className={className} aria-live="polite" />;
}
