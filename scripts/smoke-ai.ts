/**
 * Live smoke test for the AI provider seam.
 *
 *   npm run smoke:ai
 *
 * Runs whichever provider is configured (Gloo if credentials exist, otherwise
 * the Claude fallback) against a real passage and prints the devices plus the
 * provider telemetry. The passage text here is a literal copy of the Berean
 * Standard Bible (public domain) so this script needs no YouVersion key —
 * in the real pipeline it always comes from the API.
 */

import { getProvider, providerStatus } from '@/lib/ai';
import type { PromptContext } from '@/lib/types';

const PASSAGE: PromptContext = {
  ageGroup: 'youth',
  proficiencyLevel: 'intermediate',
  preferredLanguage: 'en',
  passageReference: 'Luke 15:20',
  passageText:
    'So he got up and went to his father. But while he was still in the distance, his father saw him and was filled with compassion. He ran to his son, embraced him, and kissed him.',
  versionAbbreviation: 'BSB',
};

async function main() {
  const status = providerStatus();
  console.log('provider     :', status.active);
  console.log('gloo ready   :', status.glooConfigured);
  console.log('claude ready :', status.claudeConfigured);
  if (status.degradedReason) console.log('note         :', status.degradedReason);
  console.log();

  const provider = getProvider();

  console.log(`Generating hooks for ${PASSAGE.passageReference}...\n`);
  const result = await provider.generateDevices({
    context: PASSAGE,
    filterType: 'hook',
    tradition: 'evangelical',
  });

  for (const [i, device] of result.devices.entries()) {
    console.log(`${i + 1}. ${device.emoji}  [${device.type}]`);
    console.log(`   ${device.content}`);
    console.log(`   -> ${device.point}`);
    console.log(`   anchored to: ${device.reference}\n`);
  }

  console.log('meta:', JSON.stringify(result.meta, null, 2));

  console.log('\nSuggesting references for "the fear of being replaced at work"...');
  const refs = await provider.suggestReferences(
    'the fear of being replaced at work',
    'en',
  );
  console.log(refs.join(' · '));
  console.log(
    '\nNote: these are references only. The verse text for each is fetched from',
    'YouVersion, never from the model.',
  );
}

main().catch((error) => {
  console.error('\nSMOKE TEST FAILED');
  console.error(error);
  process.exit(1);
});
