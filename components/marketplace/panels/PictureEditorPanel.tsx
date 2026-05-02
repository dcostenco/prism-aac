'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useT } from '@/engine/useT';
import { tapFeedback } from '@/services/feedback';

/**
 * Picture Editor (Painter) — Phase 4 marketplace module.
 *
 * Canvas-based pictogram editor for caregivers / SLPs. Lets a clinician
 * draw a custom pictogram, give it a phrase label, and export as PNG. The
 * exported image is intended to be attached to a custom phrase (the
 * existing phrase tile renderer already supports per-phrase image URLs;
 * Phase 5 will integrate the saved image with the phrase store).
 *
 * Tools (kept minimal — clinical setting, big touch targets):
 *   - Brush:    8 colors + 4 sizes
 *   - Eraser:   wipes painted pixels back to canvas-bg
 *   - Clear:    wipes canvas
 *   - Undo:     reverts the last stroke (kept stack-based, capped at 30)
 *   - Save:     downloads the canvas as a PNG named after the phrase label
 *
 * Touch + mouse + pen are all wired via pointer events. The canvas auto-
 * sizes to its container with a 1:1 aspect ratio so pictograms render
 * consistently in the phrase tile.
 */

interface BrushColor {
  hex: string;
  nameKey: string;
}

const BRUSH_COLORS: BrushColor[] = [
  { hex: '#000000', nameKey: 'pe_color_black' },
  { hex: '#E53935', nameKey: 'pe_color_red' },
  { hex: '#FB8C00', nameKey: 'pe_color_orange' },
  { hex: '#FDD835', nameKey: 'pe_color_yellow' },
  { hex: '#43A047', nameKey: 'pe_color_green' },
  { hex: '#1E88E5', nameKey: 'pe_color_blue' },
  { hex: '#8E24AA', nameKey: 'pe_color_purple' },
  { hex: '#6D4C41', nameKey: 'pe_color_brown' },
];

const BRUSH_SIZES = [4, 8, 16, 32];

type Tool = 'brush' | 'eraser';

interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

