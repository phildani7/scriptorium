/**
 * The language registry.
 *
 * This file is the vision of the project expressed as data: Scripture exists as
 * text in thousands of languages and as short-form video in almost none. Every
 * entry here is a language in which this tool can produce a finished, narrated,
 * word-synced vertical short.
 *
 * Nothing in this table is aspirational. Each row was built from three verified
 * sources, and the `tier` is *derived*, never asserted:
 *
 *   - `piperVoice`   present in https://huggingface.co/rhasspy/piper-voices
 *                    (MIT-licensed neural voice models, verified 2026-07-26)
 *   - `asrCode`      listed at https://docs.speechmatics.com/speech-to-text/languages
 *                    (word-level forced alignment, verified 2026-07-26)
 *   - `bibleVersion` resolved against the YouVersion Platform API at runtime
 *
 * Where a capability is missing we say so in the UI rather than papering over
 * it. A tool that claims uniform quality across 40 languages is lying; a tool
 * that shows you exactly what it can and cannot do in yours is useful.
 */

import type { LanguageTier } from '@/lib/types';

export type TextDirection = 'ltr' | 'rtl';

export interface LanguageEntry {
  /** BCP-47 primary subtag. */
  code: string;
  /** English name. */
  name: string;
  /** Endonym, shown in the language picker so speakers recognise their own language. */
  nativeName: string;
  /** Unicode script, drives font selection. */
  script: Script;
  dir: TextDirection;
  /** Best-quality Piper model, or null when no free voice model exists yet. */
  piperVoice: string | null;
  /** Speechmatics transcription language code, or null when unsupported. */
  asrCode: string | null;
  /** Rough global speaker count in millions. Used only for default ordering. */
  speakersM: number;
}

export type Script =
  | 'latin'
  | 'devanagari'
  | 'bengali'
  | 'arabic'
  | 'nastaliq'
  | 'hebrew'
  | 'cyrillic'
  | 'greek'
  | 'han'
  | 'hangul'
  | 'tamil'
  | 'telugu'
  | 'malayalam'
  | 'thai'
  | 'armenian'
  | 'georgian';

/**
 * Font stacks per script. Every family is OFL and self-hosted from
 * `/public/fonts` — Path B renders offline, so a Google Fonts CDN call would
 * silently fall back to a system face and break shaping.
 *
 * There is no free Devanagari chalk or handwriting face. We do NOT fake one by
 * transforming a Latin font: it produces broken conjuncts and misplaced matras.
 * Each style instead names an aesthetically compatible Devanagari companion.
 */
export const SCRIPT_FONTS: Record<Script, string> = {
  latin: "'Fraunces', 'Inter', system-ui, sans-serif",
  devanagari: "'Noto Serif Devanagari', 'Tiro Devanagari Hindi', serif",
  bengali: "'Noto Serif Bengali', serif",
  arabic: "'Noto Naskh Arabic', serif",
  nastaliq: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif",
  hebrew: "'Noto Serif Hebrew', serif",
  cyrillic: "'Noto Serif', serif",
  greek: "'Noto Serif', serif",
  han: "'Noto Serif SC', serif",
  hangul: "'Noto Serif KR', serif",
  tamil: "'Noto Serif Tamil', serif",
  telugu: "'Noto Serif Telugu', serif",
  malayalam: "'Noto Serif Malayalam', serif",
  thai: "'Noto Serif Thai', serif",
  armenian: "'Noto Serif Armenian', serif",
  georgian: "'Noto Serif Georgian', serif",
};

/**
 * Scripts whose line-breaking and vertical rhythm need extra leading. Devanagari
 * and Bengali stack matras above and below the baseline; at 1080x1920 with the
 * default 1.2 line-height they collide.
 */
export const SCRIPT_LINE_HEIGHT: Partial<Record<Script, number>> = {
  devanagari: 1.65,
  bengali: 1.65,
  tamil: 1.6,
  telugu: 1.6,
  malayalam: 1.6,
  nastaliq: 1.9,
  arabic: 1.7,
  thai: 1.6,
};

