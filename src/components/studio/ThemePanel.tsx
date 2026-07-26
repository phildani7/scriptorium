'use client';

/**
 * One-click customization.
 *
 * Every control here changes only presentation — style, palette, font, size,
 * background. None of them can touch the verse, the narration, or the
 * timings, which is why applying a change is instant: the spec is re-baked
 * into the template, nothing is re-generated and nothing needs re-verifying.
 */

import {
  BACKGROUNDS,
  FONTS,
  PALETTES,
  SIZES,
  type ShortTheme,
} from '@/lib/theme/options';
import type { StyleId } from '@/lib/types';

export const STYLES: Array<{ id: StyleId; label: string; blurb: string }> = [
  { id: 'warm-minimal', label: 'Warm Minimal', blurb: 'Editorial calm. Serif, whitespace, one accent.' },
  { id: 'kinetic-type', label: 'Kinetic Type', blurb: 'Poster type that lands word by word on the voice.' },
  { id: 'neon-night', label: 'Neon Night', blurb: 'Dark glow, drifting particles, a flare at the turn.' },
];

interface ThemePanelProps {
  style: StyleId;
  theme: ShortTheme;
  busy: boolean;
  onStyle: (style: StyleId) => void;
  onTheme: (theme: ShortTheme) => void;
}

export function ThemePanel({ style, theme, busy, onStyle, onTheme }: ThemePanelProps) {
  const set = (patch: Partial<ShortTheme>) => onTheme({ ...theme, ...patch });

  return (
    <div className={`flex flex-col gap-6 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      <Group label="Style">
        <div className="flex flex-col gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onStyle(s.id)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                style === s.id
                  ? 'border-accent bg-accentsoft'
                  : 'border-rule bg-white hover:border-inkfaint'
              }`}
            >
              <div className={`text-sm font-semibold ${style === s.id ? 'text-accent' : 'text-ink'}`}>
                {s.label}
              </div>
              <div className="text-xs text-inksoft">{s.blurb}</div>
            </button>
          ))}
        </div>
      </Group>

      <Group label="Colors">
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => {
            const active = (theme.paletteId ?? PALETTES[0].id) === p.id;
            return (
              <button
                key={p.id}
                type="button"
                title={p.label}
                aria-label={`Palette: ${p.label}`}
                aria-pressed={active}
                onClick={() => set({ paletteId: p.id })}
                className={`relative h-11 w-11 overflow-hidden rounded-full border-2 transition ${
                  active ? 'scale-110 border-accent' : 'border-rule hover:border-inkfaint'
                }`}
                style={{ background: p.bg }}
              >
                {/* Swatch shows the palette's actual relationship: ground,
                    ink and accent, not just one colour. */}
                <span
                  className="absolute top-1/2 left-1/2 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: p.ink }}
                />
                <span
                  className="absolute right-1 bottom-1 block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.accent }}
                />
              </button>
            );
          })}
        </div>
      </Group>

      <Group label="Font">
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((f) => {
            const active = (theme.fontId ?? FONTS[0].id) === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => set({ fontId: f.id })}
                className={`rounded-lg border px-3 py-2 transition ${
                  active ? 'border-accent bg-accentsoft text-accent' : 'border-rule bg-white text-inksoft hover:border-inkfaint'
                }`}
              >
                <span
                  className="block text-lg leading-tight"
                  style={{ fontFamily: f.display }}
                >
                  Ag
                </span>
                <span className="text-xs font-medium">{f.label}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group label="Text size">
        <div className="flex gap-2">
          {SIZES.map((s) => {
            const active = (theme.sizeId ?? 'regular') === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => set({ sizeId: s.id })}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm transition ${
                  active ? 'border-accent bg-accentsoft font-semibold text-accent' : 'border-rule bg-white text-inksoft hover:border-inkfaint'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Group>

      <Group label="Background">
        <div className="flex flex-wrap gap-2">
          {BACKGROUNDS.map((b) => {
            const active = (theme.backgroundId ?? 'grain') === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => set({ backgroundId: b.id })}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  active ? 'border-accent bg-accentsoft font-semibold text-accent' : 'border-rule bg-white text-inksoft hover:border-inkfaint'
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold tracking-widest text-inksoft uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}
