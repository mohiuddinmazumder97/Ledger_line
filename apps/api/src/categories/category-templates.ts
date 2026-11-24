/**
 * Default category templates (SPEC §2), offered at onboarding and used by the demo seed.
 * Ids are the prototype's category ids and are part of the API contract
 * (`POST /api/onboarding` → `categoryTemplateIds`).
 */
export const CATEGORY_TEMPLATES = [
  { id: 'food', name: 'Food & Drink', type: 'EXPENSE', subs: ['Groceries', 'Restaurants', 'Coffee'] },
  { id: 'transport', name: 'Transport', type: 'EXPENSE', subs: ['Fuel', 'Transit', 'Taxi'] },
  { id: 'housing', name: 'Housing', type: 'EXPENSE', subs: ['Rent', 'Utilities', 'Internet'] },
  { id: 'shopping', name: 'Shopping', type: 'EXPENSE', subs: ['Clothes', 'Electronics', 'Home'] },
  { id: 'health', name: 'Health', type: 'EXPENSE', subs: ['Pharmacy', 'Gym', 'Doctor'] },
  { id: 'fun', name: 'Entertainment', type: 'EXPENSE', subs: ['Streaming', 'Movies', 'Events'] },
  { id: 'salary', name: 'Salary', type: 'INCOME', subs: ['Monthly pay', 'Bonus'] },
  { id: 'side', name: 'Freelance', type: 'INCOME', subs: ['Design', 'Consulting'] },
  { id: 'interest', name: 'Interest', type: 'INCOME', subs: ['Savings', 'Dividends'] },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  subs: readonly string[];
}>;

export type CategoryTemplate = (typeof CATEGORY_TEMPLATES)[number];
export type CategoryTemplateId = CategoryTemplate['id'];

export const CATEGORY_TEMPLATE_IDS: readonly CategoryTemplateId[] = CATEGORY_TEMPLATES.map((t) => t.id);

/** Template sub-categories excluded from insights by default ("<template id>/<sub>"). Editable later. */
const EXCLUDED = new Set<string>(['housing/Rent']);

export function excludeFromInsightsByDefault(templateId: string, sub: string): boolean {
  return EXCLUDED.has(`${templateId}/${sub}`);
}

/** Nested Prisma create input for a template's categories + sub-categories, in template order. */
export function templateCategoryCreates(userId: string, ids: readonly string[]) {
  return CATEGORY_TEMPLATES.filter((t) => ids.includes(t.id)).map((t, i) => ({
    userId,
    name: t.name,
    type: t.type,
    sortOrder: i,
    subcategories: {
      create: t.subs.map((name, j) => ({
        userId,
        name,
        sortOrder: j,
        excludeFromInsights: excludeFromInsightsByDefault(t.id, name),
      })),
    },
  }));
}
