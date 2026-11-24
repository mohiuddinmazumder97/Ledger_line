import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

/**
 * Node's happy-eyeballs gives each resolved address only 250 ms to connect, which a
 * high-latency link to a hosted database (e.g. Neon in us-east-2) can exceed — every
 * attempt then fails with ETIMEDOUT. Import this once, first, in each entry point.
 */
setDefaultAutoSelectFamilyAttemptTimeout(2000);
