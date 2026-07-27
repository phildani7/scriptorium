/**
 * Generate the visual icon library: a curated concept map over lucide-static
 * (ISC licence — no attribution required), written as inline SVG markup so
 * templates can inject it directly and recolor it via currentColor. Inline,
 * not files: the offline renderer loads compositions from file://, where
 * fetched assets hit CORS walls (the same lesson the doodle masks taught).
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Each entry maps one lucide icon to the narration words that should summon
 * it. Missing icon names (lucide renames across versions) are skipped with a
 * warning rather than failing the build.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ICONS_DIR = join('node_modules', 'lucide-static', 'icons');

/** icon name -> the narration words (lowercase, singular) that summon it. */
const LIBRARY: Array<[string, string[]]> = [
  // Faith & scripture
  ['cross', ['cross', 'crucified', 'calvary']],
  ['church', ['church', 'chapel', 'congregation', 'worship']],
  ['book-open', ['bible', 'scripture', 'book', 'read', 'reading', 'word']],
  ['scroll-text', ['scroll', 'law', 'commandment', 'covenant']],
  ['sparkles', ['glory', 'holy', 'miracle', 'wonder', 'sparkle']],
  ['crown', ['king', 'kingdom', 'crown', 'reign', 'royal', 'throne']],
  ['flame', ['fire', 'flame', 'spirit', 'burning', 'candle', 'torch']],
  ['bird', ['dove', 'peace']],
  ['heart-handshake', ['reconcile', 'reconciliation', 'forgive', 'forgiveness', 'mercy']],
  ['hand-heart', ['charity', 'kindness', 'giving', 'generous', 'generosity']],
  ['helping-hand', ['help', 'serve', 'service', 'support']],

  // People & relationships
  ['users', ['people', 'crowd', 'community', 'family', 'together', 'neighbor']],
  ['user', ['person', 'man', 'woman', 'someone', 'stranger']],
  ['baby', ['baby', 'child', 'children', 'born', 'birth']],
  ['handshake', ['friend', 'friendship', 'agreement', 'welcome', 'trust']],
  ['smile', ['joy', 'happy', 'happiness', 'smile', 'delight']],
  ['frown', ['sad', 'sadness', 'sorrow', 'grief', 'mourn']],
  ['brain', ['mind', 'think', 'thought', 'wisdom', 'understand', 'understanding']],
  ['eye', ['see', 'sight', 'watch', 'eye', 'vision', 'behold']],
  ['ear', ['hear', 'listen', 'listening', 'ear', 'voice']],
  ['footprints', ['walk', 'follow', 'step', 'path', 'journey', 'footstep']],
  ['messages-square', ['talk', 'conversation', 'speak', 'word', 'gossip']],

  // Nature & elements
  ['sun', ['sun', 'day', 'noon', 'warmth']],
  ['sunrise', ['morning', 'dawn', 'sunrise', 'daybreak', 'new']],
  ['sunset', ['evening', 'sunset', 'dusk']],
  ['moon-star', ['night', 'moon', 'dark', 'darkness', 'midnight']],
  ['star', ['star', 'shine', 'bright']],
  ['cloud', ['cloud', 'sky', 'heaven', 'heavens']],
  ['cloud-rain', ['rain', 'shower', 'pour']],
  ['cloud-lightning', ['storm', 'thunder', 'lightning', 'tempest']],
  ['wind', ['wind', 'breath', 'breeze', 'blow']],
  ['snowflake', ['snow', 'winter', 'cold', 'frost']],
  ['rainbow', ['rainbow', 'promise']],
  ['mountain', ['mountain', 'peak', 'hill', 'summit', 'climb', 'cliff']],
  ['waves', ['sea', 'ocean', 'wave', 'water', 'flood', 'deep', 'tide']],
  ['droplet', ['drop', 'thirst', 'thirsty', 'drink', 'dew']],
  ['droplets', ['baptism', 'washing', 'cleanse', 'pour']],
  ['trees', ['forest', 'tree', 'wood', 'garden', 'eden']],
  ['sprout', ['seed', 'grow', 'growth', 'plant', 'sprout', 'root', 'sow']],
  ['leaf', ['leaf', 'branch', 'olive']],
  ['flower-2', ['flower', 'lily', 'bloom', 'blossom']],
  ['wheat', ['wheat', 'harvest', 'grain', 'bread', 'field', 'crop']],
  ['apple', ['fruit', 'apple', 'vineyard', 'vine']],
  ['bird', ['bird', 'sparrow', 'raven', 'wing', 'fly']],
  ['fish', ['fish', 'fisherman', 'net', 'galilee']],
  ['bug', ['locust', 'insect', 'moth']],
  ['earth', ['world', 'earth', 'globe', 'nation', 'creation']],

  // Shepherd & pastoral
  ['lamp', ['lamp', 'oil']],
  ['lightbulb', ['idea', 'light', 'insight', 'reveal', 'revelation']],
  ['shield', ['shield', 'protect', 'protection', 'defend', 'refuge', 'fortress']],
  ['shield-check', ['safe', 'safety', 'secure', 'security']],
  ['sword', ['sword', 'battle', 'war', 'fight', 'enemy']],
  ['anchor', ['anchor', 'steadfast', 'firm', 'hold', 'hope']],
  ['compass', ['compass', 'direction', 'guide', 'guidance', 'lead']],
  ['map', ['map', 'plan', 'territory']],
  ['map-pin', ['place', 'location', 'here', 'bethlehem', 'jerusalem']],
  ['route', ['road', 'route', 'way', 'detour', 'wander']],
  ['milestone', ['milestone', 'marker', 'crossroad']],
  ['signpost', ['sign', 'signpost', 'choice', 'decide', 'decision']],
  ['tent', ['tent', 'camp', 'wilderness', 'desert', 'tabernacle']],
  ['home', ['home', 'house', 'dwell', 'dwelling', 'shelter', 'abide']],
  ['door-open', ['door', 'open', 'enter', 'gate', 'knock', 'invitation']],
  ['key-round', ['key', 'unlock', 'access']],
  ['lock', ['lock', 'locked', 'prison', 'chain', 'bound']],

  // Objects & daily life
  ['lamp-desk', ['study', 'desk', 'late']],
  ['bed', ['sleep', 'rest', 'bed', 'dream', 'tired', 'weary']],
  ['armchair', ['comfort', 'sit', 'chair', 'ease']],
  ['utensils', ['eat', 'meal', 'supper', 'dinner', 'feast', 'table']],
  ['cup-soda', ['cup', 'drink']],
  ['wine', ['wine', 'vinegar']],
  ['coins', ['money', 'coin', 'silver', 'gold', 'treasure', 'riches', 'wealth', 'talent']],
  ['wallet', ['wallet', 'purse', 'debt', 'owe']],
  ['gift', ['gift', 'present', 'grace', 'free', 'offering']],
  ['package', ['burden', 'load', 'baggage', 'carry', 'package']],
  ['scale', ['justice', 'judge', 'judgment', 'balance', 'weigh', 'fair']],
  ['gavel', ['court', 'verdict', 'sentence', 'condemn']],
  ['hammer', ['build', 'builder', 'hammer', 'nail', 'carpenter', 'construct']],
  ['wrench', ['fix', 'repair', 'mend', 'restore', 'tool']],
  ['axe', ['axe', 'cut', 'chop', 'fell']],
  ['scissors', ['scissors', 'shear', 'divide', 'separate']],
  ['ruler', ['measure', 'standard', 'rule', 'plumb']],
  ['paintbrush', ['paint', 'art', 'artist', 'create', 'craft']],
  ['pen-line', ['write', 'written', 'letter', 'pen', 'ink']],
  ['mail', ['mail', 'message', 'epistle', 'send', 'sent']],
  ['phone', ['phone', 'call', 'called', 'calling']],
  ['camera', ['camera', 'photo', 'picture', 'moment']],
  ['image', ['mirror', 'reflection', 'reflect', 'image']],
  ['glasses', ['glasses', 'clarity', 'clear', 'focus']],
  ['umbrella', ['umbrella', 'cover', 'covering']],
  ['backpack', ['pack', 'travel', 'traveler', 'pilgrim', 'journey']],
  ['shirt', ['clothes', 'clothing', 'garment', 'robe', 'cloak', 'wear']],
  ['bandage', ['wound', 'wounded', 'heal', 'healing', 'hurt', 'bind']],
  ['pill', ['medicine', 'cure', 'remedy', 'sick', 'illness']],
  ['stethoscope', ['doctor', 'physician', 'health']],
  ['dumbbell', ['strength', 'strong', 'train', 'training', 'discipline', 'exercise']],
  ['trophy', ['prize', 'trophy', 'win', 'victory', 'overcome', 'triumph', 'reward']],
  ['medal', ['medal', 'honor', 'crowned']],
  ['target', ['target', 'aim', 'goal', 'purpose', 'mark']],
  ['puzzle', ['puzzle', 'piece', 'mystery', 'fit']],
  ['hourglass', ['time', 'hour', 'wait', 'waiting', 'patience', 'patient', 'season']],
  ['clock', ['clock', 'moment', 'now', 'today', 'late', 'soon']],
  ['calendar', ['day', 'week', 'year', 'sabbath', 'appointed']],
  ['alarm-clock', ['wake', 'awake', 'alarm', 'watchful', 'alert']],
  ['bell', ['bell', 'announce', 'proclaim', 'herald']],
  ['music', ['music', 'song', 'sing', 'singing', 'psalm', 'hymn', 'melody']],
  ['drum', ['drum', 'beat', 'rhythm']],
  ['guitar', ['guitar', 'harp', 'lyre', 'instrument']],
  ['mic', ['microphone', 'preach', 'preacher', 'sermon', 'announce']],
  ['megaphone', ['shout', 'cry', 'loud', 'declare', 'proclaim']],
  ['party-popper', ['celebrate', 'celebration', 'party', 'rejoice', 'feast']],

  // Movement & transport
  ['ship', ['ship', 'boat', 'ark', 'sail', 'voyage']],
  ['sailboat', ['sailboat', 'harbor']],
  ['car', ['car', 'drive', 'driving']],
  ['bus', ['bus', 'commute']],
  ['plane', ['plane', 'flight', 'airport']],
  ['train-front', ['train', 'track', 'station']],
  ['bike', ['bike', 'bicycle', 'ride']],
  ['rocket', ['rocket', 'launch', 'soar']],
  ['flag', ['flag', 'banner', 'standard', 'rally']],
  ['tent-tree', ['campfire', 'outdoors']],

  // Abstract & emphasis
  ['zap', ['power', 'powerful', 'energy', 'sudden', 'instant', 'spark']],
  ['infinity', ['forever', 'eternal', 'eternity', 'everlasting', 'endless', 'always']],
  ['link', ['connect', 'connection', 'bond', 'joined', 'united', 'unity']],
  ['unlink', ['broken', 'break', 'severed', 'apart']],
  ['refresh-cw', ['renew', 'renewal', 'again', 'repeat', 'return', 'restore']],
  ['trending-up', ['rise', 'increase', 'more', 'abound', 'multiply', 'flourish']],
  ['trending-down', ['fall', 'decrease', 'less', 'decline', 'fade']],
  ['search', ['search', 'seek', 'find', 'found', 'look', 'lost']],
  ['circle-help', ['question', 'why', 'doubt', 'wonder', 'ask']],
  ['triangle-alert', ['danger', 'warning', 'beware', 'careful', 'risk']],
  ['check', ['yes', 'done', 'complete', 'finish', 'finished', 'accomplished']],
  ['x', ['no', 'never', 'refuse', 'reject', 'deny']],
  ['plus', ['add', 'more', 'plus']],
  ['gem', ['pearl', 'jewel', 'gem', 'precious', 'valuable', 'worth']],
  ['telescope', ['telescope', 'future', 'far', 'distant', 'horizon']],
  ['microscope', ['small', 'tiny', 'detail', 'least', 'mustard']],
  ['graduation-cap', ['learn', 'learning', 'teach', 'teacher', 'student', 'disciple', 'lesson']],
  ['school', ['school', 'class', 'classroom']],
  ['briefcase', ['work', 'job', 'labor', 'business', 'office', 'career']],
  ['building-2', ['city', 'tower', 'babel', 'building']],
  ['castle', ['castle', 'palace', 'stronghold']],
  ['landmark', ['temple', 'court', 'pillar', 'foundation']],
  ['hand', ['hand', 'touch', 'reach', 'receive']],
  ['thumbs-up', ['good', 'approve', 'blessing', 'blessed', 'favor']],
  ['battery-charging', ['recharge', 'strength', 'renewed', 'energize']],
  ['cloud-sun', ['weather', 'season', 'change']],
  ['shovel', ['dig', 'bury', 'buried', 'ground', 'soil']],
  ['tractor', ['farm', 'farmer', 'plow', 'field']],
];

