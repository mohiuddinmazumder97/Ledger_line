/**
 * Demo data, ported from the prototype script (docs/design/ledgerline-prototype.dc.html).
 * Pure: no database, no clock. `prisma/seed.ts` writes it; `seed-data.spec.ts` pins it.
 *
 * `genTx()` must stay byte-for-byte equivalent to the prototype: same PRNG (seed 11), same
 * order of `r()` calls, same float steps before converting to minor units. Any drift fails
 * the golden test.
 */

export type AccountKey = 'chk' | 'sav' | 'cash' | 'cc' | 'eur' | 'inr';
export type CategoryKey =
  'food' | 'transport' | 'housing' | 'shopping' | 'health' | 'fun' | 'salary' | 'side' | 'interest';
export type GoalKey = 'g1' | 'g2' | 'g3';
export type RecurringKey = 'salary' | 'savings' | 'rent' | 'gym' | 'internet' | 'streaming';
export type SeedCurrency = 'USD' | 'EUR' | 'INR';

export const DEFAULT_SEED_TODAY = '2026-11-22';
export const SEED_PRNG = 11;
export const SEED_TIMEZONE = 'America/New_York';

export const SEED_USER = {
  name: 'Alex Moreno',
  email: 'alex@example.com',
  password: 'password123',
  baseCurrency: 'USD',
  timezone: SEED_TIMEZONE,
} as const;

export const CATEGORIES: ReadonlyArray<{
  key: CategoryKey;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  subs: readonly string[];
}> = [
  { key: 'food', name: 'Food & Drink', type: 'EXPENSE', subs: ['Groceries', 'Restaurants', 'Coffee'] },
  { key: 'transport', name: 'Transport', type: 'EXPENSE', subs: ['Fuel', 'Transit', 'Taxi'] },
  { key: 'housing', name: 'Housing', type: 'EXPENSE', subs: ['Rent', 'Utilities', 'Internet'] },
  { key: 'shopping', name: 'Shopping', type: 'EXPENSE', subs: ['Clothes', 'Electronics', 'Home'] },
  { key: 'health', name: 'Health', type: 'EXPENSE', subs: ['Pharmacy', 'Gym', 'Doctor'] },
  { key: 'fun', name: 'Entertainment', type: 'EXPENSE', subs: ['Streaming', 'Movies', 'Events'] },
  { key: 'salary', name: 'Salary', type: 'INCOME', subs: ['Monthly pay', 'Bonus'] },
  { key: 'side', name: 'Freelance', type: 'INCOME', subs: ['Design', 'Consulting'] },
  { key: 'interest', name: 'Interest', type: 'INCOME', subs: ['Savings', 'Dividends'] },
];

/** Sub-categories excluded from the heatmap / largest purchase (SPEC §2). */
export const EXCLUDE_FROM_INSIGHTS: ReadonlySet<string> = new Set(['Housing/Rent']);

/** `baseMinor` = the prototype's displayed balance; opening balances are back-solved from it. */
export const ACCOUNTS: ReadonlyArray<{
  key: AccountKey;
  name: string;
  kind: 'BANK' | 'SAVINGS' | 'CASH' | 'CREDIT' | 'INVESTMENT';
  currency: SeedCurrency;
  baseMinor: bigint;
  showOnDashboard: boolean;
}> = [
  {
    key: 'chk',
    name: 'Everyday Checking',
    kind: 'BANK',
    currency: 'USD',
    baseMinor: 482050n,
    showOnDashboard: true,
  },
  {
    key: 'sav',
    name: 'High-Yield Savings',
    kind: 'SAVINGS',
    currency: 'USD',
    baseMinor: 1240000n,
    showOnDashboard: true,
  },
  {
    key: 'cash',
    name: 'Cash Wallet',
    kind: 'CASH',
    currency: 'USD',
    baseMinor: 18600n,
    showOnDashboard: true,
  },
  {
    key: 'cc',
    name: 'Credit Card',
    kind: 'CREDIT',
    currency: 'USD',
    baseMinor: -124030n,
    showOnDashboard: true,
  },
  {
    key: 'eur',
    name: 'Euro Account',
    kind: 'BANK',
    currency: 'EUR',
    baseMinor: 215000n,
    showOnDashboard: true,
  },
  {
    key: 'inr',
    name: 'India Savings',
    kind: 'SAVINGS',
    currency: 'INR',
    baseMinor: 18500000n,
    showOnDashboard: false,
  },
];

