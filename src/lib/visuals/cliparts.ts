/**
 * Curated full-colour clipart library (creator-licensed stock; no attribution
 * required). Imported at /public/cliparts, downscaled to max 512px with alpha
 * preserved — the art keeps its own colours and is placed small/scaled by the
 * templates, unlike the line icons which recolor with the palette.
 *
 * Terms here are natural words; the matcher normalizes them with the same
 * function it applies to narration words, so plurals and case just work.
 * Cliparts outrank line icons when both match a term: real art beats a glyph.
 */

export interface ClipartEntry {
  /** Root-relative path under /public. */
  src: string;
  /** Words in narration/visualTerms that summon this art. */
  terms: string[];
}

export const CLIPARTS: readonly ClipartEntry[] = [
  { src: '/cliparts/compass.png', terms: ['compass', 'direction', 'guidance', 'guide'] },
  { src: '/cliparts/gears.png', terms: ['gear', 'cog', 'machine'] },
  { src: '/cliparts/gift.png', terms: ['gift', 'present', 'giving'] },
  { src: '/cliparts/clock.png', terms: ['clock', 'alarm', 'hour', 'time'] },
  { src: '/cliparts/growth-chart.png', terms: ['chart', 'increase', 'rise', 'progress'] },
  { src: '/cliparts/trophy.png', terms: ['trophy', 'prize', 'victory', 'winner', 'reward', 'race'] },
  { src: '/cliparts/grapes.png', terms: ['grape', 'vine', 'vineyard', 'fruit'] },
  { src: '/cliparts/ark-animals.png', terms: ['ark', 'rainbow', 'flood'] },
  { src: '/cliparts/resurrection.png', terms: ['resurrection', 'risen', 'easter', 'tomb'] },
  { src: '/cliparts/crown-of-thorns.png', terms: ['thorn', 'crucifixion', 'passion', 'suffering'] },
  { src: '/cliparts/shield.png', terms: ['shield', 'armor', 'sword', 'battle', 'protection', 'defense'] },
  { src: '/cliparts/staircase.png', terms: ['stair', 'step', 'climb'] },
  { src: '/cliparts/noahs-ark.png', terms: ['noah', 'ship', 'boat'] },
  { src: '/cliparts/nativity.png', terms: ['nativity', 'bethlehem', 'manger', 'christmas'] },
  { src: '/cliparts/communion.png', terms: ['communion', 'eucharist', 'sacrament', 'cup', 'wine'] },
  { src: '/cliparts/cross.png', terms: ['cross', 'calvary', 'crucified', 'gospel'] },
  { src: '/cliparts/spirit-fire.png', terms: ['pentecost', 'spirit', 'fire', 'flame', 'holy'] },
  { src: '/cliparts/signpost.png', terms: ['signpost', 'sign', 'choice', 'decision', 'crossroad', 'path'] },
  { src: '/cliparts/jesus.png', terms: ['jesus', 'christ', 'savior', 'saviour', 'lord'] },
  { src: '/cliparts/bible.png', terms: ['bible', 'scripture', 'word', 'book'] },
  { src: '/cliparts/commandments.png', terms: ['commandment', 'law', 'tablet', 'sinai', 'moses'] },
  { src: '/cliparts/bubbles.png', terms: ['bubble', 'soap', 'clean', 'wash'] },
  { src: '/cliparts/umbrella-rain.png', terms: ['umbrella', 'rain', 'shelter'] },
  { src: '/cliparts/good-samaritan.jpg', terms: ['samaritan', 'neighbor', 'neighbour', 'mercy', 'compassion', 'wounded'] },
  { src: '/cliparts/phoenix.png', terms: ['phoenix', 'renewal', 'ashes'] },
  { src: '/cliparts/dove.png', terms: ['dove', 'peace'] },
  { src: '/cliparts/treasure.png', terms: ['treasure', 'chest', 'riches', 'wealth', 'pearl'] },
  { src: '/cliparts/flashlight.png', terms: ['flashlight', 'darkness'] },
  { src: '/cliparts/magnifier.png', terms: ['magnify', 'search', 'seek', 'find', 'look'] },
  { src: '/cliparts/salt.png', terms: ['salt', 'season', 'flavor'] },
  { src: '/cliparts/storm-cloud.png', terms: ['storm', 'cloud', 'thunder'] },
  { src: '/cliparts/bread.png', terms: ['bread', 'hunger', 'daily'] },
  { src: '/cliparts/lantern.png', terms: ['lantern', 'lamp', 'oil'] },
  { src: '/cliparts/shepherd.png', terms: ['shepherd', 'sheep', 'flock', 'lamb', 'pasture'] },
  { src: '/cliparts/butterfly.png', terms: ['butterfly', 'transformation', 'caterpillar'] },
  { src: '/cliparts/anchor.png', terms: ['anchor', 'hope', 'steadfast', 'secure'] },
  { src: '/cliparts/loaves-fishes.png', terms: ['loaf', 'loaves', 'feed', 'feeding', 'multitude'] },
  { src: '/cliparts/wreath.png', terms: ['wreath', 'laurel', 'crown'] },
  { src: '/cliparts/torch.png', terms: ['torch', 'blaze'] },
  { src: '/cliparts/lock-key.png', terms: ['lock', 'key', 'unlock'] },
  { src: '/cliparts/coins.png', terms: ['coin', 'money', 'silver', 'debt', 'wage'] },
  { src: '/cliparts/last-supper.png', terms: ['supper', 'passover', 'table'] },
  { src: '/cliparts/footprints.png', terms: ['footprint', 'walk', 'follow'] },
  { src: '/cliparts/puzzle.png', terms: ['puzzle', 'piece', 'mystery'] },
  { src: '/cliparts/well.png', terms: ['well', 'water', 'thirst', 'thirsty', 'drink'] },
  { src: '/cliparts/sun.png', terms: ['sun', 'light', 'shine', 'morning', 'dawn', 'ray'] },
  { src: '/cliparts/hourglass.png', terms: ['hourglass', 'sand', 'patience', 'wait'] },
  { src: '/cliparts/broken-chain.png', terms: ['chain', 'broken', 'freedom', 'free', 'bondage', 'slave'] },
  { src: '/cliparts/helm.png', terms: ['helm', 'wheel', 'steer', 'sail', 'rudder'] },
  { src: '/cliparts/maze.png', terms: ['maze', 'lost', 'confusion', 'wander'] },
  { src: '/cliparts/ladder.png', terms: ['ladder', 'ascend', 'jacob'] },
  { src: '/cliparts/church-city.png', terms: ['church', 'city', 'community'] },
  { src: '/cliparts/sunrise-mountains.png', terms: ['sunrise', 'mountain', 'hill', 'horizon'] },
  { src: '/cliparts/angel.png', terms: ['angel', 'messenger', 'heavenly'] },
  { src: '/cliparts/fish.png', terms: ['fish', 'fisherman'] },
  { src: '/cliparts/fishnet.png', terms: ['net', 'fishing', 'catch'] },
  { src: '/cliparts/bridge.png', terms: ['bridge', 'gap', 'connect'] },
  { src: '/cliparts/scales.png', terms: ['scale', 'balance', 'justice', 'judge', 'weigh'] },
  { src: '/cliparts/sprout.png', terms: ['sprout', 'seed', 'plant', 'grow', 'growth', 'root'] },
  { src: '/cliparts/olive-branch.png', terms: ['olive', 'branch'] },
  { src: '/cliparts/aurora.png', terms: ['aurora', 'glory', 'heaven'] },
  { src: '/cliparts/praying-hands.png', terms: ['prayer', 'pray', 'praying', 'hand', 'intercession'] },
  { src: '/cliparts/candle.png', terms: ['candle', 'vigil', 'glow'] },
  { src: '/cliparts/pastor.png', terms: ['pastor', 'preacher', 'preach', 'sermon', 'pulpit', 'teacher', 'teach'] },
  { src: '/cliparts/baptism.png', terms: ['baptism', 'baptize', 'baptized', 'jordan'] },
  { src: '/cliparts/mission-flag.png', terms: ['flag', 'mission', 'goal', 'summit'] },
  { src: '/cliparts/open-door.png', terms: ['door', 'open', 'welcome', 'enter', 'invitation'] },
  { src: '/cliparts/mirror.png', terms: ['mirror', 'reflection', 'reflect', 'image'] },
] as const;
