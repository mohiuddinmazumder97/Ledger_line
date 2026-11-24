import { createHash } from 'node:crypto';
import {
  ACCOUNTS,
  type AccountKey,
  genTx,
  goalInitialSaved,
  ledgerNets,
  openingBalances,
  rng,
} from './seed-data.js';

/**
 * Golden test for the genTx() port (seed 11, SEED_TODAY = 2026-11-22).
 * The pinned values were cross-checked against the prototype script itself: same 340 rows,
 * field for field. If this fails, the port drifted — fix the port, don't re-pin.
 */
describe('seed generator (golden)', () => {
  const txs = genTx('2026-11-22');

  const sumBy = (pick: (t: (typeof txs)[number]) => string) => {
    const out: Record<string, bigint> = {};
    for (const t of txs) out[pick(t)] = (out[pick(t)] ?? 0n) + t.amountMinor;
    return out;
  };

  it('generates the exact number of transactions', () => {
    expect(txs).toHaveLength(340);
    expect(txs.filter((t) => t.type === 'EXPENSE')).toHaveLength(302);
    expect(txs.filter((t) => t.type === 'INCOME')).toHaveLength(26);
    expect(txs.filter((t) => t.type === 'TRANSFER')).toHaveLength(12);
  });

  it('pins per-type totals in minor units', () => {
    expect(sumBy((t) => t.type)).toEqual({ EXPENSE: 3024712n, INCOME: 7156600n, TRANSFER: 600000n });
    expect(sumBy((t) => `${t.type}:${t.currency}`)).toEqual({
      'EXPENSE:USD': 2990247n,
      'EXPENSE:EUR': 34465n,
      'INCOME:USD': 7156600n,
      'TRANSFER:USD': 600000n,
    });
  });

  it('pins per-account ledger nets', () => {
    expect(ledgerNets(txs)).toEqual({
      chk: 4063992n,
      sav: 600000n,
      cash: -20237n,
      cc: -477402n,
      eur: -34465n,
      inr: 0n,
    });
  });

  it('pins the full sequence (fingerprint)', () => {
    const json = JSON.stringify(txs, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
    expect(createHash('sha256').update(json).digest('hex')).toBe(
      '42b1b920eece185b0a87a6c828f589f113fd69a94b3cc4fc19e2c93b7dd8e267',
    );
  });

  it('covers 365 days ending at SEED_TODAY', () => {
    expect(txs[0]!.local).toMatchObject({ year: 2025, month: 11, day: 23 });
    // Nov 21–22 2026 happen to draw no transactions in the prototype either.
    expect(txs.at(-1)!.local).toMatchObject({ year: 2026, month: 11, day: 20 });
  });

  it('links recurring rows: 12 occurrences of each monthly item', () => {
    const counts: Record<string, number> = {};
    for (const t of txs) if (t.recurring) counts[t.recurring] = (counts[t.recurring] ?? 0) + 1;
    expect(counts).toEqual({ salary: 12, savings: 12, rent: 12, gym: 12, internet: 12, streaming: 12 });
  });

  it('tags some expenses "work" and pays some restaurants from the EUR account', () => {
    expect(txs.filter((t) => t.tags.includes('work'))).toHaveLength(16);
    const eur = txs.filter((t) => t.currency === 'EUR');
    expect(eur.length).toBeGreaterThan(0);
    expect(eur.every((t) => t.account === 'eur' && t.subcategory === 'Restaurants')).toBe(true);
  });

  it('back-solves opening balances so derived balances equal the prototype to the cent', () => {
    const opening = openingBalances(txs);
    const net = ledgerNets(txs);
    for (const a of ACCOUNTS) expect(opening[a.key] + net[a.key]).toBe(a.baseMinor);
    expect(opening).toEqual<Record<AccountKey, bigint>>({
      chk: 482050n - 4063992n,
      sav: 1240000n - 600000n,
      cash: 18600n + 20237n,
      cc: -124030n + 477402n,
      eur: 215000n + 34465n,
      inr: 18500000n,
    });
  });

  it('back-solves goal initial saved amounts', () => {
    // Emergency fund: $6,200 shown − 12 × $500 linked transfers = $200.
    expect(goalInitialSaved(txs)).toEqual({ g1: 20000n, g2: 135000n, g3: 190000n });
  });

  it('is deterministic and anchored on the given date', () => {
    expect(genTx('2026-11-22')).toEqual(txs);
    const other = genTx('2025-03-31');
    expect(other[0]!.local).toMatchObject({ year: 2024, month: 4, day: 1 });
    const key = (t: (typeof other)[number]) => t.local.year * 10000 + t.local.month * 100 + t.local.day;
    expect(Math.max(...other.map(key))).toBeLessThanOrEqual(20250331);
    expect(Math.min(...other.map(key))).toBe(20240401);
  });

  it('keeps the prototype PRNG', () => {
    const r = rng(11);
    const first = [r(), r(), r()];
    const again = rng(11);
    expect([again(), again(), again()]).toEqual(first);
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
