import { describe, expect, it } from 'vitest';
import { roomContract } from './contract.ts';
import { fakeHarness } from './fakes.ts';

const harness = fakeHarness();
roomContract('fake ports', { describe, it, expect }, () => harness);