function main() {
  const out: string[] = [];
  const seen = new Set<string>();
  let icons = 0;
  let terms = 0;

  for (const [icon, words] of LIBRARY) {
    const file = join(ICONS_DIR, `${icon}.svg`);
    if (!existsSync(file)) {
      console.warn(`SKIP ${icon} — not in this lucide-static version`);
      continue;
    }
    // One line, no comment header, stroke inherits currentColor already.
    const svg = readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .replace(/> </g, '><')
      .trim();
    icons += 1;
    for (const word of words) {
      if (seen.has(word)) {
        console.warn(`DUPLICATE term "${word}" (${icon}) — first mapping wins`);
        continue;
      }
      seen.add(word);
      terms += 1;
      out.push(`  '${word}': ${JSON.stringify(svg)},`);
    }
  }

  const moduleSource = `/**
 * GENERATED by scripts/make-icons.ts — do not edit.
 *
 * Narration word -> inline SVG markup (lucide-static, ISC licence, no
 * attribution required). Inline so templates inject and recolor via
 * currentColor with zero fetches — the offline renderer runs from file://.
 */

export const ICON_BY_TERM: Record<string, string> = {
${out.join('\n')}
};
`;
  writeFileSync(join('src', 'lib', 'visuals', 'icons.generated.ts'), moduleSource, 'utf8');
  console.log(`${icons} icons, ${terms} terms -> src/lib/visuals/icons.generated.ts`);
}

main();
