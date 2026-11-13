// Custom dropdown for the enquiry form, following the WAI-ARIA "select-only combobox" pattern.
// The native <select> stays in the DOM (visually hidden) as the source of truth, so FormData, `required`
// validation, form.reset() and the per-kind enable/disable logic in form.ts all keep working unchanged.
// Without JavaScript the native select is simply shown.

let uid = 0;

export function enhanceSelect(select: HTMLSelectElement) {
  const id = select.id || `sel-${++uid}`;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
  if (label && !label.id) label.id = `${id}-label`;

  const wrap = document.createElement('div');
  wrap.className = 'select';
  if (select.dir) wrap.dir = select.dir;
  select.replaceWith(wrap);
  wrap.append(select);
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'select__btn';
  btn.setAttribute('role', 'combobox');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', `${id}-list`);
  if (label) btn.setAttribute('aria-labelledby', `${label.id} ${id}-btn`);
  btn.id = `${id}-btn`;
  const value = document.createElement('span');
  value.className = 'select__value';
  btn.append(value);
  btn.insertAdjacentHTML('beforeend', '<svg class="select__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');

  const list = document.createElement('ul');
  list.className = 'select__list';
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  if (label) list.setAttribute('aria-labelledby', label.id);

  // The empty first option is only the "Choose" placeholder, so it is shown on the button but not offered in the list.
  const placeholder = select.options[0]?.value === '' ? select.options[0].text : '';
  const choices = [...select.options].filter((o) => o.value !== '');
  const items = choices.map((o, i) => {
    const li = document.createElement('li');
    li.id = `${id}-opt-${i}`;
    li.className = 'select__opt';
    li.setAttribute('role', 'option');
    li.dataset.value = o.value;
    li.innerHTML = '<span></span><svg class="select__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    li.firstElementChild!.textContent = o.text;
    list.append(li);
    return li;
  });
  wrap.append(btn, list);

  let active = -1;
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  const selectedIndex = () => choices.findIndex((o) => o.value === select.value);

  const render = () => {
    const i = selectedIndex();
    value.textContent = i >= 0 ? choices[i].text : placeholder;
    wrap.classList.toggle('is-empty', i < 0);
    items.forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
  };

  const setActive = (i: number) => {
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((li, j) => li.classList.toggle('is-active', j === active));
    btn.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  };

  const open = () => {
    if (isOpen() || select.disabled) return;
    // Drop the list upwards when there isn't room for it below the field.
    const r = btn.getBoundingClientRect();
    const need = Math.min(items.length * 48 + 16, 300);
    wrap.classList.toggle('is-up', window.innerHeight - r.bottom < need && r.top > need);
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    setActive(selectedIndex() >= 0 ? selectedIndex() : 0);
    document.addEventListener('pointerdown', outside, true);
  };

  const close = () => {
    if (!isOpen()) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-activedescendant');
    wrap.classList.remove('is-open');
    document.removeEventListener('pointerdown', outside, true);
  };

  const choose = (i: number) => {
    const next = choices[i]?.value;
    if (next !== undefined && next !== select.value) {
      select.value = next;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    render();
    close();
    btn.focus();
  };

  const outside = (e: Event) => {
    if (!wrap.contains(e.target as Node)) close();
  };

  // Type-ahead: typing letters jumps to the first option that starts with them.
  let typed = '';
  let typedAt = 0;
  const typeAhead = (ch: string) => {
    const now = Date.now();
    typed = now - typedAt > 600 ? ch : typed + ch;
    typedAt = now;
    const from = isOpen() ? active : selectedIndex();
    const order = [...items.keys()].map((k) => (k + Math.max(from, 0) + (typed.length === 1 ? 1 : 0)) % items.length);
    const hit = order.find((k) => choices[k].text.toLowerCase().startsWith(typed));
    if (hit === undefined) return;
    if (isOpen()) setActive(hit);
    else choose(hit);
  };

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  btn.addEventListener('keydown', (e) => {
    const last = items.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen()) open();
        else if (e.altKey) choose(active);
        else setActive(active + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen()) open();
        else if (e.altKey) choose(active);
        else setActive(active - 1);
        break;
      case 'Home':
        if (isOpen()) { e.preventDefault(); setActive(0); }
        break;
      case 'End':
        if (isOpen()) { e.preventDefault(); setActive(last); }
        break;
      case 'PageDown':
        if (isOpen()) { e.preventDefault(); setActive(active + 5); }
        break;
      case 'PageUp':
        if (isOpen()) { e.preventDefault(); setActive(active - 5); }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen()) choose(active);
        else open();
        break;
      case 'Escape':
        if (isOpen()) { e.preventDefault(); close(); }
        break;
      case 'Tab':
        if (isOpen()) choose(active);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          typeAhead(e.key.toLowerCase());
        }
    }
  });
  btn.addEventListener('blur', (e) => {
    if (!wrap.contains(e.relatedTarget as Node)) close();
  });

  list.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus on the button
  list.addEventListener('click', (e) => {
    const li = (e.target as Element).closest<HTMLLIElement>('.select__opt');
    if (li) choose(items.indexOf(li));
  });
  list.addEventListener('pointermove', (e) => {
    const li = (e.target as Element).closest<HTMLLIElement>('.select__opt');
    if (li && items.indexOf(li) !== active) setActive(items.indexOf(li));
  });

  // form.ts focuses the native select when it is the first invalid field, and a <label for> click lands there too.
  select.addEventListener('focus', () => btn.focus());
  select.addEventListener('change', render);
  select.form?.addEventListener('reset', () => requestAnimationFrame(render));

  // Mirror validation and enabled state from the native select onto the visible button.
  const mirror = () => {
    btn.disabled = select.disabled;
    for (const attr of ['aria-invalid', 'aria-describedby', 'aria-required'] as const) {
      const v = attr === 'aria-required' ? (select.required ? 'true' : null) : select.getAttribute(attr);
      if (v === null) btn.removeAttribute(attr);
      else btn.setAttribute(attr, v);
    }
    if (select.disabled) close();
  };
  new MutationObserver(mirror).observe(select, { attributes: true, attributeFilter: ['disabled', 'aria-invalid', 'aria-describedby'] });
  mirror();
  render();
}
