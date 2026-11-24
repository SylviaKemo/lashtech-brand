const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smooth scrolling (Lenis) and the GSAP scroll animations are loaded *after* the page
// has appeared (see "Start motion" at the bottom), so the first screen paints straight
// away. Until then lenis is null and in-page links use the browser's own smooth scroll.
let lenis = null;

// ---------- Hero: still + headline show immediately; video fades in once it plays ----------
// The video file is attached after the page has loaded so it doesn't compete with
// the fonts and headline for bandwidth on slow connections.
(() => {
  const video = document.querySelector('.hero-video');
  const show = () => video.classList.add('is-playing');
  const start = () => {
    video.querySelectorAll('source[data-src]').forEach((s) => { s.src = s.dataset.src; s.removeAttribute('data-src'); });
    video.addEventListener('playing', show, { once: true });
    video.autoplay = true;
    video.preload = 'auto';
    video.load();
    video.play?.().catch(() => {}); // autoplay blocked: the still image stays
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();

// In-page links (navbar, menu, buttons) glide to their section with Lenis.
// Menu links close the menu first: Lenis is paused while the menu is open,
// so the scroll is started after resuming it (force: true covers the same tick).
const HEADER_OFFSET = () => -(document.getElementById('header').offsetHeight - 1);
const scrollToSection = (target, { fromMenu = false } = {}) => {
  if (lenis) {
    lenis.start();
    lenis.scrollTo(target, {
      offset: target.id === 'top' ? 0 : HEADER_OFFSET(),
      duration: fromMenu ? 1.6 : 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      force: true,
    });
  } else {
    const y = target.getBoundingClientRect().top + window.scrollY + (target.id === 'top' ? 0 : HEADER_OFFSET());
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
};
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || id === '#book') return; // #book opens the booking panel (booking.js)
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const fromMenu = document.body.classList.contains('menu-open');
    if (fromMenu) setMenu(false);
    scrollToSection(target, { fromMenu });
    history.replaceState(null, '', id); // keep the address bar in sync without a jump
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
document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// ---------- Scroll animations (run once GSAP + ScrollTrigger + Lenis have loaded) ----------
function initMotion() {
  document.documentElement.classList.add('js-anim');
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    if (document.body.classList.contains('menu-open')) lenis.stop();
  }

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

  // My Work: once the photo row is fully on screen, the section holds in place and
  // scrolling down slides the row sideways through every photo. After the last one,
  // the page carries on to the next section. (Created before the triggers further
  // down the page so their positions account for the extra scroll distance.)
  const workRow = document.getElementById('carousel');
  const workTrack = document.getElementById('track');
  const workDistance = () => Math.max(0, workTrack.scrollWidth - workRow.clientWidth);
  workTrack.style.transition = 'none'; // the scroll drives it now, not the timed slide
  gsap.to(workTrack, {
    x: () => -workDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: workRow,
      pin: '#portfolio',
      start: 'bottom bottom-=24',
      end: () => `+=${workDistance()}`,
      scrub: 0.8,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });

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

  // the page has already loaded by now: measure everything once
  ScrollTrigger.refresh();
}

// ---------- Studio card photos load only when the section is near the screen ----------
(() => {
  const bgs = document.querySelectorAll('.cc-img[data-bg]');
  const load = (el) => { el.style.backgroundImage = `url('${el.dataset.bg}')`; el.removeAttribute('data-bg'); };
  if (!('IntersectionObserver' in window)) return bgs.forEach(load);
  const bgIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { load(e.target); bgIO.unobserve(e.target); }
  }), { rootMargin: '600px 0px' });
  bgs.forEach((el) => bgIO.observe(el));
})();

// ---------- Studio collapsing cards: one card open at a time ----------
// Desktop: hovering a card opens it. Phone: tapping it. Keyboard: focusing it (Tab).
const studioCards = [...document.querySelectorAll('#studioCards .cc-card')];
const openStudioCard = (card) => {
  studioCards.forEach((c) => {
    const on = c === card;
    c.classList.toggle('active', on);
    c.setAttribute('aria-expanded', on);
  });
};
const canHover = window.matchMedia('(hover: hover)').matches;
studioCards.forEach((card) => {
  if (canHover) card.addEventListener('mouseenter', () => openStudioCard(card));
  card.addEventListener('click', () => openStudioCard(card));
  card.addEventListener('focusin', () => openStudioCard(card));
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
// Only used when scroll animations are off (reduced motion, or the libraries failed
// to load); otherwise the scroll moves the row (see "My Work" in initMotion).
function startTimedCarousel() {
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
}

document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Start motion: load the animation libraries after the page has appeared ----------
const MOTION_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
];
const LENIS_LIB = 'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js';
const loadScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src; s.async = false; s.onload = resolve; s.onerror = reject;
  document.head.appendChild(s);
});
const startMotion = () => {
  if (reduceMotion) return startTimedCarousel();
  MOTION_LIBS.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve())
    .then(() => loadScript(LENIS_LIB).catch(() => {})) // smooth scrolling is optional
    .then(initMotion)
    .catch(startTimedCarousel);
};
const whenIdle = (fn) => ('requestIdleCallback' in window
  ? requestIdleCallback(fn, { timeout: 1500 })
  : setTimeout(fn, 200));
if (document.readyState === 'complete') whenIdle(startMotion);
else window.addEventListener('load', () => whenIdle(startMotion), { once: true });
