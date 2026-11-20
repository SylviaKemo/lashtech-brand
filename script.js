const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
const animate = hasGsap && !reduceMotion;
if (animate) document.documentElement.classList.add('js-anim');

// ---------- Smooth scrolling (Lenis), synced with GSAP ----------
let lenis = null;
if (animate && typeof Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// In-page links go through Lenis so they glide instead of jumping
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

// ---------- Header: goes solid as soon as you start scrolling ----------
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Full-screen menu ----------
const toggle = document.getElementById('menuToggle');
const menu = document.getElementById('menu');
const setMenu = (open) => {
  document.body.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-hidden', !open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
};
toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// ---------- Scroll animations ----------
if (animate) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // 1. Hero shrinks into a rounded frame as you scroll away from it
  const frame = document.getElementById('heroFrame');
  gsap.set(frame, { clipPath: 'inset(0% 0% 0% 0% round 0px)' });
  gsap.timeline({
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '+=90%', pin: true, scrub: 0.6 },
  })
    .to(frame, { clipPath: 'inset(9% 5% 9% 5% round 28px)', ease: 'none' }, 0)
    .to('.hero-video', { scale: 1.12, ease: 'none' }, 0)
    .to('.hero-content', { yPercent: -40, scale: 0.85, opacity: 0, ease: 'power1.in' }, 0);

  // 6. Pink headings fill in line by line, left to right, as you scroll
  document.querySelectorAll('.display:not(.light)').forEach((h) => {
    h.classList.remove('reveal');
    const lines = h.innerHTML.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    h.innerHTML = lines.map((l) => `<span class="fill-line">${l}</span>`).join('');
    h.querySelectorAll('.fill-line').forEach((line) => {
      gsap.to(line, {
        backgroundPosition: '0% 0',
        ease: 'none',
        scrollTrigger: { trigger: line, start: 'top 88%', end: 'top 50%', scrub: true },
      });
    });
  });

  // 8. Story photo is uncovered bottom-to-top while zooming out inside the frame
  const media = document.querySelector('.story-media');
  gsap.timeline({ scrollTrigger: { trigger: media, start: 'top 80%' } })
    .fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut' })
    .fromTo(media.querySelector('img'), { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'power3.out' }, 0);

  // Images loading late can shift layout; recalculate trigger positions
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

// ---------- Studio drop-downs: smooth open/close, only one open at a time ----------
const accItems = [...document.querySelectorAll('.acc-item')];
const ACC_EASE = 'cubic-bezier(.2,.8,.2,1)';
const refreshTriggers = () => window.ScrollTrigger && ScrollTrigger.refresh();

const openItem = (d) => {
  const body = d.querySelector('.acc-body');
  d.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
  d.classList.remove('is-closing');
  d.open = true;
  if (reduceMotion) return refreshTriggers();
  const { paddingTop, paddingBottom } = getComputedStyle(body);
  const h = body.offsetHeight;
  body.animate(
    [
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 },
      { height: `${h}px`, paddingTop, paddingBottom, opacity: 1 },
    ],
    { duration: 550, easing: ACC_EASE }
  ).onfinish = refreshTriggers;
  // content drifts up slightly as it appears
  [...body.children].forEach((el, i) =>
    el.animate(
      [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 500, delay: 80 + i * 50, easing: ACC_EASE, fill: 'backwards' }
    )
  );
};

const closeItem = (d) => {
  if (!d.open) return;
  const body = d.querySelector('.acc-body');
  if (reduceMotion) { d.open = false; return refreshTriggers(); }
  d.classList.add('is-closing');
  const { paddingTop, paddingBottom } = getComputedStyle(body);
  const anim = body.animate(
    [
      { height: `${body.offsetHeight}px`, paddingTop, paddingBottom, opacity: 1 },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 },
    ],
    { duration: 450, easing: ACC_EASE }
  );
  anim.onfinish = () => { d.open = false; d.classList.remove('is-closing'); refreshTriggers(); };
};

accItems.forEach((d) => {
  d.querySelector('summary').addEventListener('click', (e) => {
    e.preventDefault();
    if (d.open && !d.classList.contains('is-closing')) return closeItem(d);
    accItems.forEach((o) => o !== d && closeItem(o));
    openItem(d);
  });
});

// ---------- Fade-up for everything else ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ---------- Index list: hovering a word swaps the preview image ----------
const preview = document.getElementById('indexImg');
const items = document.querySelectorAll('.index-list li');
items.forEach((li) => {
  li.addEventListener('mouseenter', () => {
    items.forEach((x) => x.classList.remove('active'));
    li.classList.add('active');
    const src = li.dataset.img;
    if (preview.getAttribute('src') === src) return;
    preview.classList.add('swap');
    setTimeout(() => { preview.src = src; preview.classList.remove('swap'); }, 250);
  });
});
items[0]?.classList.add('active');

// ---------- Portfolio carousel: auto-advances one tile at a time, loops ----------
const track = document.getElementById('track');
let index = 0;
const step = () => {
  const tiles = track.children;
  const perView = window.innerWidth <= 860 ? 1 : 3;
  const max = tiles.length - perView;
  index = index >= max ? 0 : index + 1;
  track.style.transform = `translateX(-${tiles[0].offsetWidth * index}px)`;
};
let timer = setInterval(step, 3000);
track.addEventListener('mouseenter', () => clearInterval(timer));
track.addEventListener('mouseleave', () => (timer = setInterval(step, 3000)));
window.addEventListener('resize', () => { index = -1; step(); });

document.getElementById('year').textContent = new Date().getFullYear();
