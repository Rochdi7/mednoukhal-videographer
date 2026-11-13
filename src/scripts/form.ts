// One enquiry form: validates in place and posts to the PHP endpoint. ?service= in the URL pre-selects the service.
import { enhanceSelect } from './select';

type Errors = Record<string, string>;

const form = document.querySelector<HTMLFormElement>('[data-enquiry]');

if (form) {
  const root = form.closest('[data-enquiry-root]')!;
  const success = root.querySelector<HTMLElement>('[data-success]')!;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = form.querySelector<HTMLElement>('[data-submit-label]')!;
  const idleLabel = label.textContent ?? '';
  const errors = JSON.parse(form.dataset.errors!) as Errors;
  const started = form.elements.namedItem('started') as HTMLInputElement;
  type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const controls = () => [...form.querySelectorAll<Control>('.form-grid input, .form-grid select, .form-grid textarea')].filter((c) => !c.disabled);

  const stamp = () => {
    started.value = String(Date.now());
  };
  stamp();

  const serviceSelect = form.querySelector<HTMLSelectElement>('#f-service')!;
  const requested = new URLSearchParams(location.search).get('service');
  const preselect = () => {
    if (requested && [...serviceSelect.options].some((o) => o.value === requested)) serviceSelect.value = requested;
  };
  preselect();
  form.querySelectorAll<HTMLSelectElement>('.field select').forEach(enhanceSelect);

  const setError = (name: string, message: string) => {
    const control = form.querySelector<Control>(`[name="${name}"]`);
    const slot = form.querySelector<HTMLElement>(`#err-${name}`);
    if (!control || !slot) return;
    slot.textContent = message;
    slot.hidden = !message;
    if (message) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', slot.id);
    } else {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    }
  };

  const messageFor = (c: Control) => {
    const v = c.validity;
    if (v.valueMissing || v.tooShort) return errors.required;
    if (v.typeMismatch) return errors.email;
    if (v.patternMismatch) return errors.phone;
    if (v.rangeUnderflow || v.badInput) return errors.date;
    return '';
  };

  form.addEventListener('input', (e) => {
    const c = e.target as Control;
    if (c.getAttribute('aria-invalid') === 'true') setError(c.name, messageFor(c));
  });

  const reset = () => {
    submit.disabled = false;
    label.textContent = idleLabel;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    let firstInvalid: Control | null = null;
    for (const c of controls()) {
      const message = messageFor(c);
      setError(c.name, message);
      if (message && !firstInvalid) firstInvalid = c;
    }
    if (firstInvalid) {
      status.textContent = errors.summary;
      firstInvalid.focus();
      return;
    }

    submit.disabled = true;
    label.textContent = form.dataset.sending ?? idleLabel;

    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (data.ok) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        return;
      }
      if (data.code === 'validation' && data.fields) {
        for (const [name, code] of Object.entries(data.fields as Record<string, string>)) setError(name, errors[code] ?? errors.required);
        status.textContent = errors.summary;
      } else {
        status.textContent = errors[data.code] ?? errors.server;
      }
    } catch {
      status.textContent = errors.network;
    }
    reset();
  });

  root.querySelector('[data-again]')!.addEventListener('click', () => {
    form.reset();
    preselect();
    serviceSelect.dispatchEvent(new Event('change'));
    stamp();
    reset();
    success.hidden = true;
    form.hidden = false;
  });
}
