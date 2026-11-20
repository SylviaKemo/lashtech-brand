// ============================================================
// Booking panel: collects a request and sends it to WhatsApp.
// The site has no server, so nothing is stored; the client
// sends the prefilled WhatsApp message and Shamim confirms there.
// ============================================================

// WhatsApp number in international format, digits only, no "+" or spaces.
// Example: '254712345678'. Leave empty to keep sending switched off.
const WHATSAPP_NUMBER = '254788918575';

const SERVICES = [
  { id: 'classic', name: 'Classic Set', price: 600 },
  { id: 'mid-volume', name: 'Mid Volume', price: 700 },
  { id: 'volume', name: 'Volume', price: 900 },
  { id: 'mega-volume', name: 'Mega Volume', price: 1200 },
  { id: 'strip', name: 'Custom Strip Lashes', price: null, wide: true },
];
const EXTRAS = [
  { id: 'charms', name: 'Lash Charms', price: 100 },
  { id: 'spikes', name: 'Glitter Spikes', price: 100 },
  { id: 'colour', name: 'Colour Add-On', price: 100 },
  { id: 'removal', name: 'Removal', price: 300 },
];
const LOCATIONS = [
  { id: 'cbd', name: 'Terry House', sub: 'Mfangano Street', full: 'Terry House, Mfangano Street' },
  { id: 'umoja', name: 'Umoja Springboard', sub: 'Umoja', full: 'Umoja Springboard' },
];
// Opening hours: Mon–Fri 10AM–5PM, Sat–Sun 11AM–5PM.
// Slots are on the hour; the last one starts at 4PM so a set finishes by 5PM.
const HOURS = { weekday: [10, 16], weekend: [11, 16] };
const DAYS_AHEAD = 21;
const MIN_NOTICE_MINUTES = 60; // today's slots need at least this much notice

const ksh = (n) => `KSh ${n.toLocaleString('en-KE')}`;
const fmtHour = (h) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const bk = {
  root: document.getElementById('booking'),
  panel: document.querySelector('.booking-panel'),
  scroll: document.querySelector('.booking-scroll'),
  form: document.getElementById('bookingForm'),
  services: document.getElementById('bkServices'),
  extrasStep: document.getElementById('bkExtrasStep'),
  extras: document.getElementById('bkExtras'),
  locations: document.getElementById('bkLocations'),
  dates: document.getElementById('bkDates'),
  times: document.getElementById('bkTimes'),
  name: document.getElementById('bkName'),
  notes: document.getElementById('bkNotes'),
  total: document.getElementById('bkTotal'),
  missing: document.getElementById('bkMissing'),
  send: document.getElementById('bkSend'),
  done: document.getElementById('bkDone'),
  reopen: document.getElementById('bkReopen'),
  progress: [...document.querySelectorAll('#bkProgress li')],
  panels: [...document.querySelectorAll('.bk-panel')],
  review: document.getElementById('bkReview'),
  back: document.getElementById('bkBack'),
  next: document.getElementById('bkNext'),
  fine: document.getElementById('bkFine'),
};
let step = 1;
let lastFocus = null;
let lastWhatsAppUrl = '';

// ---------- build the option chips ----------
const chip = ({ type, name, value, label, sub, extraClass = '' }) => `
  <label class="bk-chip ${extraClass}">
    <input type="${type}" name="${name}" value="${value}" />
    <span>${label}</span>${sub ? `<span class="bk-chip-sub">${sub}</span>` : ''}
  </label>`;

bk.services.innerHTML = SERVICES.map((s) => chip({
  type: 'radio', name: 'service', value: s.id, label: s.name,
  sub: s.price ? ksh(s.price) : 'Price on request', extraClass: s.wide ? 'bk-chip--wide' : '',
})).join('');

bk.extras.innerHTML = EXTRAS.map((x) => chip({
  type: 'checkbox', name: 'extras', value: x.id, label: x.name, sub: `+${ksh(x.price)}`,
})).join('');

bk.locations.innerHTML = LOCATIONS.map((l) => chip({
  type: 'radio', name: 'location', value: l.id, label: l.name, sub: l.sub, extraClass: 'bk-chip--stack',
})).join('');

const slotsFor = (date) => {
  const day = date.getDay();
  const [start, end] = day === 0 || day === 6 ? HOURS.weekend : HOURS.weekday;
  const slots = [];
  const cutoff = Date.now() + MIN_NOTICE_MINUTES * 60 * 1000;
  for (let h = start; h <= end; h++) {
    const t = new Date(date); t.setHours(h, 0, 0, 0);
    slots.push({ hour: h, open: t.getTime() >= cutoff });
  }
  return slots;
};

