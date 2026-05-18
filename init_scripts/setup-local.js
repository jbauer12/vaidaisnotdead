// setup-local.js — Initial setup for a local Ghost instance
//
// Runs all init scripts in sequence against localhost:2368.
// See README.md for prerequisites.
//
// Usage: node setup-local.js

import { spawnSync } from 'child_process';

const scripts = [
  'ghost-sdk-example.js', // site settings, pages with content, FAQ, gallery
  'setup-pages.js',       // remaining stub pages (Kontakt, Events, …)
  'events.js',            // current events
];

for (const script of scripts) {
  console.log(`\n${'─'.repeat(60)}\n  ${script}\n${'─'.repeat(60)}`);
  const result = spawnSync('node', [script, '--local'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n✗ ${script} failed (exit ${result.status})`);
    process.exit(result.status);
  }
}

console.log('\n✓ Local setup complete.\n');
