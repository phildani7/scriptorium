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
  type BackgroundOption,
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
            The verse and reference always render. Kinetic Type draws no
            separate rail — its poster type is the caption, landing word by
            word on the voice.
          </p>
        </Group>
      </div>
    );
  }

  return (
    <div className={`mt-8 border-t border-rule pt-6 ${dim}`}>
      <BackgroundPicker
        selected={theme.backgroundId ?? 'grain'}
        onPick={(backgroundId) => set({ backgroundId })}
      />

      <div className="mt-7 grid gap-6 md:grid-cols-2">
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
          All beds licensed via Audiio — no attribution required, so a short
          stays correctly licensed however far it is reposted.
        </p>
      </Group>
      </div>
    </div>
  );
}

/**
 * Seventy backgrounds, picked by looking rather than by reading.
 *
 * The list used to be seventy words in a wrap of chips. "Groovy liquid",
 * "Halftone dots", "Sand layers" — a creator had to imagine each one, click,
 * wait for a re-bake, and find out they had imagined it wrong. Now they point
 * at the one they want.
 *
 * The tiles are 9:16, the shape of the thing they produce, packed tight so a
 * whole group is takeable in one glance, and grouped because "a video loop"
 * and "a CSS texture" are different decisions.
 *
 * Images and video loops carry no label: the picture is complete information
 * and a caption would only crowd it. Textures and doodle frames DO keep their
 * name, and that is not an inconsistency — they are whisper-quiet by design
 * (a five-percent linen weave, a doodle border at a third opacity), so at tile
 * size they honestly render as near-identical rectangles. A picture that
 * cannot be told from its neighbour is not information. Where the thumbnail
 * stops informing, the word takes over.
 */
function BackgroundPicker({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (id: string) => void;
}) {
  const groups: Array<{ key: BackgroundOption['group']; label: string; note?: string }> = [
    { key: 'video', label: 'Video loops', note: 'Seamless, silent, licensed' },
    { key: 'image', label: 'Images' },
    { key: 'doodle', label: 'Doodle frames', note: 'Drawn in your palette' },
    { key: 'texture', label: 'Textures', note: 'CSS-generated, take your palette' },
  ];

  return (
    <Group label="Background">
      <div className="flex flex-col gap-4">
        {groups.map(({ key, label, note }) => {
          const items = BACKGROUNDS.filter((b) => b.group === key);
          if (items.length === 0) return null;
          // Textures and doodles are too quiet to identify by sight alone.
          const named = key === 'texture' || key === 'doodle';

          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-label text-[10px] font-bold tracking-[0.14em] text-inksoft uppercase">
                  {label}
                </span>
                <span className="text-[10px] text-inkfaint">
                  {items.length}
                  {note ? ` · ${note}` : ''}
                </span>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                {items.map((b) => {
                  const active = selected === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={b.label}
                      aria-label={`Background: ${b.label}`}
                      aria-pressed={active}
                      onClick={() => onPick(b.id)}
                      className={`group relative aspect-[9/16] overflow-hidden rounded-md border transition ${
                        active
                          ? 'border-accent ring-2 ring-accent'
                          : 'border-rule hover:border-inkfaint'
                      }`}
                    >
                      {b.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.thumb}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 bg-locked" />
                      )}

                      {named && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[8px] leading-tight font-medium text-white">
                          {b.label}
                        </span>
                      )}

                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] leading-none font-bold text-white"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-inkfaint">
        Every asset here is licensed for use in produced video with no
        attribution required. Video loops are silent and cross-faded so they
        repeat without a visible cut.
      </p>
    </Group>
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