const buildDates = () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const html = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const anyOpen = slotsFor(d).some((s) => s.open);
    const dow = i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' });
    html.push(`
      <label class="bk-chip bk-date">
        <input type="radio" name="date" value="${isoDate(d)}" ${anyOpen ? '' : 'disabled'} />
        <span class="bk-dow">${dow}</span>
        <span class="bk-day">${d.getDate()}</span>
        <span class="bk-mon">${d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span>
      </label>`);
  }
  bk.dates.innerHTML = html.join('');
};

const buildTimes = () => {
  const iso = bk.form.date?.value;
  if (!iso) {
    bk.times.innerHTML = '<p class="bk-hint">Pick a date to see open times.</p>';
    return;
  }
  const prev = bk.form.time?.value;
  bk.times.innerHTML = slotsFor(fromIso(iso)).map((s) => `
    <label class="bk-chip bk-time">
      <input type="radio" name="time" value="${s.hour}" ${s.open ? '' : 'disabled'} ${String(s.hour) === prev && s.open ? 'checked' : ''} />
      <span>${fmtHour(s.hour)}</span>
    </label>`).join('');
};

// ---------- read the form ----------
const readForm = () => {
  const f = bk.form;
  const service = SERVICES.find((s) => s.id === f.service.value);
  const extras = service && service.id !== 'strip'
    ? [...f.querySelectorAll('input[name="extras"]:checked')].map((i) => EXTRAS.find((x) => x.id === i.value))
    : [];
  const location = LOCATIONS.find((l) => l.id === f.location.value);
  const dateIso = f.date?.value || '';
  const hour = f.time?.value ? Number(f.time.value) : null;
  return { service, extras, location, dateIso, hour, name: bk.name.value.trim(), notes: bk.notes.value.trim() };
};

const missingFields = (r) => [
  !r.service && 'service', !r.location && 'location', !r.dateIso && 'date',
  r.hour === null && 'time', !r.name && 'name',
].filter(Boolean);

// ---------- steps: 1 service + extras · 2 location · 3 date + time · 4 details ----------
const STEPS = {
  1: { needs: (r) => (r.service ? [] : ['a service']), hint: 'Choose a service to continue' },
  2: { needs: (r) => (r.location ? [] : ['a location']), hint: 'Choose a location to continue' },
  3: { needs: (r) => [!r.dateIso && 'a date', r.hour === null && 'a time'].filter(Boolean), hint: null },
  4: { needs: (r) => (r.name ? [] : ['your name']), hint: 'Add your name to send' },
};
const LAST_STEP = 4;
const stepDone = (n, r) => STEPS[n].needs(r).length === 0;
// a step can be opened if every step before it is complete
const canReach = (n, r) => [...Array(n - 1)].every((_, i) => stepDone(i + 1, r));

const fmtDateLong = (iso) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const renderReview = (r) => {
  const rows = [
    ['Service', r.service ? `${r.service.name}${r.service.price ? ` · ${ksh(r.service.price)}` : ''}` : '—', 1],
  ];
  if (r.extras.length) rows.push(['Extras', r.extras.map((x) => x.name).join(', '), 1]);
  rows.push(
    ['Location', r.location ? r.location.full : '—', 2],
    ['When', r.dateIso && r.hour !== null ? `${fmtDateLong(r.dateIso)}, ${fmtHour(r.hour)}` : '—', 3],
  );
  bk.review.innerHTML = rows.map(([label, value, s]) =>
    `<dt>${label}</dt><dd>${value}</dd><button type="button" data-goto="${s}">Edit</button>`).join('');
};

const showStep = (n, { focus = true } = {}) => {
  const forward = n >= step;
  step = n;
  bk.panels.forEach((p) => {
    const on = Number(p.dataset.step) === n;
    p.hidden = !on;
    p.classList.toggle('from-left', on && !forward);
  });
  bk.scroll.scrollTop = 0;
  update();
  if (focus) {
    const first = bk.panels[n - 1].querySelector('legend');
    first?.setAttribute('tabindex', '-1');
    first?.focus({ preventScroll: true });
  }
};

const update = () => {
  const r = readForm();
  // extras only apply to extension sets
  bk.extrasStep.hidden = r.service?.id === 'strip';

  if (!r.service) bk.total.textContent = '—';
  else if (r.service.price === null) bk.total.textContent = 'On request';
  else bk.total.textContent = ksh(r.service.price + r.extras.reduce((sum, x) => sum + x.price, 0));

  // progress bar
  bk.progress.forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle('is-current', n === step);
    li.classList.toggle('is-done', n < step || (n !== step && stepDone(n, r) && canReach(n, r)));
    li.querySelector('button').disabled = n === step || !canReach(n, r);
    li.querySelector('button').setAttribute('aria-current', n === step ? 'step' : 'false');
  });

  // buttons for this step
  const isLast = step === LAST_STEP;
  const needs = STEPS[step].needs(r);
  bk.back.hidden = step === 1;
  bk.next.hidden = isLast;
  bk.send.hidden = !isLast;
  bk.fine.hidden = !isLast;
  bk.next.disabled = needs.length > 0;
  if (isLast) {
    renderReview(r);
    bk.send.disabled = missingFields(r).length > 0 || !WHATSAPP_NUMBER;
  }

  if (needs.length) {
    bk.missing.textContent = STEPS[step].hint || `Choose ${needs.join(' and ')} to continue`;
  } else if (isLast && !WHATSAPP_NUMBER) {
    bk.missing.textContent = 'WhatsApp booking isn’t switched on yet. Please reach out on Instagram for now.';
  } else {
    bk.missing.textContent = '';
  }
};

