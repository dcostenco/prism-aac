import { afterEach, expect, it } from 'vitest';
import { resolveDwellTarget } from '@/services/dwellTarget';
afterEach(() => document.body.replaceChildren());
it('resolves the actual native button without forwarding its associated caption', () => {
  const row = document.createElement('label'), caption = document.createElement('span'), button = document.createElement('button');
  row.append(caption, button); document.body.append(row);
  expect(resolveDwellTarget(row)).toBeNull(); expect(resolveDwellTarget(caption)).toBeNull();
  expect(resolveDwellTarget(button)).toBe(button);
});
it.each(['disabled', 'inert', 'hidden', 'aria-disabled', 'aria-hidden', 'opacity'])(
  'rejects %s targets and ancestors instead of producing camera feedback', defect => {
    const row = document.createElement('div'), button = document.createElement('button');
    row.append(button); document.body.append(row);
    if (defect === 'disabled') button.disabled = true;
    else if (defect === 'opacity') row.style.opacity = '0';
    else row.setAttribute(defect, defect.startsWith('aria-') ? 'true' : '');
    expect(resolveDwellTarget(button)).toBeNull();
  });