export const BUDGETS: ReadonlyArray<{ category: CategoryKey; limitMinor: bigint }> = [
  { category: 'food', limitMinor: 60000n },
  { category: 'transport', limitMinor: 20000n },
  { category: 'shopping', limitMinor: 30000n },
  { category: 'fun', limitMinor: 12000n },
  { category: 'health', limitMinor: 15000n },
];

/** `savedMinor` = the prototype's displayed saved amount; initialSavedMinor is back-solved. */
export const GOALS: ReadonlyArray<{
  key: GoalKey;
  name: string;
  targetMinor: bigint;
  savedMinor: bigint;
  targetDate: string;
}> = [
  { key: 'g1', name: 'Emergency fund', targetMinor: 1000000n, savedMinor: 620000n, targetDate: '2027-06-01' },
  { key: 'g2', name: 'Japan trip', targetMinor: 400000n, savedMinor: 135000n, targetDate: '2027-04-01' },
  { key: 'g3', name: 'New laptop', targetMinor: 220000n, savedMinor: 190000n, targetDate: '2027-01-01' },
];

/** Prototype due dates ("Dec 1", "Jan 15", "Nov 10") resolved relative to 2026-11-22. */
export const DEBTS: ReadonlyArray<{
  person: string;
  direction: 'LENT' | 'BORROWED';
  amountMinor: bigint;
  note: string;
  dueDate: string;
  settled: boolean;
}> = [
  {
    person: 'Sam Okafor',
    direction: 'LENT',
    amountMinor: 20000n,
    note: 'Concert tickets',
    dueDate: '2026-12-01',
    settled: false,
  },
  {
    person: 'Priya Nair',
    direction: 'BORROWED',
    amountMinor: 50000n,
    note: 'Deposit for flat',
    dueDate: '2027-01-15',
    settled: false,
  },
  {
    person: 'Leo Marsh',
    direction: 'LENT',
    amountMinor: 4500n,
    note: 'Dinner split',
    dueDate: '2026-11-10',
    settled: true,
  },
];

/**
 * USD→X rates. The prototype stores X→USD (EUR 1.08, INR 0.012); we store the inverse at
 * Decimal(18,8). Cross rates go through USD.
 */
export const USD_RATES: ReadonlyArray<{ quote: SeedCurrency; rate: string }> = [
  { quote: 'EUR', rate: '0.92592593' }, // 1 / 1.08
  { quote: 'INR', rate: '83.33333333' }, // 1 / 0.012
];

export const RECURRING: Record<RecurringKey, { note: string }> = {
  salary: { note: 'Payroll · Northwind Studio' },
  savings: { note: 'Monthly savings' },
  rent: { note: 'Rent' },
  gym: { note: 'Gym membership' },
  internet: { note: 'Fiber internet' },
  streaming: { note: 'Streaming plan' },
};

const NOTES: Record<string, readonly string[]> = {
  Groceries: ['Green Basket Market', 'Corner Grocer', 'Fresh Fields'],
  Restaurants: ['Noodle House', 'Taqueria Sol', 'Bistro 42', 'Pizza night'],
  Coffee: ['Morning Brew', 'Daily Grind'],
  Transit: ['Metro fare'],
  Taxi: ['Ride home', 'Airport ride'],
  Fuel: ['Fuel stop'],
  Clothes: ['Winter jacket', 'Running shoes', 'T-shirts'],
  Home: ['Kitchen supplies', 'Light bulbs', 'Plants'],
  Pharmacy: ['Pharmacy'],
  Movies: ['Cinema tickets'],
  Events: ['Concert', 'Museum pass'],
};

