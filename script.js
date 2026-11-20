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

// ---------- Loading screen → hero video → headline ----------
// The loader stays up until the hero video is actually playing (or MAX_WAIT passes,
// e.g. on a slow connection or when the phone blocks autoplay). Then it fades out
// and the headline rises in a moment later, over a video that's already moving.
(() => {
  const MAX_WAIT = 4000;   // never keep visitors waiting longer than this
  const TEXT_DELAY = 600;  // pause between the loader fading and the headline rising
  const hero = document.getElementById('hero');
  const video = hero.querySelector('.hero-video');
  const loader = document.getElementById('loader');
  const bar = document.getElementById('loaderBar');
  let done = false;

  const lockScroll = (on) => {
    document.documentElement.style.overflow = on ? 'hidden' : '';
    if (lenis) on ? lenis.stop() : lenis.start();
  };
  const setProgress = (p) => { bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`; };

  const finish = () => {
    if (done) return;
    done = true;
    setProgress(1);
    setTimeout(() => {
      loader.classList.add('is-done');
      lockScroll(false);
      setTimeout(() => hero.classList.add('is-ready'), TEXT_DELAY);
    }, 250);
  };

  const onPlaying = () => { video.classList.add('is-playing'); finish(); };

  // Skip the empty opening of the clip: play from HERO_START (just before the hand
  // comes in) and loop back to it instead of to 0. The file itself is unchanged.
  const HERO_START = 1.8;
  const toStart = () => { if (video.currentTime < HERO_START) video.currentTime = HERO_START; };
  video.addEventListener('loadedmetadata', toStart);
  if (video.readyState >= 1) toStart();
  video.addEventListener('timeupdate', () => {
    if (video.duration && video.currentTime >= video.duration - 0.12) video.currentTime = HERO_START;
  });
  video.addEventListener('ended', () => { video.currentTime = HERO_START; video.play().catch(() => {}); });

  lockScroll(true);
  setProgress(0.15);
  video.addEventListener('playing', onPlaying, { once: true });
  video.addEventListener('progress', () => {
    if (video.duration && video.buffered.length) {
      setProgress(0.15 + 0.85 * (video.buffered.end(video.buffered.length - 1) / video.duration));
    }
  });
  video.addEventListener('error', finish);
  // already playing from cache before this script ran
  if (!video.paused && video.readyState >= 3) onPlaying();
  else video.play?.().catch(() => {}); // autoplay blocked → the timeout below shows the poster instead
  setTimeout(finish, MAX_WAIT);
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
