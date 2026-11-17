import { describe, expect, it, vi } from 'vitest';
import { as, ORG } from './classes/__tests__/fixtures';
import { createInMemoryRepositories } from './__tests__/fakes';
import { createServices } from './runtime';
import { systemClock } from './services/clock';

describe('runtime wiring: classes', () => {
  it('the class service reads from the repository it was given, not a placeholder', async () => {
    const repositories = createInMemoryRepositories();
    const listClasses = vi.spyOn(repositories.classes, 'listClasses');
    const result = await createServices(repositories, systemClock).classes.listClasses(as('staff'));
    expect(listClasses).toHaveBeenCalledWith(ORG);
    expect(result).toEqual({ ok: true, value: [] });
  });
});