const buildMessage = (r) => {
  const date = fromIso(r.dateIso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [
    'Hi Thee Shamim Effect! I’d like to book an appointment.',
    '',
    `• Service: ${r.service.name}${r.service.price ? ` (${ksh(r.service.price)})` : ''}`,
  ];
  if (r.extras.length) lines.push(`• Extras: ${r.extras.map((x) => x.name).join(', ')}`);
  lines.push(
    `• Location: ${r.location.full}`,
    `• Date: ${date}`,
    `• Time: ${fmtHour(r.hour)}`,
    `• Name: ${r.name}`,
  );
  if (r.notes) lines.push(`• Notes: ${r.notes}`);
  if (r.service.price) {
    lines.push('', `Estimated total: ${ksh(r.service.price + r.extras.reduce((s, x) => s + x.price, 0))}`);
  }
  return lines.join('\n');
};

// ---------- open / close ----------
const openBooking = ({ service, look } = {}) => {
  lastFocus = document.activeElement;
  buildDates();
  // keep earlier answers unless the date is no longer available
  if (service) {
    const input = bk.form.querySelector(`input[name="service"][value="${service}"]`);
    if (input) input.checked = true;
  }
  if (look && !bk.notes.value.includes(`look ${look}`)) {
    bk.notes.value = `I’d like the inspiration look ${look} from the gallery.${bk.notes.value ? `\n${bk.notes.value}` : ''}`;
  }
  buildTimes();
  showStep(1, { focus: false });
  bk.done.hidden = true;
  bk.panel.classList.remove('is-done');
  bk.root.classList.add('is-open');
  bk.root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (typeof lenis !== 'undefined' && lenis) lenis.stop();
  bk.scroll.scrollTop = 0;
  setTimeout(() => bk.panel.querySelector('.booking-close').focus(), 50);
};

const closeBooking = () => {
  bk.root.classList.remove('is-open');
  bk.root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (typeof lenis !== 'undefined' && lenis) lenis.start();
  lastFocus?.focus?.();
};

// every BOOK NOW / "Ask for this look" link opens the panel
document.querySelectorAll('a[href="#book"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.body.classList.contains('menu-open')) document.getElementById('menuToggle').click();
    openBooking({ service: a.dataset.service, look: a.dataset.look });
  });
});
bk.root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeBooking));
document.addEventListener('keydown', (e) => {
  if (!bk.root.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeBooking();
  // keep keyboard focus inside the panel
  if (e.key === 'Tab') {
    const focusable = [...bk.panel.querySelectorAll('button, input, textarea, a[href]')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

bk.form.addEventListener('change', (e) => {
  if (e.target.name === 'date') buildTimes();
  update();
});
bk.form.addEventListener('input', update);
bk.form.addEventListener('submit', (e) => e.preventDefault());

// step navigation
bk.next.addEventListener('click', () => {
  if (!stepDone(step, readForm())) return update();
  showStep(Math.min(LAST_STEP, step + 1));
});
bk.back.addEventListener('click', () => showStep(Math.max(1, step - 1)));
bk.progress.forEach((li) => li.querySelector('button').addEventListener('click', () => {
  const n = Number(li.dataset.step);
  if (n !== step && canReach(n, readForm())) showStep(n);
}));
bk.review.addEventListener('click', (e) => {
  const go = e.target.closest('[data-goto]');
  if (go) showStep(Number(go.dataset.goto));
});
// Enter in the name field moves on / sends instead of doing nothing
bk.name.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !bk.send.disabled) { e.preventDefault(); bk.send.click(); }
});

bk.send.addEventListener('click', () => {
  const r = readForm();
  if (missingFields(r).length || !WHATSAPP_NUMBER) return update();
  lastWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage(r))}`;
  window.open(lastWhatsAppUrl, '_blank', 'noopener');
  bk.done.hidden = false;
  bk.panel.classList.add('is-done');
  bk.reopen.focus();
});
bk.reopen.addEventListener('click', () => lastWhatsAppUrl && window.open(lastWhatsAppUrl, '_blank', 'noopener'));
