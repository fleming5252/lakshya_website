async function loadComponent(selector, filePath) {
  console.log(`Attempting to load: ${filePath}`);
  try {
    const res = await fetch(filePath);
    console.log(`Response for ${filePath}: status=${res.status}, ok=${res.ok}`);
    if (!res.ok) throw new Error(`Failed to load ${filePath}`);
    const html = await res.text();
    console.log(`HTML received for ${filePath}, length=${html.length} chars`);
    console.log(`First 100 chars: ${html.substring(0, 100)}`);
    const target = document.querySelector(selector);
    console.log(`Target element for ${selector}:`, target);
    target.innerHTML = html;
    console.log(`Successfully injected ${filePath} into ${selector}`);

    if (selector === '#navbar-placeholder') {
      const page = window.location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
        if (link.getAttribute('href') === page) link.classList.add('active');
      });
    }

    if (selector === '#cta-banner-placeholder') {
      initCtaBannerReveal();
    }
    if (selector === '#footer-placeholder') {
      initFooterReveal();
    }
  } catch (err) {
    console.error(`ERROR loading ${filePath}:`, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, starting component injection...');
  loadComponent('#navbar-placeholder', 'components/navbar.html');
  loadComponent('#cta-banner-placeholder', 'components/cta-banner.html');
  loadComponent('#footer-placeholder', 'components/footer.html');

  // Toggle runs after navbar HTML is injected
  document.body.addEventListener('click', (e) => {
    const toggle = e.target.closest('.nav-toggle');
    if (toggle) {
      const navbar = document.querySelector('.navbar');
      navbar.classList.toggle('nav-open');
      document.body.classList.toggle('menu-open');
      return;
    }

    const navbar = document.querySelector('.navbar');
    if (navbar?.classList.contains('nav-open')) {
      const isClickInside = e.target.closest('.navbar');
      if (!isClickInside) {
        navbar.classList.remove('nav-open');
        document.body.classList.remove('menu-open');
      }
    }
  });

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-mobile a');
    if (!link) return;

    document.querySelector('.navbar')?.classList.remove('nav-open');
    document.body.classList.remove('menu-open');
  });

  initCtaBannerReveal();
});

/* Scroll-reveal for the CTA banner — runs right after the component is injected
   (and again on DOMContentLoaded) so GSAP always finds it, on every page. */
