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
  const MAX_WAIT = 2500;   // never keep visitors waiting longer than this
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

  // Images loading late can shift layout; recalculate trigger positions
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

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
// Only used when scroll animations are off (reduced motion / GSAP unavailable);
// otherwise the scroll moves the row (see "My Work" above).
if (!animate) {
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