// prettier-ignore
export const LANGUAGES: LanguageEntry[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    script: 'latin',      dir: 'ltr', piperVoice: 'en_US-ljspeech-high',      asrCode: 'en',  speakersM: 1500 },
  { code: 'zh', name: 'Mandarin',   nativeName: '中文',        script: 'han',        dir: 'ltr', piperVoice: 'zh_CN-xiao_ya-medium',     asrCode: 'cmn', speakersM: 1100 },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       script: 'devanagari', dir: 'ltr', piperVoice: 'hi_IN-rohan-medium',       asrCode: 'hi',  speakersM: 610 },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    script: 'latin',      dir: 'ltr', piperVoice: 'es_MX-claude-high',        asrCode: 'es',  speakersM: 560 },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',     script: 'arabic',     dir: 'rtl', piperVoice: 'ar_JO-kareem-medium',      asrCode: 'ar',  speakersM: 400 },
  { code: 'fr', name: 'French',     nativeName: 'Français',   script: 'latin',      dir: 'ltr', piperVoice: 'fr_FR-siwis-medium',       asrCode: 'fr',  speakersM: 310 },
  { code: 'bn', name: 'Bengali',    nativeName: 'বাংলা',       script: 'bengali',    dir: 'ltr', piperVoice: 'bn_BD-google-medium',      asrCode: 'bn',  speakersM: 280 },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  script: 'latin',      dir: 'ltr', piperVoice: 'pt_BR-faber-medium',       asrCode: 'pt',  speakersM: 260 },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    script: 'cyrillic',   dir: 'ltr', piperVoice: 'ru_RU-irina-medium',       asrCode: 'ru',  speakersM: 255 },
  { code: 'ur', name: 'Urdu',       nativeName: 'اردو',        script: 'nastaliq',   dir: 'rtl', piperVoice: 'ur_PK-fasih-medium',       asrCode: 'ur',  speakersM: 230 },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', script: 'latin', dir: 'ltr', piperVoice: 'id_ID-news_tts-medium',   asrCode: 'id',  speakersM: 200 },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    script: 'latin',      dir: 'ltr', piperVoice: 'de_DE-thorsten-high',      asrCode: 'de',  speakersM: 135 },
  { code: 'mr', name: 'Marathi',    nativeName: 'मराठी',       script: 'devanagari', dir: 'ltr', piperVoice: 'mr_IN-google-medium',      asrCode: 'mr',  speakersM: 99 },
  { code: 'te', name: 'Telugu',     nativeName: 'తెలుగు',      script: 'telugu',     dir: 'ltr', piperVoice: 'te_IN-venkatesh-medium',   asrCode: null,  speakersM: 96 },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',     script: 'latin',      dir: 'ltr', piperVoice: 'tr_TR-dfki-medium',        asrCode: 'tr',  speakersM: 90 },
  { code: 'ta', name: 'Tamil',      nativeName: 'தமிழ்',       script: 'tamil',      dir: 'ltr', piperVoice: null,                       asrCode: 'ta',  speakersM: 87 },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', script: 'latin',      dir: 'ltr', piperVoice: 'vi_VN-vais1000-medium',    asrCode: 'vi',  speakersM: 86 },
  { code: 'ko', name: 'Korean',     nativeName: '한국어',       script: 'hangul',     dir: 'ltr', piperVoice: 'ko_KR-kss-medium',         asrCode: 'ko',  speakersM: 82 },
  { code: 'fa', name: 'Persian',    nativeName: 'فارسی',       script: 'arabic',     dir: 'rtl', piperVoice: 'fa_IR-gyro-medium',        asrCode: 'fa',  speakersM: 80 },
  { code: 'it', name: 'Italian',    nativeName: 'Italiano',   script: 'latin',      dir: 'ltr', piperVoice: 'it_IT-paola-medium',       asrCode: 'it',  speakersM: 68 },
  { code: 'sw', name: 'Swahili',    nativeName: 'Kiswahili',  script: 'latin',      dir: 'ltr', piperVoice: 'sw_CD-lanfrica-medium',    asrCode: 'sw',  speakersM: 71 },
  { code: 'th', name: 'Thai',       nativeName: 'ไทย',        script: 'thai',       dir: 'ltr', piperVoice: null,                       asrCode: 'th',  speakersM: 61 },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',       script: 'han',        dir: 'ltr', piperVoice: null,                       asrCode: 'ja',  speakersM: 123 },
  { code: 'pl', name: 'Polish',     nativeName: 'Polski',     script: 'latin',      dir: 'ltr', piperVoice: 'pl_PL-bass-high',          asrCode: 'pl',  speakersM: 41 },
  { code: 'uk', name: 'Ukrainian',  nativeName: 'Українська', script: 'cyrillic',   dir: 'ltr', piperVoice: 'uk_UA-tetiana-high',       asrCode: 'uk',  speakersM: 40 },
  { code: 'ml', name: 'Malayalam',  nativeName: 'മലയാളം',     script: 'malayalam',  dir: 'ltr', piperVoice: 'ml_IN-meera-medium',       asrCode: null,  speakersM: 37 },
  { code: 'ro', name: 'Romanian',   nativeName: 'Română',     script: 'latin',      dir: 'ltr', piperVoice: 'ro_RO-mihai-medium',       asrCode: 'ro',  speakersM: 25 },
  { code: 'nl', name: 'Dutch',      nativeName: 'Nederlands', script: 'latin',      dir: 'ltr', piperVoice: 'nl_NL-ronnie-medium',      asrCode: 'nl',  speakersM: 25 },
  { code: 'ne', name: 'Nepali',     nativeName: 'नेपाली',      script: 'devanagari', dir: 'ltr', piperVoice: 'ne_NP-google-medium',      asrCode: null,  speakersM: 32 },
  { code: 'el', name: 'Greek',      nativeName: 'Ελληνικά',   script: 'greek',      dir: 'ltr', piperVoice: 'el_GR-rapunzelina-medium', asrCode: 'el',  speakersM: 13 },
  { code: 'hu', name: 'Hungarian',  nativeName: 'Magyar',     script: 'latin',      dir: 'ltr', piperVoice: 'hu_HU-imre-medium',        asrCode: 'hu',  speakersM: 13 },
  { code: 'cs', name: 'Czech',      nativeName: 'Čeština',    script: 'latin',      dir: 'ltr', piperVoice: 'cs_CZ-jirka-medium',       asrCode: 'cs',  speakersM: 11 },
  { code: 'sv', name: 'Swedish',    nativeName: 'Svenska',    script: 'latin',      dir: 'ltr', piperVoice: 'sv_SE-nst-medium',         asrCode: 'sv',  speakersM: 10 },
  { code: 'he', name: 'Hebrew',     nativeName: 'עברית',       script: 'hebrew',     dir: 'rtl', piperVoice: 'he_IL-saspeech-medium',    asrCode: 'he',  speakersM: 9 },
  { code: 'bg', name: 'Bulgarian',  nativeName: 'Български',  script: 'cyrillic',   dir: 'ltr', piperVoice: 'bg_BG-dimitar-medium',     asrCode: 'bg',  speakersM: 8 },
  { code: 'da', name: 'Danish',     nativeName: 'Dansk',      script: 'latin',      dir: 'ltr', piperVoice: 'da_DK-talesyntese-medium', asrCode: 'da',  speakersM: 6 },
  { code: 'fi', name: 'Finnish',    nativeName: 'Suomi',      script: 'latin',      dir: 'ltr', piperVoice: 'fi_FI-harri-medium',       asrCode: 'fi',  speakersM: 5 },
  { code: 'sk', name: 'Slovak',     nativeName: 'Slovenčina', script: 'latin',      dir: 'ltr', piperVoice: 'sk_SK-lili-medium',        asrCode: 'sk',  speakersM: 5 },
  { code: 'no', name: 'Norwegian',  nativeName: 'Norsk',      script: 'latin',      dir: 'ltr', piperVoice: 'no_NO-talesyntese-medium', asrCode: 'no',  speakersM: 5 },
  { code: 'ca', name: 'Catalan',    nativeName: 'Català',     script: 'latin',      dir: 'ltr', piperVoice: 'ca_ES-upc_ona-medium',     asrCode: 'ca',  speakersM: 5 },
  { code: 'sl', name: 'Slovenian',  nativeName: 'Slovenščina',script: 'latin',      dir: 'ltr', piperVoice: 'sl_SI-artur-medium',       asrCode: 'sl',  speakersM: 2 },
  { code: 'lv', name: 'Latvian',    nativeName: 'Latviešu',   script: 'latin',      dir: 'ltr', piperVoice: 'lv_LV-aivars-medium',      asrCode: 'lv',  speakersM: 2 },
  { code: 'eu', name: 'Basque',     nativeName: 'Euskara',    script: 'latin',      dir: 'ltr', piperVoice: 'eu_ES-maider-medium',      asrCode: 'eu',  speakersM: 1 },
  { code: 'cy', name: 'Welsh',      nativeName: 'Cymraeg',    script: 'latin',      dir: 'ltr', piperVoice: 'cy_GB-gwryw_gogleddol-medium', asrCode: 'cy', speakersM: 1 },
  { code: 'ka', name: 'Georgian',   nativeName: 'ქართული',    script: 'georgian',   dir: 'ltr', piperVoice: 'ka_GE-natia-medium',       asrCode: null,  speakersM: 4 },
  { code: 'hy', name: 'Armenian',   nativeName: 'Հայերեն',    script: 'armenian',   dir: 'ltr', piperVoice: 'hy_AM-gor-medium',         asrCode: null,  speakersM: 5 },
  { code: 'sq', name: 'Albanian',   nativeName: 'Shqip',      script: 'latin',      dir: 'ltr', piperVoice: 'sq_AL-edon-medium',        asrCode: null,  speakersM: 8 },
  { code: 'sr', name: 'Serbian',    nativeName: 'Српски',     script: 'cyrillic',   dir: 'ltr', piperVoice: 'sr_RS-serbski_institut-medium', asrCode: null, speakersM: 12 },
  { code: 'is', name: 'Icelandic',  nativeName: 'Íslenska',   script: 'latin',      dir: 'ltr', piperVoice: 'is_IS-steinn-medium',      asrCode: null,  speakersM: 1 },
  { code: 'kk', name: 'Kazakh',     nativeName: 'Қазақша',    script: 'cyrillic',   dir: 'ltr', piperVoice: 'kk_KZ-issai-high',         asrCode: null,  speakersM: 13 },
];

