'use client';

/**
 * One-click customization.
 *
 * Every control here changes only presentation — style, palette, font, size,
 * background. None of them can touch the verse, the narration, or the
 * timings, which is why applying a change is instant: the spec is re-baked
 * into the template, nothing is re-generated and nothing needs re-verifying.
 *
 * Rendered in two sections so the screen stays compact: the quick picks
 * (`side`) sit beside the preview; the big chip collections (`wide` —
 * backgrounds, text motion, music) use the full width below it.
 */

import {
  BACKGROUNDS,
  FONTS,
  MUSIC,
  PALETTES,
  SIZES,
  TEXT_STYLES,
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
  section: 'side' | 'wide';
  onStyle: (style: StyleId) => void;
  onTheme: (theme: ShortTheme) => void;
}

const chip = (active: boolean) =>
  `rounded-lg border px-2.5 py-1.5 text-xs transition ${
    active
      ? 'border-accent bg-accentsoft font-semibold text-accent'
      : 'border-rule bg-white text-inksoft hover:border-inkfaint'
  }`;

export function ThemePanel({ style, theme, busy, section, onStyle, onTheme }: ThemePanelProps) {
  const set = (patch: Partial<ShortTheme>) => onTheme({ ...theme, ...patch });
  const dim = busy ? 'pointer-events-none opacity-60' : '';

  if (section === 'side') {
    return (
      <div className={`flex flex-col gap-5 ${dim}`}>
        <Group label="Style">
          <div className="flex flex-col gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.blurb}
                onClick={() => onStyle(s.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  style === s.id
                    ? 'border-accent bg-accentsoft font-semibold text-accent'
                    : 'border-rule bg-white text-inksoft hover:border-inkfaint'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Colors">
          <div className="flex flex-wrap gap-1.5">
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
                  className={`relative h-9 w-9 overflow-hidden rounded-full border-2 transition ${
                    active ? 'scale-110 border-accent' : 'border-rule hover:border-inkfaint'
                  }`}
                  style={{ background: p.bg }}
                >
                  {/* Swatch shows the palette's actual relationship: ground,
                      ink and accent, not just one colour. */}
                  <span
                    className="absolute top-1/2 left-1/2 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: p.ink }}
                  />
                  <span
                    className="absolute right-1 bottom-1 block h-2 w-2 rounded-full"
                    style={{ background: p.accent }}
                  />
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Font">
          <div className="grid grid-cols-4 gap-1.5">
            {FONTS.map((f) => {
              const active = (theme.fontId ?? FONTS[0].id) === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  title={f.label}
                  onClick={() => set({ fontId: f.id })}
                  className={`rounded-lg border px-1 py-1.5 text-center transition ${
                    active
                      ? 'border-accent bg-accentsoft text-accent'
                      : 'border-rule bg-white text-inksoft hover:border-inkfaint'
                  }`}
                >
                  <span className="block text-base leading-tight" style={{ fontFamily: f.display }}>
                    Ag
                  </span>
                  <span className="text-[10px] font-medium">{f.label}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Text size">
          <div className="flex gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={(theme.sizeId ?? 'regular') === s.id}
                onClick={() => set({ sizeId: s.id })}
                className={`flex-1 ${chip((theme.sizeId ?? 'regular') === s.id)}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Captions">
          <div className="flex gap-1.5">
            {(['on', 'off'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={(theme.captions ?? 'on') === v}
                onClick={() => set({ captions: v })}
                className={`flex-1 ${chip((theme.captions ?? 'on') === v)}`}
              >
                {v === 'on' ? 'On' : 'Off'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-inkfaint">
            The verse and reference always render.
          </p>
        </Group>
      </div>
    );
  }

  return (
    <div className={`mt-8 grid gap-6 border-t border-rule pt-6 md:grid-cols-3 ${dim}`}>
      <Group label="Background">
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={(theme.backgroundId ?? 'grain') === b.id}
              onClick={() => set({ backgroundId: b.id })}
              className={chip((theme.backgroundId ?? 'grain') === b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-inkfaint">
          ✶ NASA, public domain · ▶ licensed video loops · images licensed, no
          attribution required.
        </p>
      </Group>

      <Group label="Text motion">
        <div className="flex flex-wrap gap-1.5">
          {TEXT_STYLES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.blurb}
              aria-pressed={(theme.textStyleId ?? 'signature') === t.id}
              onClick={() => set({ textStyleId: t.id })}
              className={chip((theme.textStyleId ?? 'signature') === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-inkfaint">
          How headline text arrives; timing stays locked to the voice.
        </p>
      </Group>

      <Group label="Music">
        <div className="flex flex-wrap gap-1.5">
          {MUSIC.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.credit || 'Silence'}
              aria-pressed={(theme.musicId ?? 'none') === m.id}
              onClick={() => set({ musicId: m.id })}
              className={chip((theme.musicId ?? 'none') === m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-inkfaint">
          MacLeod tracks CC BY 4.0, credited automatically; the rest licensed
          via Audiio — no attribution required.
        </p>
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