/** [category, sub, min, max, account, weight] */
const DAILY: ReadonlyArray<readonly [CategoryKey, string, number, number, AccountKey, number]> = [
  ['food', 'Groceries', 18, 110, 'chk', 3],
  ['food', 'Restaurants', 14, 65, 'cc', 3],
  ['food', 'Coffee', 3, 7, 'cash', 4],
  ['transport', 'Transit', 2.75, 2.75, 'chk', 3],
  ['transport', 'Taxi', 12, 38, 'cc', 1],
  ['transport', 'Fuel', 35, 62, 'cc', 1],
  ['shopping', 'Clothes', 25, 140, 'cc', 1],
  ['shopping', 'Home', 9, 80, 'cc', 1],
  ['health', 'Pharmacy', 8, 40, 'chk', 1],
  ['fun', 'Movies', 14, 30, 'cc', 1],
  ['fun', 'Events', 30, 90, 'cc', 0.5],
];

/** Wall-clock time in the seed user's timezone. */
export interface LocalDateTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface SeedTx {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  account: AccountKey;
  amountMinor: bigint;
  currency: SeedCurrency;
  local: LocalDateTime;
  note: string;
  category?: CategoryKey;
  subcategory?: string;
  toAccount?: AccountKey;
  toAmountMinor?: bigint;
  goal?: GoalKey;
  recurring?: RecurringKey;
  tags: string[];
}

/** The prototype's PRNG (mulberry32), verbatim. */
export function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dollar float (already rounded to cents by the prototype) → minor units. */
const cents = (amount: number): bigint => BigInt(Math.round(amount * 100));

/**
 * 365 days of transactions ending at `today` (YYYY-MM-DD), oldest first.
 * Port of the prototype's genTx(); only the calendar date of `today` matters.
 */
