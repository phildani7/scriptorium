/**
 * The hand-drawn doodle panel library.
 *
 * 61 vertical 1080x1935 panels produced for the BibleBuddies doodle shorts and
 * shipped here as a reusable, already-licensed picture set. They are the house
 * style for AI-visual mode: cream sketchbook paper, bold black marker outline,
 * vibrant crayon colour, doodled star/heart borders — and, crucially, a clean
 * upper band the short's sentence can sit on.
 *
 * A creator who picks "AI images" gets a panel from here whenever one honestly
 * fits the teaching. Only when nothing matches does `lib/visuals/grok` spend a
 * generation, and it generates INTO this same style. Reuse first is not just
 * thrift: a reused panel is a known-good frame, and known-good beats novel.
 *
 * Two numbers per panel drive layout, both measured from the pixels rather
 * than guessed (scripts/measure-doodle-bands.py):
 *
 *   band   how far down the panel the paper stays clean across the centre
 *          column, as a percentage of height. The template floats a scrim of
 *          `paper` over the top `max(band, MIN_BAND)%` so the sentence always
 *          lands on quiet ground — invisible on a panel that already has a
 *          28% band, and a manufactured band on a full-bleed one.
 *   paper  the page stock colour, sampled from the panel's own top edge, so
 *          that scrim seam is invisible.
 *
 * `hasText` marks panels with English words drawn into the art. They stay
 * eligible — the set is small and every panel earns its place — but the
 * matcher breaks ties against them, because English lettering under a Hindi
 * sentence reads as a mistake.
 */

import type { DeviceItem, VisualItem } from '@/lib/types';

export interface DoodlePanel {
  id: string;
  /** Root-relative path under /public. */
  src: string;
  /** Series this panel belongs to; panels from one series share a look. */
  topic: string;
  /** Clean top band, percent of height. */
  band: number;
  /** Page stock colour, for the band scrim. */
  paper: string;
  /** English words are drawn into the art. */
  hasText: boolean;
  /** What is actually on the panel, one sentence. */
  description: string;
  /** Concrete English match terms, lowercase singular where natural. */
  tags: readonly string[];
}

/** Floor for the sentence band, even on a full-bleed panel. */
export const MIN_BAND = 26;