const CANVAS_PIXELS = 512; // backing-store size; CSS sizes container down

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section
      aria-label={t('mp_picture_editor')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

export default function PictureEditorPanel() {
  const { t } = useT();
  const sidePanel = useUIStore((s) => s.sidePanel);
  const closeSidePanel = useUIStore((s) => s.closeSidePanel);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState(BRUSH_COLORS[0].hex);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [phraseLabel, setPhraseLabel] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const all = drawing ? [...strokes, drawing] : strokes;
    for (const s of all) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.tool === 'eraser' ? '#FFFFFF' : s.color;
      const pts = s.points;
      if (pts.length === 1) {
        // Single-tap dot.
        ctx.fillStyle = ctx.strokeStyle;
        ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, drawing]);

  useEffect(() => { redraw(); }, [redraw]);

  // Initialize canvas backing pixels exactly once. CSS handles render size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_PIXELS;
    canvas.height = CANVAS_PIXELS;
    redraw();
    // redraw is referenced; effect runs once because deps below are static
    // for the lifetime of the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sidePanel !== 'picture-editor') return null;

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = pointFromEvent(e);
    setDrawing({ tool, color, size, points: [pt] });
  };

  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!drawing) return;
    const pt = pointFromEvent(e);
    setDrawing({ ...drawing, points: [...drawing.points, pt] });
  };

  const onPointerEnd: React.PointerEventHandler<HTMLCanvasElement> = () => {
    if (!drawing) return;
    setStrokes((prev) => {
      const next = [...prev, drawing];
      // Cap at 30 strokes — undo stack stays bounded for memory.
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
    setDrawing(null);
  };

  const handleUndo = () => {
    tapFeedback();
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    tapFeedback();
    setStrokes([]);
    setDrawing(null);
  };

  const handleSave = () => {
    tapFeedback();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const safe = (phraseLabel.trim() || 'pictogram').replace(/[^a-z0-9-_]/gi, '_').slice(0, 40);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${safe || 'pictogram'}.png`;
    link.click();
  };

  return (
    <PanelShell>
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">🖼 {t('mp_picture_editor')}</span>
        <button
          onClick={() => { tapFeedback(); closeSidePanel(); }}
          aria-label={t('close_panel')}
          className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Phrase label */}
        <div className="flex flex-col gap-1">
          <label htmlFor="pe-phrase" className="text-muted text-sm font-bold">
            {t('pe_phrase_label')}
          </label>
          <input
            id="pe-phrase"
            type="text"
            data-testid="pe-phrase-input"
            value={phraseLabel}
            onChange={(e) => setPhraseLabel(e.target.value)}
            placeholder={t('pe_phrase_placeholder')}
            className="surface-key border border-theme rounded-xl px-3 py-2 text-primary text-base"
          />
        </div>

        {/* Tool row: brush vs eraser */}
        <div className="flex items-center gap-2" role="radiogroup" aria-label={t('pe_tools')}>
          <button
            data-testid="pe-tool-brush"
            role="radio"
            aria-checked={tool === 'brush'}
            onClick={() => { tapFeedback(); setTool('brush'); }}
            className={`aac-btn flex-1 min-h-[48px] rounded-xl font-bold text-sm border ${
              tool === 'brush' ? 'bg-[#2196F3] text-white border-[#2196F3]' : 'surface-key text-primary border-theme'
            }`}
          >
            ✏️ {t('pe_brush')}
          </button>
          <button
            data-testid="pe-tool-eraser"
            role="radio"
            aria-checked={tool === 'eraser'}
            onClick={() => { tapFeedback(); setTool('eraser'); }}
            className={`aac-btn flex-1 min-h-[48px] rounded-xl font-bold text-sm border ${
              tool === 'eraser' ? 'bg-[#2196F3] text-white border-[#2196F3]' : 'surface-key text-primary border-theme'
            }`}
          >
            🧽 {t('pe_eraser')}
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t('pe_colors')}>
          {BRUSH_COLORS.map((c) => (
            <button
              key={c.hex}
              data-testid={`pe-color-${c.hex.toLowerCase()}`}
              role="radio"
              aria-checked={color === c.hex && tool === 'brush'}
              aria-label={t(c.nameKey)}
              onClick={() => { tapFeedback(); setColor(c.hex); setTool('brush'); }}
              style={{ backgroundColor: c.hex }}
              className={`w-10 h-10 rounded-full border-4 ${
                color === c.hex && tool === 'brush' ? 'border-[#FFD700]' : 'border-theme'
              }`}
            />
          ))}
        </div>

        {/* Brush sizes */}
        <div className="flex items-center gap-2" role="radiogroup" aria-label={t('pe_sizes')}>
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              data-testid={`pe-size-${s}`}
              role="radio"
              aria-checked={size === s}
              aria-label={`${s}px`}
              onClick={() => { tapFeedback(); setSize(s); }}
              className={`flex-1 min-h-[44px] rounded-xl flex items-center justify-center border ${
                size === s ? 'bg-[#E3F2FD] border-[#2196F3]' : 'surface-key border-theme'
              }`}
            >
              <span
                className="rounded-full bg-primary"
                style={{ width: Math.min(s, 28), height: Math.min(s, 28), backgroundColor: tool === 'eraser' ? '#9E9E9E' : color }}
              />
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="surface-key border-2 border-theme rounded-2xl overflow-hidden mx-auto w-full max-w-md aspect-square">
          <canvas
            ref={canvasRef}
            data-testid="pe-canvas"
            className="block w-full h-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onPointerLeave={onPointerEnd}
          />
        </div>

        {/* Action row: undo / clear / save */}
        <div className="flex items-center gap-2">
          <button
            data-testid="pe-undo"
            disabled={strokes.length === 0}
            onClick={handleUndo}
            className="aac-btn flex-1 min-h-[56px] rounded-xl surface-key text-primary font-bold text-base border border-theme disabled:opacity-50"
          >
            ↶ {t('pe_undo')}
          </button>
          <button
            data-testid="pe-clear"
            disabled={strokes.length === 0}
            onClick={handleClear}
            className="aac-btn flex-1 min-h-[56px] rounded-xl surface-key text-primary font-bold text-base border border-theme disabled:opacity-50"
          >
            🗑 {t('pe_clear')}
          </button>
          <button
            data-testid="pe-save"
            onClick={handleSave}
            className="aac-btn flex-1 min-h-[56px] rounded-xl bg-[#43A047] text-white font-bold text-base border border-[#43A047]"
          >
            💾 {t('pe_save')}
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
