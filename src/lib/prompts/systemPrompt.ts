/**
 * Shared prompt scaffolding that the panel prompts build on.
 *
 * `panels/illustrate.ts` is dropped in from the BibleBuddies codebase unchanged;
 * this file supplies exactly the four exports it imports, and nothing more.
 *
 * The universal preamble carries the constraint the whole project rests on:
 * the model writes about the passage and never rewrites the passage.
 */

import type { AgeGroup, PromptContext } from '@/lib/types';
import { getLanguageByCode } from '@/lib/constants/languages';

export type { PromptContext };

export type ComplexityTier = 1 | 2 | 3 | 4;

/**
 * Collapse the age group and proficiency level into a 1-4 register tier.
 *
 * The UI exposes only Kids / Youth / Adult and holds proficiency at
 * `intermediate`, so in practice this returns 1, 2 or 3; the fourth tier exists
 * for the seminary-level register the panel prompts already know how to write.
 */
export function getComplexityTier(
  ageGroup: AgeGroup,
  proficiencyLevel: PromptContext['proficiencyLevel'],
): ComplexityTier {
  const base: Record<AgeGroup, ComplexityTier> = {
    kids: 1,
    youth: 2,
    adult: 3,
  };
  const shift =
    proficiencyLevel === 'beginner' ? -1 : proficiencyLevel === 'advanced' ? 1 : 0;

  const tier = base[ageGroup] + shift;
  return Math.min(4, Math.max(1, tier)) as ComplexityTier;
}

/** Human-readable passage reference used in the user message. */
export function buildPassageRef(context: PromptContext): string {
  const version = context.versionAbbreviation
    ? ` (${context.versionAbbreviation})`
    : '';
  return `${context.passageReference}${version}\n\n"${context.passageText}"`;
}

/**
 * The preamble every panel prompt inherits: role, fidelity to the text,
 * reverence, family-safety, target language, and JSON-only output.
 */
export function buildUniversalSystemPrompt(context: PromptContext): string {
  const code = context.preferredLanguage || 'en';
  const language = getLanguageByCode(code);
  const languageName = language?.name ?? code;

  return `You are a gifted Bible teacher and communicator helping a creator make a short, vertical video about a passage of Scripture.

<scripture_integrity>
The passage text has already been retrieved verbatim from an authoritative Bible API and will be rendered on screen exactly as supplied. You must NOT rewrite, paraphrase, translate, modernise, abbreviate, "correct", or re-punctuate it, and you must not quote it back in your output as if it were your own words. Your work is the teaching device that surrounds the verse. A build-time check compares the rendered verse against the API response character by character and fails the render on any mismatch, so altered Scripture cannot ship — it can only break the build.
</scripture_integrity>

<reverence>
Write with reverence toward God and toward Scripture. Be warm, never flippant, never sarcastic about the text or about the people in it. Keep everything family-safe and non-graphic: this will be watched by children, by new believers, and by people in real pain.
</reverence>

<language>
Write for a ${languageName} audience. ${
    code !== 'en'
      ? `All prose you produce must be in ${languageName}, not English.`
      : 'Write in clear, natural English.'
  }
</language>

<output>
Return ONLY valid JSON in the exact shape requested. No markdown fences, no preamble, no trailing commentary.
</output>`;
}
