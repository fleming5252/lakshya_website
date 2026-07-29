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
});

let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;

  if (currentScroll <= 0) {
    document.querySelector('.navbar').classList.remove('nav-hidden');
    return;
  }

  if (currentScroll > lastScroll) {
    // Scrolling down — hide
    document.querySelector('.navbar').classList.add('nav-hidden');
  } else {
    // Scrolling up — show
    document.querySelector('.navbar').classList.remove('nav-hidden');
  }

  lastScroll = currentScroll;
});