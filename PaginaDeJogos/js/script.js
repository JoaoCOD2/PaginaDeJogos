 const heroText = 'CYBER ARCADE_';
    const heroTarget = document.getElementById('heroText');
    const clockElement = document.getElementById('clock');
    const playerCountElement = document.getElementById('playerCount');
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerClose = document.querySelector('.mobile-drawer__close');

    function typeTitle(text, target, delay = 90) {
      let index = 0;
      const interval = setInterval(() => {
        target.textContent = text.slice(0, index + 1);
        index += 1;
        if (index >= text.length) {
          clearInterval(interval);
        }
      }, delay);
    }

    function updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    function animatePlayers() {
      const targetValue = 1248;
      let current = 0;
      const step = Math.ceil(targetValue / 60);
      const interval = setInterval(() => {
        current += step;
        if (current >= targetValue) {
          current = targetValue;
          clearInterval(interval);
        }
        playerCountElement.textContent = current.toLocaleString('pt-BR');
      }, 30);
    }

    function toggleDrawer(open) {
      mobileDrawer.classList.toggle('open', open);
      mobileDrawer.setAttribute('aria-hidden', String(!open));
    }

    function createParticles() {
      const field = document.getElementById('particleField');
      const colors = ['var(--neon-cyan)', 'var(--neon-pink)', 'var(--neon-purple)'];
      for (let i = 0; i < 40; i += 1) {
        const particle = document.createElement('span');
        particle.className = 'particle';
        const size = 2 + Math.random() * 3;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.top = `${top}%`;
        particle.style.background = color;
        particle.style.animationDuration = `${8 + Math.random() * 6}s`;
        particle.style.opacity = String(0.5 + Math.random() * 0.5);
        field.appendChild(particle);
      }
    }

    function revealOnScroll() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });

      document.querySelectorAll('[data-reveal]').forEach((section) => {
        observer.observe(section);
      });

      document.querySelectorAll('.leaderboard__item').forEach((item) => {
        observer.observe(item);
      });
    }

    document.addEventListener('DOMContentLoaded', () => {
      typeTitle(heroText, heroTarget, 90);
      updateClock();
      setInterval(updateClock, 1000);
      animatePlayers();
      createParticles();
      revealOnScroll();
    });

    mobileToggle.addEventListener('click', () => toggleDrawer(true));
    drawerClose.addEventListener('click', () => toggleDrawer(false));
    mobileDrawer.addEventListener('click', (event) => {
      if (event.target === mobileDrawer) toggleDrawer(false);
    });