function initCtaBannerReveal() {
  const banner = document.querySelector('.cta-banner');
  if (!banner || banner.dataset.reveal) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  banner.dataset.reveal = '1';

  const bgImg = banner.querySelectorAll('.cta-banner-bg img, .cta-banner-mobile-img img');
  const rule = banner.querySelector('.cta-banner-rule');
  const headline = banner.querySelector('.cta-banner-headline');
  const desc = banner.querySelector('.cta-banner-desc');
  const buttons = banner.querySelectorAll('.cta-banner-actions .cta-banner-btn');

  gsap.timeline({
    scrollTrigger: { trigger: banner, start: 'top 80%', toggleActions: 'play none none reverse' }
  })
    .fromTo(banner,
      { opacity: 0, y: 40, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', clearProps: 'transform' })
    .fromTo(bgImg,
      { scale: 1.12 },
      { scale: 1, duration: 1.6, ease: 'power2.out' }, '-=0.5')
    .fromTo(rule,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=1.1')
    .fromTo(headline,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out' }, '-=0.35')
    .fromTo(desc,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out' }, '-=0.6')
    .fromTo(buttons,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.12 }, '-=0.6');

  ScrollTrigger.refresh();
}
function initFooterReveal() {
  const footer = document.querySelector('.footer');
  if (!footer || footer.dataset.reveal) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  footer.dataset.reveal = '1';

  /* ── CTA headline — slides DOWN from above ── */
  const ctaText = footer.querySelector('.footer-cta-text');
  if (ctaText) {
    gsap.fromTo(ctaText,
      { opacity: 0, y: -50 },
      {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: {
          trigger: ctaText,
          start: 'top 90%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }

  /* ── Follow label — fades up before icons ── */
  const followLabel = footer.querySelector('.follow-label');
  if (followLabel) {
    gsap.fromTo(followLabel,
      { opacity: 0, y: 20 },
      {
        opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
        scrollTrigger: {
          trigger: followLabel,
          start: 'top 90%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }

  /* ── Social icons — staggered slide UP, stagger 0.2 ── */
  const socialLinks = footer.querySelectorAll('.footer-socials a');
  if (socialLinks.length) {
    gsap.fromTo(socialLinks,
      { opacity: 0, y: 30 },
      {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
        stagger: 0.2,
        scrollTrigger: {
          trigger: footer.querySelector('.footer-socials-wrap'),
          start: 'top 90%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }

  /* ── Logo — slides UP ── */
  const logo = footer.querySelector('.footer-brand .nav-logo');
  if (logo) {
    gsap.fromTo(logo,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: {
          trigger: footer.querySelector('.footer-brand'),
          start: 'top 88%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }

  /* ── Brand description — slides UP, slight delay after logo ── */
  const brandDesc = footer.querySelector('.footer-brand p');
  if (brandDesc) {
    gsap.fromTo(brandDesc,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.2,
        scrollTrigger: {
          trigger: footer.querySelector('.footer-brand'),
          start: 'top 88%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }

  /* ── Quick Links — heading + underline + items slide RIGHT to LEFT, stagger 0.2 ── */
  const quickLinksCol = footer.querySelector('.footer-col:not(.footer-contact)');
  if (quickLinksCol) {
    const heading   = quickLinksCol.querySelector('h4');
    const underline = quickLinksCol.querySelector('.col-underline');

    if (heading) {
      gsap.fromTo(heading,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.6, ease: 'power3.out',
          scrollTrigger: {
            trigger: quickLinksCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
    if (underline) {
      gsap.fromTo(underline,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.1,
          scrollTrigger: {
            trigger: quickLinksCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    const linkItems = quickLinksCol.querySelectorAll('li');
    if (linkItems.length) {
      gsap.fromTo(linkItems,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.5, ease: 'power3.out',
          stagger: 0.2,
          delay: 0.15,
          scrollTrigger: {
            trigger: quickLinksCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
  }

  /* ── Contact Us — heading + underline + rows slide RIGHT to LEFT, stagger 0.2 ── */
  const contactCol = footer.querySelector('.footer-contact');
  if (contactCol) {
    const heading   = contactCol.querySelector('h4');
    const underline = contactCol.querySelector('.col-underline');

    if (heading) {
      gsap.fromTo(heading,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.6, ease: 'power3.out',
          scrollTrigger: {
            trigger: contactCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
    if (underline) {
      gsap.fromTo(underline,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.1,
          scrollTrigger: {
            trigger: contactCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    const contactRows = contactCol.querySelectorAll('.contact-row');
    if (contactRows.length) {
      gsap.fromTo(contactRows,
        { opacity: 0, x: 80 },
        {
          opacity: 1, x: 0, duration: 0.5, ease: 'power3.out',
          stagger: 0.2,
          delay: 0.15,
          scrollTrigger: {
            trigger: contactCol,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
  }

  /* ── Bottom bar — simple fade in ── */
  const footerBottom = footer.querySelector('.footer-bottom');
  if (footerBottom) {
    gsap.fromTo(footerBottom,
      { opacity: 0 },
      {
        opacity: 1, duration: 0.8, ease: 'power2.out',
        scrollTrigger: {
          trigger: footerBottom,
          start: 'top 98%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }
  ScrollTrigger.refresh();
}

let lastScroll = 0;

window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  if (navbar.dataset.locked) return; /* skip during programmatic scroll */

  const currentScroll = window.scrollY;

  if (currentScroll <= 0) {
    navbar.classList.remove('nav-hidden');
    return;
  }

  if (currentScroll > lastScroll) {
    navbar.classList.add('nav-hidden');
  } else {
    navbar.classList.remove('nav-hidden');
  }

  lastScroll = currentScroll;
});

/* Mobile-only hero parallax — replicates the desktop fixed-background effect
   (image stays frozen, text drifts up and fades as you scroll) */
(function () {
  const hero = document.querySelector('.about-hero');
  const content = document.querySelector('.about-hero-content');
  if (!hero || !content) return;

  let heroH = hero.offsetHeight;

  function onScroll() {
    if (window.innerWidth > 768) return;
    const scrollY = window.scrollY;
    if (scrollY > heroH) return;
    const progress = scrollY / heroH;
    content.style.transform = `translateY(${-scrollY * 0.55}px)`;
    content.style.opacity = `${1 - progress * 2}`;
  }

  function onResize() {
    heroH = hero.offsetHeight;
    if (window.innerWidth > 768) {
      content.style.transform = '';
      content.style.opacity = '';
    }
    onScroll();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();
})();