export const DOODLE_PANELS: readonly DoodlePanel[] = [
  /* -- Peter on the water, Matthew 14 -------------------------------------
     Night sea in blue and purple crayon, a smiling moon, Jesus in white with
     a drawn halo. Wide clean band on every panel but panel-3. */
  {
    id: 'peter-0', src: '/doodles/peter/panel-0.jpg', topic: 'peter',
    band: 27, paper: '#f8f1de', hasText: false,
    description: 'Disciples huddle terrified in a wooden boat on towering blue-purple waves at night, a smiling moon above.',
    tags: ['boat', 'storm', 'wave', 'sea', 'night', 'fear', 'water', 'moon', 'ship', 'disciple'],
  },
  {
    id: 'peter-1', src: '/doodles/peter/panel-1.jpg', topic: 'peter',
    band: 27, paper: '#f8f1de', hasText: false,
    description: 'Peter steps out of the boat onto the water, arms raised, walking toward a glowing Jesus in white.',
    tags: ['step', 'faith', 'water', 'walk', 'boat', 'courage', 'call', 'sea', 'wave'],
  },
  {
    id: 'peter-2', src: '/doodles/peter/panel-2.jpg', topic: 'peter',
    band: 27, paper: '#f8f1de', hasText: false,
    description: 'Peter mid-stride on the waves with a hand outstretched to Jesus, the boat and disciples small behind him.',
    tags: ['water', 'walk', 'wave', 'reach', 'faith', 'sea', 'trust', 'boat'],
  },
  {
    id: 'peter-3', src: '/doodles/peter/panel-3.jpg', topic: 'peter',
    band: 10, paper: '#f8f1de', hasText: false,
    description: 'Peter sinks waist-deep into a swirling wave in panic while Jesus reaches down for him.',
    tags: ['sink', 'doubt', 'wave', 'fear', 'rescue', 'water', 'drown', 'help', 'storm'],
  },
  {
    id: 'peter-4', src: '/doodles/peter/panel-4.jpg', topic: 'peter',
    band: 27, paper: '#f8f1de', hasText: false,
    description: 'Jesus grips Peter by the hand and lifts him clear of the water, a burst of golden light at their clasped hands.',
    tags: ['hand', 'rescue', 'lift', 'grip', 'save', 'help', 'strength', 'grace', 'light'],
  },
  {
    id: 'peter-5', src: '/doodles/peter/panel-5.jpg', topic: 'peter',
    band: 26, paper: '#f8f1de', hasText: false,
    description: 'A calm starry night sea; Peter and Jesus stand together on still water beside the empty boat.',
    tags: ['calm', 'peace', 'still', 'water', 'star', 'night', 'rest', 'quiet', 'sea'],
  },

  /* -- Balaam's donkey, Numbers 22 ----------------------------------------
     A walled vineyard lane, smiling sun, an angel with a drawn blue sword. */
  {
    id: 'donkey-0', src: '/doodles/donkey/panel-0.jpg', topic: 'donkey',
    band: 27, paper: '#fcefd7', hasText: false,
    description: 'A bearded man in a striped robe rides a grey donkey down a walled vineyard lane under a smiling sun.',
    tags: ['donkey', 'road', 'journey', 'vineyard', 'travel', 'path', 'wall', 'sun', 'ride'],
  },
  {
    id: 'donkey-1', src: '/doodles/donkey/panel-1.jpg', topic: 'donkey',
    band: 27, paper: '#fcefd7', hasText: true,
    description: 'The rider grumbles while an angel with a drawn sword hovers unseen ahead on the path.',
    tags: ['angel', 'sword', 'warning', 'unseen', 'road', 'donkey', 'anger', 'blind'],
  },
  {
    id: 'donkey-2', src: '/doodles/donkey/panel-2.jpg', topic: 'donkey',
    band: 1, paper: '#fdf6e2', hasText: true,
    description: 'The donkey bolts and crushes the rider against the vineyard wall as the angel flies past.',
    tags: ['wall', 'crush', 'donkey', 'stumble', 'obstacle', 'pain', 'angel'],
  },
  {
    id: 'donkey-3', src: '/doodles/donkey/panel-3.jpg', topic: 'donkey',
    band: 27, paper: '#fcefd7', hasText: false,
    description: 'The rider raises a stick over the donkey, which has sat down flat in the middle of the road in a puff of dust.',
    tags: ['stubborn', 'stop', 'anger', 'donkey', 'road', 'refuse', 'stick', 'dust'],
  },
  {
    id: 'donkey-4', src: '/doodles/donkey/panel-4.jpg', topic: 'donkey',
    band: 27, paper: '#fcefd7', hasText: false,
    description: 'The donkey turns its head to speak while the sword-bearing angel finally stands in plain view.',
    tags: ['speak', 'voice', 'angel', 'sword', 'surprise', 'see', 'donkey', 'reveal'],
  },
  {
    id: 'donkey-5', src: '/doodles/donkey/panel-5.jpg', topic: 'donkey',
    band: 27, paper: '#fcefd7', hasText: false,
    description: 'The rider lies face-down in the dust before a blazing angel holding a sword, the donkey standing calm.',
    tags: ['bow', 'humble', 'angel', 'sword', 'fear', 'dust', 'repent', 'kneel'],
  },

  /* -- Abraham and Isaac, Genesis 22 --------------------------------------
     Purple-grey mountain rock, gold sunrise, a wide clean band throughout. */
  {
    id: 'genesis22-0', src: '/doodles/genesis22/panel-0.jpg', topic: 'genesis22',
    band: 22, paper: '#fdf8e4', hasText: false,
    description: 'An old man in blue leads a small boy carrying firewood up a rocky mountain path at sunrise, a lantern in his hand.',
    tags: ['mountain', 'climb', 'father', 'son', 'wood', 'lantern', 'path', 'sunrise', 'obedience', 'journey'],
  },
  {
    id: 'genesis22-1', src: '/doodles/genesis22/panel-1.jpg', topic: 'genesis22',
    band: 24, paper: '#fdf8e4', hasText: false,
    description: 'The old man kneels praying at a stone altar as an angel dives out of a blazing sky, the boy beside him.',
    tags: ['altar', 'prayer', 'angel', 'stone', 'kneel', 'sacrifice', 'stop', 'sky', 'light'],
  },
  {
    id: 'genesis22-2', src: '/doodles/genesis22/panel-2.jpg', topic: 'genesis22',
    band: 24, paper: '#fdf8e4', hasText: false,
    description: 'A ram caught in a thicket glows on the rocks while the old man rests a hand on the boy’s shoulder, both smiling.',
    tags: ['ram', 'sheep', 'thicket', 'provision', 'rescue', 'substitute', 'relief', 'bush', 'lamb'],
  },
  {
    id: 'genesis22-3', src: '/doodles/genesis22/panel-3.jpg', topic: 'genesis22',
    band: 24, paper: '#fdf8e4', hasText: true,
    description: 'A golden temple stands on the mountainside at sunrise beside a wooden signpost.',
    tags: ['temple', 'mountain', 'sunrise', 'place', 'gold', 'building'],
  },
  {
    id: 'genesis22-4', src: '/doodles/genesis22/panel-4.jpg', topic: 'genesis22',
    band: 24, paper: '#fdf8e4', hasText: false,
    description: 'A lone cross on a distant mountain ridge with light rays pouring down a rocky valley.',
    tags: ['cross', 'mountain', 'light', 'valley', 'ridge', 'ray', 'hill', 'sacrifice'],
  },
  {
    id: 'genesis22-5', src: '/doodles/genesis22/panel-5.jpg', topic: 'genesis22',
    band: 24, paper: '#fdf8e4', hasText: false,
    description: 'A wooden cross in the foreground linked by a golden ribbon of stars to a glowing temple on the mountain.',
    tags: ['cross', 'temple', 'thread', 'star', 'connection', 'promise', 'gold', 'mountain'],
  },

  /* -- The prodigal son, Luke 15 ------------------------------------------
     Golden wheat road, heart-and-swirl border, a 28% band on every panel. */
  {
    id: 'prodigal-0', src: '/doodles/prodigal/panel-0.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'A young man in ragged clothes walks away down a golden road with a coin purse while his father watches from the house.',
    tags: ['road', 'leave', 'money', 'son', 'father', 'house', 'away', 'field', 'journey'],
  },
  {
    id: 'prodigal-1', src: '/doodles/prodigal/panel-1.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'The young man throws his arms wide in a bright street party, coins and lanterns and confetti flying around him.',
    tags: ['party', 'crowd', 'money', 'city', 'celebration', 'spend', 'lantern', 'friend', 'coin'],
  },
  {
    id: 'prodigal-2', src: '/doodles/prodigal/panel-2.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'The young man sits slumped in the mud among pigs under a raining grey cloud, an empty bowl beside him.',
    tags: ['pig', 'mud', 'hunger', 'rain', 'bottom', 'empty', 'poverty', 'regret', 'bowl', 'cloud'],
  },
  {
    id: 'prodigal-3', src: '/doodles/prodigal/panel-3.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'The young man walks home alone along a golden wheat road at sunrise, head down.',
    tags: ['return', 'road', 'home', 'wheat', 'sunrise', 'walk', 'alone', 'repent', 'field'],
  },
  {
    id: 'prodigal-4', src: '/doodles/prodigal/panel-4.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'The father in purple runs down the road with arms flung wide toward his approaching son.',
    tags: ['run', 'father', 'welcome', 'arms', 'road', 'love', 'joy', 'meet', 'forgiveness'],
  },
  {
    id: 'prodigal-5', src: '/doodles/prodigal/panel-5.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: false,
    description: 'The father embraces the son at sunset while a ring, a robe and sandals float above them.',
    tags: ['embrace', 'hug', 'ring', 'robe', 'sandal', 'restore', 'welcome', 'sunset', 'gift'],
  },
  {
    id: 'prodigal-6', src: '/doodles/prodigal/panel-6.jpg', topic: 'prodigal',
    band: 28, paper: '#fdfaee', hasText: true,
    description: 'The elder brother stands arms-folded in cold light holding a long service record, the father reaching out from the warm lit house.',
    tags: ['brother', 'resentment', 'scroll', 'duty', 'cold', 'record', 'anger', 'house'],
  },

  /* -- Job 38 -------------------------------------------------------------
     Deckle-edged paper, an enormous cosmic swirl. Full-bleed: no natural
     band, and most panels carry drawn labels. */
  {
    id: 'job38-0', src: '/doodles/job38/panel-0.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'A weary man in torn robes sits on rubble under raining grey clouds and floating question marks.',
    tags: ['grief', 'loss', 'question', 'rain', 'suffering', 'ash', 'broken', 'cloud', 'sorrow'],
  },
  {
    id: 'job38-1', src: '/doodles/job38/panel-1.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'A small seated man beneath an enormous swirling cosmos of sun, planets, stars and a measuring ribbon.',
    tags: ['cosmos', 'star', 'planet', 'universe', 'small', 'creation', 'sun', 'wonder', 'sky'],
  },
  {
    id: 'job38-2', src: '/doodles/job38/panel-2.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'The cosmic swirl above three labelled roundels — an atom, a set of scales and a leaf — with arrows from the seated man.',
    tags: ['science', 'atom', 'scale', 'leaf', 'order', 'law', 'diagram', 'knowledge'],
  },
  {
    id: 'job38-3', src: '/doodles/job38/panel-3.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'A scientist in a lab coat peers through a brass telescope at the cosmic swirl, a glowing numeric medallion beside him.',
    tags: ['telescope', 'star', 'search', 'science', 'look', 'sky', 'study', 'wonder'],
  },
  {
    id: 'job38-4', src: '/doodles/job38/panel-4.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'A robed figure holds up scales and a scroll on a shore before rolling blue waves.',
    tags: ['scale', 'scroll', 'law', 'shore', 'wave', 'boundary', 'sea', 'justice'],
  },
  {
    id: 'job38-5', src: '/doodles/job38/panel-5.jpg', topic: 'job38',
    band: 1, paper: '#fefefc', hasText: true,
    description: 'A doctor, a judge, a labourer, a nurse and a teacher raise their hands together beneath the cosmic swirl.',
    tags: ['work', 'people', 'together', 'vocation', 'community', 'hand', 'praise', 'crowd'],
  },

  /* -- Psalm 22 -----------------------------------------------------------
     Spiral-notebook page, storm over a dark peak, a singer with a lyre.
     Full-bleed, so the band is manufactured. */
  {
    id: 'psalm22-0', src: '/doodles/psalm22/panel-0.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: false,
    description: 'A curly-haired singer kneels on a dark peak with arms flung wide, weeping under a thunderstorm, a lyre at his side.',
    tags: ['lament', 'storm', 'cry', 'lightning', 'mountain', 'lyre', 'music', 'grief', 'rain', 'alone'],
  },
  {
    id: 'psalm22-1', src: '/doodles/psalm22/panel-1.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: true,
    description: 'The weeping singer on the peak with a floating study card and a confidence gauge beside him.',
    tags: ['study', 'card', 'question', 'storm', 'honest', 'doubt', 'lament'],
  },
  {
    id: 'psalm22-2', src: '/doodles/psalm22/panel-2.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: true,
    description: 'The singer kneels in prayer beneath a large unfurled scroll carrying a cry of abandonment.',
    tags: ['scroll', 'prayer', 'kneel', 'cry', 'abandon', 'question', 'lament'],
  },
  {
    id: 'psalm22-3', src: '/doodles/psalm22/panel-3.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: false,
    description: 'The singer cries out as a golden thread runs from the storm cloud straight into his chest.',
    tags: ['thread', 'heart', 'storm', 'connection', 'cry', 'gold', 'cloud', 'pain', 'hope'],
  },
  {
    id: 'psalm22-4', src: '/doodles/psalm22/panel-4.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: true,
    description: 'The storm has cleared and the singer reaches toward three crosses on a distant hill.',
    tags: ['cross', 'hill', 'reach', 'dawn', 'clear', 'hope', 'sunrise'],
  },
  {
    id: 'psalm22-5', src: '/doodles/psalm22/panel-5.jpg', topic: 'psalm22',
    band: 2, paper: '#f5fafd', hasText: false,
    description: 'A giant golden hand of light reaches down and rests on the kneeling singer; the storm is gone.',
    tags: ['hand', 'light', 'comfort', 'answer', 'peace', 'rest', 'gold', 'presence', 'protection'],
  },

  /* -- Revelation 20 ------------------------------------------------------
     Spiral-notebook page, a sleeping rainbow dragon in chains and a blond
     angel with a key. Banner headings on most panels. */
  {
    id: 'rev20-0', src: '/doodles/rev20/panel-0.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: true,
    description: 'A blond angel locks a great chain on a sleeping rainbow dragon with a golden key, under a banner.',
    tags: ['dragon', 'chain', 'key', 'angel', 'bind', 'lock', 'sleep', 'evil'],
  },
  {
    id: 'rev20-1', src: '/doodles/rev20/panel-1.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: true,
    description: 'Four puzzled children argue in speech bubbles over the chained dragon.',
    tags: ['question', 'argue', 'confusion', 'child', 'debate', 'dragon', 'disagree'],
  },
  {
    id: 'rev20-2', src: '/doodles/rev20/panel-2.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: true,
    description: 'A banner over three labelled interpretation cards above the chained dragon.',
    tags: ['card', 'view', 'compare', 'interpretation', 'dragon', 'chain', 'option'],
  },
  {
    id: 'rev20-3', src: '/doodles/rev20/panel-3.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: true,
    description: 'The angel and dragon read an open book of timelines together, green ticks beside each.',
    tags: ['book', 'timeline', 'read', 'check', 'time', 'angel', 'dragon', 'study'],
  },
  {
    id: 'rev20-4', src: '/doodles/rev20/panel-4.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: false,
    description: 'A pensive winged angel holds a small flag, standing over three scene cards of sun, cloud and tree.',
    tags: ['angel', 'wing', 'think', 'flag', 'card', 'sun', 'cloud', 'tree', 'wait'],
  },
  {
    id: 'rev20-5', src: '/doodles/rev20/panel-5.jpg', topic: 'rev20',
    band: 1, paper: '#fffffd', hasText: true,
    description: 'A man and a woman shake hands under an open Bible while the dragon sleeps below them.',
    tags: ['handshake', 'peace', 'agree', 'bible', 'unity', 'friend', 'reconcile', 'book'],
  },

  /* -- Ecclesiastes 3:11 --------------------------------------------------
     Torn-edge paper, a boy with an infinity emblem, crayon sunsets. */
  {
    id: 'ecc311-0', src: '/doodles/ecc311/panel-0.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: false,
    description: 'A boy stands alone on a grassy ridge looking up at a vast crayon sunset streaked with stars and planets.',
    tags: ['sunset', 'star', 'wonder', 'sky', 'eternity', 'longing', 'hill', 'alone', 'look'],
  },
  {
    id: 'ecc311-1', src: '/doodles/ecc311/panel-1.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: false,
    description: 'A boy clutches a cracked glowing heart while money, trophies, a phone and a game controller erupt around him.',
    tags: ['heart', 'money', 'trophy', 'phone', 'empty', 'stuff', 'broken', 'success', 'craving'],
  },
  {
    id: 'ecc311-2', src: '/doodles/ecc311/panel-2.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: false,
    description: 'A giant open book floats above the boy, its pages showing a garden and a cross, golden light streaming down to a sandcastle.',
    tags: ['book', 'bible', 'garden', 'cross', 'light', 'story', 'sandcastle', 'read', 'gold'],
  },
  {
    id: 'ecc311-3', src: '/doodles/ecc311/panel-3.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: true,
    description: 'A huge golden question mark hangs in the sky above the boy on the ridge.',
    tags: ['question', 'mystery', 'wonder', 'sky', 'ask', 'search'],
  },
  {
    id: 'ecc311-4', src: '/doodles/ecc311/panel-4.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: true,
    description: 'Four stacked strips of the boy in ordinary life — a café, a bus, a desk, and walking in the rain with an umbrella.',
    tags: ['ordinary', 'work', 'bus', 'desk', 'rain', 'umbrella', 'routine', 'day', 'commute'],
  },
  {
    id: 'ecc311-5', src: '/doodles/ecc311/panel-5.jpg', topic: 'ecc311',
    band: 4, paper: '#fffffd', hasText: false,
    description: 'The boy sits reading an open book while a warm glowing version of his own face rises from the pages.',
    tags: ['read', 'book', 'light', 'face', 'understand', 'joy', 'discover', 'warm', 'sit'],
  },

  /* -- John 21, the charcoal fire ----------------------------------------
     Pink sunrise shore, a flame doodle border, Peter restored. */
  {
    id: 'wordstudy-0', src: '/doodles/wordstudy/panel-0.jpg', topic: 'wordstudy',
    band: 2, paper: '#fdfbee', hasText: false,
    description: 'Jesus in white and Peter sit facing each other by a charcoal fire with fish, a boat and nets behind them on a pink sunrise shore.',
    tags: ['fire', 'fish', 'shore', 'breakfast', 'boat', 'net', 'sunrise', 'talk', 'friend', 'beach'],
  },
  {
    id: 'wordstudy-1', src: '/doodles/wordstudy/panel-1.jpg', topic: 'wordstudy',
    band: 2, paper: '#fdfbee', hasText: true,
    description: 'The same beach scene with two large labelled hearts floating between the two men.',
    tags: ['heart', 'love', 'word', 'compare', 'question', 'shore', 'fire'],
  },
  {
    id: 'wordstudy-2', src: '/doodles/wordstudy/panel-2.jpg', topic: 'wordstudy',
    band: 37, paper: '#fdfbee', hasText: true,
    description: 'A charcoal fire with a smoking pan above it and a hanging paper tag.',
    tags: ['fire', 'coal', 'pan', 'smoke', 'memory', 'tag', 'cook'],
  },
  {
    id: 'wordstudy-3', src: '/doodles/wordstudy/panel-3.jpg', topic: 'wordstudy',
    band: 2, paper: '#fdfbee', hasText: true,
    description: 'Peter sits by a courtyard fire with a servant girl while a rooster crows in a night window.',
    tags: ['rooster', 'denial', 'courtyard', 'fire', 'night', 'shame', 'girl', 'crow'],
  },
  {
    id: 'wordstudy-4', src: '/doodles/wordstudy/panel-4.jpg', topic: 'wordstudy',
    band: 2, paper: '#fdfbee', hasText: false,
    description: 'Jesus hands Peter a lamb across the fire at sunrise.',
    tags: ['lamb', 'sheep', 'give', 'shepherd', 'trust', 'commission', 'fire', 'care', 'feed'],
  },
  {
    id: 'wordstudy-5', src: '/doodles/wordstudy/panel-5.jpg', topic: 'wordstudy',
    band: 2, paper: '#fdfbee', hasText: true,
    description: 'A cold blue fire joined by a golden thread to a warm bright fire, each with a hanging label.',
    tags: ['fire', 'thread', 'grace', 'restore', 'change', 'cold', 'warm', 'gold'],
  },

  /* -- Doors of insight ---------------------------------------------------
     Torn cream paper, a backpacked boy walking through brightly outlined
     doors. Every panel carries handwritten captions. */
  {
    id: 'panels-0', src: '/doodles/panels/panel-0.jpg', topic: 'panels',
    band: 7, paper: '#fefffd', hasText: true,
    description: 'A boy with a backpack walks between four brightly outlined open doors showing a scroll, a map, a lightbulb and a winged heart.',
    tags: ['door', 'insight', 'discovery', 'map', 'lightbulb', 'heart', 'scroll', 'walk', 'open'],
  },
  {
    id: 'panels-1', src: '/doodles/panels/panel-1.jpg', topic: 'panels',
    band: 7, paper: '#fefffd', hasText: true,
    description: 'The same door maze with one doorway glowing around a lamp-and-path verse card.',
    tags: ['door', 'lamp', 'path', 'light', 'guidance', 'word', 'glow'],
  },
  {
    id: 'panels-2', src: '/doodles/panels/panel-2.jpg', topic: 'panels',
    band: 7, paper: '#fefffd', hasText: true,
    description: 'The door maze with a golden Greek-lettered doorway opening onto a scroll, a temple and scholars.',
    tags: ['door', 'wisdom', 'greek', 'temple', 'scholar', 'scroll', 'study', 'language'],
  },
  {
    id: 'panels-3', src: '/doodles/panels/panel-3.jpg', topic: 'panels',
    band: 7, paper: '#fefffd', hasText: true,
    description: 'The boy steps through a red door where two scrolls spiral together in golden light.',
    tags: ['door', 'scroll', 'connect', 'link', 'gold', 'insight', 'together'],
  },
  {
    id: 'panels-4', src: '/doodles/panels/panel-4.jpg', topic: 'panels',
    band: 7, paper: '#fefffd', hasText: true,
    description: 'The door maze opening onto a galaxy, a tree, a compass rose and a telescope.',
    tags: ['door', 'galaxy', 'tree', 'compass', 'telescope', 'explore', 'discovery', 'direction'],
  },
  {
    id: 'panels-5', src: '/doodles/panels/panel-5.jpg', topic: 'panels',
    band: 0, paper: '#fbf1c0', hasText: true,
    description: 'The boy walks up out of the doors into a blazing golden sunburst.',
    tags: ['door', 'sunburst', 'gold', 'leave', 'warm', 'light', 'arrive', 'joy'],
  },
] as const;

