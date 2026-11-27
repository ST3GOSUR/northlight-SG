// Navigation helpers first (they always run), then decoration (only if the visitor allows motion).
// The site works without any of this: every link is a normal link.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = document.querySelector('.bar');
  const mast = document.querySelector('.mast');
  const totop = document.querySelector('.totop');

  // Links that point at a section of this page ("Jump to" row, and the home page's second bar row)
  const spyLinks = [...document.querySelectorAll('.bar-page a[href^="#"], .jump a[href^="#"]')];
  const targets = spyLinks.map((a) => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) })).filter((t) => t.el);

  function onScroll() {
    const y = window.scrollY;
    if (bar && mast) bar.classList.toggle('is-stuck', y > mast.offsetHeight - 2);
    if (totop) totop.classList.toggle('show', y > 500);

    // The section being read: the last one whose top has passed a line a little below the sticky bar
    const line = (bar ? bar.offsetHeight : 0) + 40;
    let current = null;
    for (const t of targets) if (t.el.getBoundingClientRect().top <= line) current = t.a;
    for (const t of targets) {
      if (t.a === current) t.a.setAttribute('aria-current', 'location'); else t.a.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // On phones the bar scrolls sideways: open it at the current page
  const here = document.querySelector('.bar-main a[aria-current="page"]');
  const row = document.querySelector('.bar-main');
  if (here && row && row.scrollWidth > row.clientWidth) row.scrollLeft = here.offsetLeft - (row.clientWidth - here.offsetWidth) / 2;

  if (reduce) return;
  document.documentElement.classList.add('motion-ok');

  // Sections settle in as they arrive; plates are "dealt" onto the page
  const sections = document.querySelectorAll('.sec');
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('in-view'); seen.unobserve(entry.target); }
    }, { threshold: 0.12 });
    sections.forEach((el) => seen.observe(el));
  } else {
    sections.forEach((el) => el.classList.add('in-view'));
  }

  // The pinned map tilts toward the pointer (a custom property set from script is allowed by the policy)
  const spread = document.querySelector('.spread');
  const pin = document.querySelector('.pin');
  if (spread && pin) {
    spread.addEventListener('pointermove', (e) => {
      const box = pin.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / 420));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / 320));
      pin.style.setProperty('--ry', (dx * 9).toFixed(2) + 'deg');
      pin.style.setProperty('--rx', (-dy * 7).toFixed(2) + 'deg');
    });
    spread.addEventListener('pointerleave', () => { pin.style.setProperty('--ry', '0deg'); pin.style.setProperty('--rx', '0deg'); });
  }
})();
