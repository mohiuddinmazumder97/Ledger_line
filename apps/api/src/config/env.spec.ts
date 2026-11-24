import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.SEED_TODAY).toBe('2026-11-22');
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ ...valid, PORT: '5001' }).PORT).toBe(5001);
  });

  it('rejects a missing DATABASE_URL and a malformed SEED_TODAY', () => {
    expect(() => validateEnv({ WEB_ORIGIN: valid.WEB_ORIGIN, SEED_TODAY: '22/11/2026' })).toThrow(
      /DATABASE_URL[\s\S]*SEED_TODAY|SEED_TODAY[\s\S]*DATABASE_URL/,
    );
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(/DATABASE_URL/);
  });
});
