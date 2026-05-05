'use client';

import { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { expressionToLatex } from '@/services/mathLatex';

/**
 * MathExpression — renders a user-built math expression as KaTeX-formatted
 * typography (italic variables, true superscripts, real fraction stacks).
 *
 * KaTeX CSS is imported as a regular CSS module so it ships in the page
 * stylesheet bundle. The previous CDN-link approach loaded CSS from
 * cdn.jsdelivr.net at runtime, but synalux.ai/prism-aac's CSP only
 * whitelists 'self' and prism-aac.vercel.app under style-src — the link
 * was silently blocked, KaTeX fell back to rendering both katex-mathml
 * (which the CSS would normally hide) AND katex-html, which is why the
 * canvas showed every expression twice.
 *
 * Falls back to the plain-text expression if KaTeX engine fails to
 * decode the LaTeX. Better to read raw "5 \\times 6" than a blank canvas.
 */

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
            // Dynamic import keeps the 280KB KaTeX engine out of the main
            // bundle. Lazy-loaded only when the math panel actually renders.
            const katex = (await import('katex')).default;
            if (cancelled) return;
            const latex = expressionToLatex(expression);
            try {
                katex.render(latex, node, {
                    displayMode: true,
                    throwOnError: false,
                    // 'html' only — skip MathML to eliminate the duplicate-render
                    // failure mode where MathML shows alongside HTML when CSS
                    // is missing or partially loaded. Screen readers can read
                    // the aria-live container's plain text fallback.
                    output: 'html',
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