export function genTx(today: string = DEFAULT_SEED_TODAY): SeedTx[] {
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const r = rng(SEED_PRNG);
  const out: SeedTx[] = [];
  const W = DAILY.reduce((a, x) => a + x[5], 0);

  for (let i = 364; i >= 0; i--) {
    // UTC arithmetic = pure calendar arithmetic (no host-timezone or DST effects).
    const d = new Date(Date.UTC(ty, tm - 1, td - i));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const dm = d.getUTCDate();
    const at = (hour: number, minute: number): LocalDateTime => ({ year, month, day: dm, hour, minute });
    const push = (tx: Omit<SeedTx, 'tags'> & { tags?: string[] }) => out.push({ tags: [], ...tx });

    if (dm === 1)
      push({
        type: 'INCOME',
        amountMinor: cents(5200),
        currency: 'USD',
        account: 'chk',
        category: 'salary',
        subcategory: 'Monthly pay',
        note: RECURRING.salary.note,
        local: at(9, 0),
        recurring: 'salary',
      });
    if (dm === 2)
      push({
        type: 'TRANSFER',
        amountMinor: cents(500),
        currency: 'USD',
        account: 'chk',
        toAccount: 'sav',
        toAmountMinor: cents(500),
        note: RECURRING.savings.note,
        local: at(9, 30),
        recurring: 'savings',
        goal: 'g1',
      });
    if (dm === 3)
      push({
        type: 'EXPENSE',
        amountMinor: cents(1650),
        currency: 'USD',
        account: 'chk',
        category: 'housing',
        subcategory: 'Rent',
        note: RECURRING.rent.note,
        local: at(10, 0),
        recurring: 'rent',
      });
    if (dm === 5)
      push({
        type: 'EXPENSE',
        amountMinor: cents(39),
        currency: 'USD',
        account: 'chk',
        category: 'health',
        subcategory: 'Gym',
        note: RECURRING.gym.note,
        local: at(7, 10),
        recurring: 'gym',
      });
    if (dm === 10)
      push({
        type: 'EXPENSE',
        amountMinor: cents(59.99),
        currency: 'USD',
        account: 'cc',
        category: 'housing',
        subcategory: 'Internet',
        note: RECURRING.internet.note,
        local: at(8, 0),
        recurring: 'internet',
      });
    if (dm === 15)
      push({
        type: 'EXPENSE',
        amountMinor: cents(15.99),
        currency: 'USD',
        account: 'cc',
        category: 'fun',
        subcategory: 'Streaming',
        note: RECURRING.streaming.note,
        local: at(8, 0),
        recurring: 'streaming',
      });
    if (dm === 20)
      push({
        type: 'EXPENSE',
        amountMinor: cents(Math.round((70 + r() * 70) * 100) / 100),
        currency: 'USD',
        account: 'chk',
        category: 'housing',
        subcategory: 'Utilities',
        note: 'Electricity & water',
        local: at(11, 0),
      });

    const n = Math.floor(r() * r() * 4.4);
    for (let k = 0; k < n; k++) {
      let x = r() * W;
      let it = DAILY[0]!;
      for (it of DAILY) {
        x -= it[5];
        if (x <= 0) break;
      }
      const amt = Math.round((it[2] + r() * (it[3] - it[2])) * 100) / 100;
      const notes = NOTES[it[1]]!;
      let account = it[4];
      let currency: SeedCurrency = 'USD';
      if (it[1] === 'Restaurants' && r() < 0.1) {
        account = 'eur';
        currency = 'EUR';
      }
      // Evaluation order matches the prototype's object literal: note, then date, then tags.
      const note = notes[Math.floor(r() * notes.length)]!;
      const local = at(8 + Math.floor(r() * 13), Math.floor(r() * 60));
      const tags = r() < 0.1 ? ['work'] : [];
      push({
        type: 'EXPENSE',
        amountMinor: cents(amt),
        currency,
        account,
        category: it[0],
        subcategory: it[1],
        note,
        local,
        tags,
      });
    }
    if (r() < 0.035)
      push({
        type: 'INCOME',
        amountMinor: cents(Math.round(300 + r() * 700)),
        currency: 'USD',
        account: 'chk',
        category: 'side',
        subcategory: 'Design',
        note: 'Client invoice',
        local: at(16, 0),
      });
  }
  return out;
}

/** Net effect of the ledger on each account, in that account's minor units. */
export function ledgerNets(txs: readonly SeedTx[]): Record<AccountKey, bigint> {
  const net = Object.fromEntries(ACCOUNTS.map((a) => [a.key, 0n])) as Record<AccountKey, bigint>;
  for (const tx of txs) {
    if (tx.type === 'INCOME') net[tx.account] += tx.amountMinor;
    else if (tx.type === 'EXPENSE') net[tx.account] -= tx.amountMinor;
    else {
      net[tx.account] -= tx.amountMinor;
      net[tx.toAccount!] += tx.toAmountMinor!;
    }
  }
  return net;
}

/** Opening balance = prototype balance − ledger net, so derived balances match the prototype. */
export function openingBalances(txs: readonly SeedTx[]): Record<AccountKey, bigint> {
  const net = ledgerNets(txs);
  return Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.baseMinor - net[a.key]])) as Record<
    AccountKey,
    bigint
  >;
}

/** initialSavedMinor = prototype saved − linked seed transfers (all goals are USD, like their accounts). */
export function goalInitialSaved(txs: readonly SeedTx[]): Record<GoalKey, bigint> {
  const linked = Object.fromEntries(GOALS.map((g) => [g.key, 0n])) as Record<GoalKey, bigint>;
  for (const tx of txs) if (tx.goal) linked[tx.goal] += tx.amountMinor;
  return Object.fromEntries(GOALS.map((g) => [g.key, g.savedMinor - linked[g.key]])) as Record<
    GoalKey,
    bigint
  >;
}