/**
 * Tier is derived from capability, never hand-set. If a Piper voice is added
 * upstream, or Speechmatics ships a new language pack, the tier moves on its own.
 */
export function tierOf(entry: LanguageEntry): LanguageTier {
  if (entry.piperVoice && entry.asrCode) return 'full';
  if (entry.piperVoice) return 'voiced';
  return 'text-first';
}

export function getLanguage(code: string): LanguageEntry | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function fontFor(code: string): string {
  const entry = getLanguage(code);
  return SCRIPT_FONTS[entry?.script ?? 'latin'];
}

export function lineHeightFor(code: string): number {
  const entry = getLanguage(code);
  return (entry && SCRIPT_LINE_HEIGHT[entry.script]) ?? 1.25;
}

export function directionFor(code: string): TextDirection {
  return getLanguage(code)?.dir ?? 'ltr';
}

/** Counts used in the UI and the writeup. Computed, so they cannot drift. */
export function coverage() {
  const full = LANGUAGES.filter((l) => tierOf(l) === 'full');
  const voiced = LANGUAGES.filter((l) => tierOf(l) === 'voiced');
  const textFirst = LANGUAGES.filter((l) => tierOf(l) === 'text-first');
  return {
    total: LANGUAGES.length,
    full: full.length,
    voiced: voiced.length,
    textFirst: textFirst.length,
    /** Languages with a voice of any kind. */
    withVoice: full.length + voiced.length,
    speakersReachedM: LANGUAGES.reduce((n, l) => n + l.speakersM, 0),
  };
}
