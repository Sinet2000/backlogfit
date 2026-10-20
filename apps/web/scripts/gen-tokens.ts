import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildColorCss } from '../src/lib/styles/palette.ts';

const out = fileURLToPath(new URL('../src/lib/styles/colors.css', import.meta.url));
writeFileSync(out, buildColorCss());
console.log(`wrote ${out}`);
