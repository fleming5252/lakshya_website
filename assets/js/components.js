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
  } catch (err) {
    console.error(`ERROR loading ${filePath}:`, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, starting component injection...');
  loadComponent('#navbar-placeholder', 'components/navbar.html');
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
});

let lastScroll = 0;

window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

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