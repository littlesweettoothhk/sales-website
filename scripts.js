document.addEventListener('DOMContentLoaded', function() {
  // Back to top. The threshold has to scale with the page: a product page only
  // scrolls ~300px on a desktop viewport, so a flat 400px never triggered there.
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    const toggle = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll < 200) { backToTop.classList.remove('active'); return; }
      const threshold = Math.min(400, Math.max(120, maxScroll * 0.4));
      backToTop.classList.toggle('active', window.scrollY > threshold);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    window.addEventListener('resize', toggle);
    toggle();

    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Smooth nav scroll + active state
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      const id = this.getAttribute('href');
      if (!id || id === '#') return;
      const tgt = document.querySelector(id);
      if (!tgt) return;
      e.preventDefault();
      const navH = document.querySelector('.topbar')?.offsetHeight || 0;
      window.scrollTo({ top: tgt.offsetTop - navH - 10, behavior: 'smooth' });
      if (this.classList.contains('nav-link')) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Navbar shadow on scroll
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    });
  }

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .section-header, .menu-section-head, .product-card, .how-step, .care-card, .farewell-grid, .contact-grid, .hero-copy, .hero-figure, .pp-hero, .pp-info-col, .faq-item').forEach(el => {
    el.classList.add('reveal');
    io.observe(el);
  });

  // Scroll-spy for nav — derive the section list from the nav itself so the
  // two can never drift apart again.
  const spyLinks = [...document.querySelectorAll('.nav-link[href^="#"]')];
  const sections = spyLinks
    .map(l => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  if (sections.length) {
    const setActive = () => {
      const navH = document.querySelector('.topbar')?.offsetHeight || 0;
      const line = window.scrollY + navH + 20;
      // Last section whose top has passed the nav line; falls back to the first.
      let current = sections[0];
      sections.forEach(s => { if (s.offsetTop <= line) current = s; });
      // At the very bottom, highlight the final section even if it's short.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = sections[sections.length - 1];
      }
      spyLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === '#' + current.id);
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    window.addEventListener('resize', setActive);
    setActive();
  }

  // Nav is horizontally scrollable on phones: show a fade while more tabs
  // remain, and keep the active tab in view as the page scrolls.
  const navBar = document.querySelector('.navbar');
  const navBox = document.querySelector('.nav-container');
  if (navBar && navBox) {
    const fade = () => {
      const more = navBox.scrollWidth - navBox.clientWidth - navBox.scrollLeft > 4;
      navBar.classList.toggle('can-scroll', more);
    };
    navBox.addEventListener('scroll', fade, { passive: true });
    window.addEventListener('resize', fade);
    fade();

    let lastActive = null;
    const keepVisible = () => {
      const a = navBox.querySelector('.nav-link.active');
      if (!a || a === lastActive) return;
      lastActive = a;
      if (navBox.scrollWidth <= navBox.clientWidth) return;
      const target = a.offsetLeft - (navBox.clientWidth - a.offsetWidth) / 2;
      navBox.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    };
    window.addEventListener('scroll', keepVisible, { passive: true });
  }

  // ── scroll progress rail ────────────────────────────────────────────────
  const rail = document.querySelector('.scroll-rail span');
  if (rail) {
    const draw = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      rail.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
    draw();
  }

  // ── hero parallax: the photo drifts slower than the headline ────────────
  const heroFig = document.querySelector('.hero-figure');
  if (heroFig && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let ticking = false;
    const drift = () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.4) {
        heroFig.style.transform = 'translate3d(0,' + (y * 0.09).toFixed(1) + 'px,0)';
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(drift); }
    }, { passive: true });
  }

  // Header height drives anchor offsets and the sticky product image.
  const topbarEl = document.querySelector('.topbar');
  if (topbarEl) {
    const setH = () => document.documentElement.style.setProperty(
      '--topbar-h', topbarEl.offsetHeight + 'px');
    setH();
    window.addEventListener('resize', setH);
    if (window.ResizeObserver) new ResizeObserver(setH).observe(topbarEl);
  }
});