export const DOODLE_BY_ID: Record<string, DoodlePanel> = Object.fromEntries(
  DOODLE_PANELS.map((p) => [p.id, p]),
);

/* ---------------------------------------------------------------------- */
/* Matching                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Same normalisation the icon matcher uses: lowercase, strip punctuation, and
 * shed a trailing plural s. Both libraries have to agree on what a term IS.
 */
function normalize(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
}

/**
 * One solid `visualTerms` hit (3) plus its no-text bonus. Below this the match
 * is a coincidence — a stray "light" or "hand" — and generating a fresh image
 * is the honest answer.
 */
const MIN_SCORE = 3;

/**
 * How well a panel fits a teaching, higher is better. Zero means no honest
 * connection at all, and zero is a refusal — a panel that does not fit is
 * worse than no panel, because a wrong picture actively misteaches.
 *
 * `visualTerms` are the model's own nouns for this teaching and are weighted
 * hardest. English words scraped out of the device text are a weaker signal
 * (and absent entirely in a Hindi short), so they score less.
 */
function scorePanel(
  panel: DoodlePanel,
  terms: Set<string>,
  weak: Set<string>,
): number {
  let score = 0;
  for (const tag of panel.tags) {
    const t = normalize(tag);
    if (terms.has(t)) score += 3;
    else if (weak.has(t)) score += 1;
  }
  if (score === 0) return 0;
  // Tie-breakers, never enough to rescue a panel that matched nothing.
  if (!panel.hasText) score += 0.5;
  if (panel.band >= MIN_BAND) score += 0.25;
  return score;
}

