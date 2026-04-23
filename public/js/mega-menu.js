/**
 * Mega Menu Controller for PoloStew
 * Handles dynamic population and interaction of category mega menus
 */

class MegaMenu {
  constructor(catalogData) {
    this.catalog = catalogData;
    this.isMobile = window.innerWidth < 1024;
    this.init();
  }

  init() {
    this.populateAllMenus();
    this.attachMobileListeners();
    this.attachDesktopListeners();

    // Update on resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Populate mega menus for all categories
   */
  populateAllMenus() {
    Object.entries(this.catalog.categories).forEach(([slug, categoryData]) => {
      this.populateMenu(slug, categoryData);
    });
  }

  /**
   * Populate a single category mega menu
   */
  populateMenu(categorySlug, categoryData) {
    const menuWrapper = document.querySelector(`[data-category="${categorySlug}"] .mega-menu-wrapper`);
    if (!menuWrapper) {
      console.warn(`Mega menu wrapper not found for category: ${categorySlug}`);
      return;
    }

    // Find the container lists
    const brandsContainer = menuWrapper.querySelector(`#${categorySlug}-brands, .brands-list`);
    const typesContainer = menuWrapper.querySelector(`#${categorySlug}-types, .types-list`);
    const pricesContainer = menuWrapper.querySelector(`#${categorySlug}-prices, .prices-list`);
    const featuredContainer = menuWrapper.querySelector(`#${categorySlug}-featured, .featured-list`);

    // Populate brands
    if (brandsContainer) {
      brandsContainer.innerHTML = '';
      categoryData.brands.forEach(brand => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="/category.html?cat=${categorySlug}&brand=${encodeURIComponent(brand)}">${brand}</a>`;
        brandsContainer.appendChild(li);
      });
    }

    // Populate types
    if (typesContainer) {
      typesContainer.innerHTML = '';
      categoryData.types.forEach(type => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="/category.html?cat=${categorySlug}&type=${encodeURIComponent(type)}">${type}</a>`;
        typesContainer.appendChild(li);
      });
    }

    // Populate price ranges
    if (pricesContainer) {
      pricesContainer.innerHTML = '';
      categoryData.priceRanges.forEach(range => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="/category.html?cat=${categorySlug}&price=${encodeURIComponent(range)}">${range}</a>`;
        pricesContainer.appendChild(li);
      });
    }

    // Populate featured products
    if (featuredContainer && categoryData.featured) {
      featuredContainer.innerHTML = '';
      categoryData.featured.slice(0, 3).forEach(product => {
        const card = this.createFeaturedProductCard(product);
        featuredContainer.appendChild(card);
      });
    }
  }

  /**
   * Create a featured product card element
   */
  createFeaturedProductCard(product) {
    const card = document.createElement('a');
    card.className = 'featured-product-card';
    card.href = `/product.html?id=${product.id}`;
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}" class="featured-product-img" loading="lazy">
      <div class="featured-product-info">
        <div class="brand">${product.brand}</div>
        <h5>${product.name}</h5>
        <div class="price">$${product.price.toLocaleString()}</div>
      </div>
    `;
    return card;
  }

  /**
   * Attach mobile tap-to-expand listeners
   */
  attachMobileListeners() {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-links > li[data-category], .mobile-menu li[data-category]');

    mobileNavItems.forEach(item => {
      const toggle = item.querySelector('.mobile-nav-toggle');
      const megaMenu = item.querySelector('.mega-menu-wrapper');

      if (toggle && megaMenu) {
        toggle.addEventListener('click', (e) => {
          // Don't prevent default if clicking directly on the link
          if (e.target.tagName === 'A') {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          // Toggle this menu
          const isActive = toggle.classList.contains('active');

          // Close all other menus
          document.querySelectorAll('.mobile-nav-toggle.active').forEach(activeToggle => {
            if (activeToggle !== toggle) {
              activeToggle.classList.remove('active');
              activeToggle.nextElementSibling?.classList.remove('active');
            }
          });

          // Toggle current menu
          toggle.classList.toggle('active');
          megaMenu.classList.toggle('active');
        });
      }
    });
  }

  /**
   * Attach desktop hover listeners (with delay)
   */
  attachDesktopListeners() {
    const navItems = document.querySelectorAll('.nav-links > li[data-category]');

    navItems.forEach(item => {
      let showTimeout;
      let hideTimeout;

      item.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        showTimeout = setTimeout(() => {
          // Desktop hover is handled by CSS, but we can add analytics or other logic here
        }, 100);
      });

      item.addEventListener('mouseleave', () => {
        clearTimeout(showTimeout);
        hideTimeout = setTimeout(() => {
          // Menu hides automatically via CSS
        }, 200);
      });
    });
  }

  /**
   * Handle window resize
   */
  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 1024;

    // Re-attach listeners if switching between mobile/desktop
    if (wasMobile !== this.isMobile) {
      this.attachMobileListeners();
      this.attachDesktopListeners();
    }
  }
}

/**
 * Load catalog data and initialize mega menu
 */
async function initializeMegaMenu() {
  try {
    // Check if catalog data is cached in localStorage
    const cachedData = localStorage.getItem('polostew-catalog');
    const cacheTime = localStorage.getItem('polostew-catalog-time');
    const oneHour = 60 * 60 * 1000;

    let catalogData;

    if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime)) < oneHour) {
      // Use cached data
      catalogData = JSON.parse(cachedData);
      console.log('Loaded catalog from cache');
    } else {
      // Fetch fresh data
      const response = await fetch('/data/catalog.json');
      if (!response.ok) {
        throw new Error(`Failed to load catalog: ${response.statusText}`);
      }
      catalogData = await response.json();

      // Cache the data
      localStorage.setItem('polostew-catalog', JSON.stringify(catalogData));
      localStorage.setItem('polostew-catalog-time', Date.now().toString());
      console.log('Loaded catalog from server and cached');
    }

    // Initialize mega menu
    window.megaMenu = new MegaMenu(catalogData);

  } catch (error) {
    console.error('Error initializing mega menu:', error);

    // Show error state (optional)
    document.querySelectorAll('.mega-menu-wrapper').forEach(menu => {
      menu.innerHTML = '<div class="mega-menu-empty">Unable to load navigation. Please refresh the page.</div>';
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMegaMenu);
} else {
  initializeMegaMenu();
}

// Expose catalog data for other scripts
window.getCatalogData = async function() {
  const cached = localStorage.getItem('polostew-catalog');
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await fetch('/data/catalog.json');
  return await response.json();
};
