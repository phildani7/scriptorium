'use client';

/**
 * The review gate.
 *
 * Everything the model wrote is editable here. The verse is not — it renders in
 * a locked field with an explanation, because it did not come from a model and
 * there is no version of this product where a user edits Scripture and the
 * result still claims to be Scripture.
 *
 * That single locked field is the clearest statement of the project's
 * architecture that a person can see without reading any code.
 */

import { useState } from 'react';
import type { DeviceItem, Passage } from '@/lib/types';
import { normalizeSpoken } from '@/lib/script/build';

interface ReviewGateProps {
  passage: Passage;
  device: DeviceItem;
  scriptDir: 'ltr' | 'rtl';
  scriptName: string;
  busy: boolean;
  onApprove: (deviceOverride: string) => void;
  onBack: () => void;
}

export function ReviewGate({
  passage,
  device,
  scriptDir,
  scriptName,
  busy,
  onApprove,
  onBack,
}: ReviewGateProps) {
  // Show the line as it will actually be spoken and rendered — em dashes
  // folded to commas, stray markdown removed — so approval means approving
  // the real thing rather than a draft that changes on the way out.
  const spoken = normalizeSpoken(device.content);
  const [text, setText] = useState(spoken);
  const edited = text.trim() !== spoken.trim();

  return (
    <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
      <header className="mb-7 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">Review the script</h2>
          <p className="mt-1 text-sm text-inksoft">
            Nothing is rendered until you approve it.
          </p>
        </div>
        <span className="rounded-full bg-accentsoft px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
          Step 3 of 3
        </span>
      </header>

      {/* ---- editable: the teaching device ---- */}
      <div className="mb-7">
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="device-text"
            className="text-xs font-semibold tracking-widest text-inksoft uppercase"
          >
            Opening line · written by AI · yours to change
          </label>
          {edited && (
            <span className="text-xs font-medium text-accent">edited</span>
          )}
        </div>
        <textarea
          id="device-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          dir={scriptDir}
          data-script={scriptName}
          className="w-full resize-y rounded-xl border border-rule bg-white p-4 font-display text-xl leading-snug text-ink"
        />
        <p className="mt-2 text-sm text-inkfaint">
          Anchored to: {device.point}
        </p>
      </div>

      {/* ---- locked: the verse ---- */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <LockIcon />
          <span className="text-xs font-semibold tracking-widest text-inksoft uppercase">
            Scripture · retrieved from YouVersion · locked
          </span>
        </div>

        <div
          className="rounded-xl border border-rule bg-locked p-5"
          aria-readonly="true"
        >
          <p
            dir={scriptDir}
            data-script={scriptName}
            className="font-display text-xl leading-relaxed text-ink"
          >
            {passage.text}
          </p>
          <p className="mt-4 border-t border-rule pt-3 text-xs text-inksoft">
            {passage.reference} · {passage.attribution}
          </p>
        </div>

        <p className="mt-2 flex items-start gap-2 text-sm text-inksoft">
          <span aria-hidden="true">•</span>
          <span>
            This text is retrieved, not generated, and cannot be edited here or
            anywhere else in the pipeline. Before any frame is rendered it is
            compared character by character against the YouVersion response, and
            a mismatch fails the build rather than shipping.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onApprove(text)}
          disabled={busy}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Approve and generate'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded-xl border border-rule px-5 py-3 font-medium text-inksoft transition hover:bg-white disabled:opacity-50"
        >
          Pick a different opening
        </button>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-accent"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