export interface DoodleMatch {
  panel: DoodlePanel;
  score: number;
}

/**
 * Pick the best panel for a teaching, or null when nothing genuinely fits.
 *
 * Deterministic: the same device always resolves to the same panel, which the
 * render contract requires and which also means a creator who re-runs a short
 * gets the picture they already approved. Ties break on panel id so the order
 * of DOODLE_PANELS is not load-bearing.
 */
export function matchDoodle(device: DeviceItem): DoodleMatch | null {
  const terms = new Set((device.visualTerms ?? []).map(normalize));

  // Weak signal: nouns already present in the authored English text. In a
  // non-English short this set is simply empty, which is correct — the panel
  // then has to be earned by visualTerms alone.
  const weak = new Set<string>();
  for (const word of `${device.content} ${device.point} ${device.explanation ?? ''}`
    .split(/\s+/)
    .map(normalize)) {
    if (word.length > 2 && !terms.has(word)) weak.add(word);
  }

  let best: DoodleMatch | null = null;
  for (const panel of DOODLE_PANELS) {
    const score = scorePanel(panel, terms, weak);
    if (score < MIN_SCORE) continue;
    if (!best || score > best.score || (score === best.score && panel.id < best.panel.id)) {
      best = { panel, score };
    }
  }
  return best;
}

/** The matched panel as a full-frame visual item. */
export function doodleVisual(panel: DoodlePanel, timeSec: number): VisualItem {
  return {
    kind: 'doodle',
    src: panel.src,
    term: panel.topic,
    timeSec,
    slot: 0,
    band: Math.max(panel.band, MIN_BAND),
    paper: panel.paper,
    credit: `Hand-drawn doodle panel (${panel.id}), CartoonForChrist / BibleBuddies`,
  };
}
