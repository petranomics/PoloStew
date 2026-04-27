/**
 * Product Management Client
 * Handles product data loading and display for single-item vintage model
 * Each product is one-of-a-kind: single size, condition, era, stock of 1
 */

class ProductManager {
  constructor() {
    this.products = [];
    this.init();
  }

  async init() {
    await this.loadProducts();
  }

  // Load products from API
  async loadProducts() {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (data.products) {
        this.products = data.products;
        this.renderProductsGrid();
        this.updateProductCards();
      }
    } catch (error) {
      console.error('Error loading products:', error);
      const grid = document.querySelector('[data-products-grid]');
      if (grid) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#999;">Couldn\'t load products. Please refresh.</div>';
      }
    }
  }

  // Render product cards into any container marked [data-products-grid]
  renderProductsGrid() {
    const grids = document.querySelectorAll('[data-products-grid]');
    if (grids.length === 0) return;

    if (this.products.length === 0) {
      grids.forEach(grid => {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#999;">No products yet. Add some from the admin.</div>';
      });
      return;
    }

    const html = this.products.map(p => this.buildCardHTML(p)).join('');
    grids.forEach(grid => { grid.innerHTML = html; });
  }

  buildCardHTML(p) {
    const img = (p.images && p.images[0])
      ? p.images[0]
      : 'https://placehold.co/400x500/f0e6d3/2c2418?text=PoloStew';
    let badge = '';
    if (p.onSale) {
      badge = '<span class="product-badge sale-badge" style="background:#e53935;">SALE</span>';
    } else if (p.featured) {
      badge = '<span class="product-badge">Featured</span>';
    }
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return (
      '<div class="product-card" data-product-id="' + esc(p.id) + '" ' +
      'onclick="window.location.href=\'product?id=\' + this.dataset.productId">' +
        '<div class="product-image-container">' +
          '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" class="product-image" />' +
          badge +
          '<button class="wishlist-btn" onclick="event.stopPropagation(); toggleWishlist(this)">&#9825;</button>' +
        '</div>' +
        '<div class="product-info">' +
          '<p class="product-brand">' + esc(p.brand) + (p.era ? ' / ' + esc(p.era) : '') + '</p>' +
          '<h3 class="product-name">' + esc(p.name) + '</h3>' +
          '<p class="product-price">$' + (p.basePrice || 0) + '</p>' +
          '<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(this)">Add to Cart</button>' +
        '</div>' +
      '</div>'
    );
  }

  // Get product by ID
  getProduct(productId) {
    return this.products.find(p => p.id === productId);
  }

  // Check if a product is sold (stock is 0)
  isSold(product) {
    return product.stock === 0;
  }

  // Update product cards with vintage badges and sold overlays
  updateProductCards() {
    const productCards = document.querySelectorAll('.product-card[data-product-id]');

    productCards.forEach(card => {
      const productId = card.dataset.productId;
      const product = this.getProduct(productId);

      if (!product) return;

      // Add image gallery if product has multiple images
      if (product.images && product.images.length > 1) {
        this.addImageGallery(card, product);
      }

      const productInfo = card.querySelector('.product-info');
      const priceElement = card.querySelector('.product-price');
      const addToCartBtn = card.querySelector('.add-to-cart-btn');

      if (!productInfo || !priceElement) return;

      // Remove any existing size selector (legacy cleanup)
      const existingSelector = productInfo.querySelector('.size-selector');
      if (existingSelector) existingSelector.remove();

      // Remove any existing vintage badges (avoid duplicates on re-render)
      const existingBadges = productInfo.querySelector('.vintage-badges');
      if (existingBadges) existingBadges.remove();

      // Add vintage info badges (size, condition, era)
      const badgesContainer = this.createVintageBadges(product);
      priceElement.insertAdjacentElement('afterend', badgesContainer);

      // Update price display to use basePrice
      this.updatePriceDisplay(card, product);

      // Add sold overlay if stock is 0
      if (this.isSold(product)) {
        this.addSoldOverlay(card);
        if (addToCartBtn) {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'SOLD';
          addToCartBtn.style.opacity = '0.5';
          addToCartBtn.style.cursor = 'not-allowed';
        }
      }
    });
  }

  // Add image gallery to product card
  addImageGallery(card, product) {
    const imageContainer = card.querySelector('.product-image-container');
    if (!imageContainer) return;

    const mainImage = imageContainer.querySelector('.product-image');
    if (!mainImage) return;

    // Set first image as main
    mainImage.src = product.images[0];

    // Create thumbnail navigation if multiple images
    if (product.images.length > 1) {
      const existingNav = imageContainer.querySelector('.image-nav');
      if (existingNav) existingNav.remove();

      const nav = document.createElement('div');
      nav.className = 'image-nav';

      product.images.forEach((img, index) => {
        const dot = document.createElement('button');
        dot.className = 'image-dot';
        if (index === 0) dot.classList.add('active');
        dot.onclick = (e) => {
          e.stopPropagation();
          mainImage.src = img;
          nav.querySelectorAll('.image-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        };
        nav.appendChild(dot);
      });

      imageContainer.appendChild(nav);
    }
  }

  // Create vintage info badges (size, condition, era)
  createVintageBadges(product) {
    const container = document.createElement('div');
    container.className = 'vintage-badges';
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;';

    const badges = [];

    if (product.size) {
      badges.push({ label: product.size, type: 'size' });
    }
    if (product.condition) {
      badges.push({ label: product.condition, type: 'condition' });
    }
    if (product.era) {
      badges.push({ label: product.era, type: 'era' });
    }

    badges.forEach(badge => {
      const span = document.createElement('span');
      span.className = `vintage-badge vintage-badge--${badge.type}`;
      span.textContent = badge.label;
      span.style.cssText = `
        display: inline-block;
        padding: 0.2rem 0.6rem;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: 3px;
        font-weight: 500;
        border: 1px solid;
      `;

      if (badge.type === 'size') {
        span.style.borderColor = '#c75d3a';
        span.style.color = '#c75d3a';
      } else if (badge.type === 'condition') {
        span.style.borderColor = '#4a7c59';
        span.style.color = '#4a7c59';
      } else if (badge.type === 'era') {
        span.style.borderColor = '#6b5b95';
        span.style.color = '#6b5b95';
      }

      container.appendChild(span);
    });

    return container;
  }

  // Update price display using basePrice (no size variant pricing)
  updatePriceDisplay(card, product) {
    const priceElement = card.querySelector('.product-price');
    if (!priceElement) return;

    if (product.salePrice) {
      const discount = Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100);
      priceElement.innerHTML = `
        <span style="text-decoration: line-through; color: #999; margin-right: 0.5rem;">$${product.basePrice}</span>
        <span style="color: #e53935; font-weight: 600;">$${product.salePrice}</span>
        <span style="background: #e53935; color: white; padding: 0.15rem 0.5rem; font-size: 0.7rem; border-radius: 3px; margin-left: 0.5rem;">${discount}% OFF</span>
      `;
    } else {
      priceElement.textContent = `$${product.basePrice.toLocaleString()}`;
    }
  }

  // Add sold overlay to product card
  addSoldOverlay(card) {
    const imageContainer = card.querySelector('.product-image-container');
    if (!imageContainer) return;

    // Avoid duplicate overlays
    if (imageContainer.querySelector('.sold-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'sold-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3;
    `;

    const badge = document.createElement('span');
    badge.textContent = 'SOLD';
    badge.style.cssText = `
      background: #e53935;
      color: white;
      padding: 0.6rem 2rem;
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      border-radius: 4px;
      transform: rotate(-15deg);
    `;

    overlay.appendChild(badge);
    imageContainer.appendChild(overlay);
  }

  // Check if item is available (stock > 0)
  async checkAvailability(productId) {
    try {
      const response = await fetch(`/api/inventory/check?productId=${productId}`);
      const data = await response.json();
      return data.inStock && data.stock > 0;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }
}

// Initialize product manager
window.productManager = new ProductManager();

// Enhanced add to cart function for single-item vintage model
window.addToCart = function(button) {
  const productCard = button.closest('.product-card');
  const productId = productCard.dataset.productId;

  // Get product details
  const product = window.productManager.getProduct(productId);

  if (!product) {
    console.error('Product not found:', productId);
    return;
  }

  // Check if sold
  if (window.productManager.isSold(product)) {
    alert('This item has been sold');
    return;
  }

  // Check if already in cart (single item, no duplicates)
  const existingItems = window.cart.items || [];
  if (existingItems.some(item => item.id === productId)) {
    alert('This one-of-a-kind item is already in your cart');
    return;
  }

  // Use sale price if available
  const price = product.salePrice || product.basePrice;

  const cartItem = {
    id: productId,
    name: product.name,
    brand: product.brand,
    price: price,
    originalPrice: product.basePrice,
    salePrice: product.salePrice || null,
    image: product.images ? product.images[0] : product.image,
    size: product.size || 'One Size',
    condition: product.condition || '',
    era: product.era || '',
    quantity: 1
  };

  window.cart.addToCart(cartItem);
};
