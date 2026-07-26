/**
 * Language lookup in the shape the panel prompts expect.
 *
 * `panels/illustrate.ts` imports `getLanguageByCode` from here and reads
 * `.name`. This is a thin adapter over the real registry in
 * `lib/languages/registry.ts`, which is the single source of truth for
 * capability, script, fonts, and voice models.
 */

import { LANGUAGES, getLanguage } from '@/lib/languages/registry';

export interface PromptLanguage {
  code: string;
  name: string;
  nativeName: string;
  script: string;
}

export function getLanguageByCode(code: string): PromptLanguage | undefined {
  const entry = getLanguage(code);
  if (!entry) return undefined;
  return {
    code: entry.code,
    name: entry.name,
    nativeName: entry.nativeName,
    script: entry.script,
  };
}

export const SUPPORTED_LANGUAGES: PromptLanguage[] = LANGUAGES.map((l) => ({
  code: l.code,
  name: l.name,
  nativeName: l.nativeName,
  script: l.script,
}));
