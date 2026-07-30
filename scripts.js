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
      const navH = document.querySelector('.navbar')?.offsetHeight || 0;
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

  document.querySelectorAll('.reveal, .section-header, .product-card, .care-item, .farewell-grid, .contact-grid, .hero-copy, .hero-figure').forEach(el => {
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
      const navH = document.querySelector('.navbar')?.offsetHeight || 0;
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
});
