/**
 * Product Management Client
 * Handles product data loading, size selection, and inventory checks
 */

class ProductManager {
  constructor() {
    this.products = [];
    this.selectedSizes = {}; // Track selected size per product
    this.init();
  }

  async init() {
    await this.loadProducts();
    this.attachSizeSelectors();
  }

  // Load products from API
  async loadProducts() {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (data.products) {
        this.products = data.products;
        this.updateProductCards();
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  // Get product by ID
  getProduct(productId) {
    return this.products.find(p => p.id === productId);
  }

  // Get selected size for a product
  getSelectedSize(productId) {
    return this.selectedSizes[productId];
  }

  // Set selected size for a product
  setSelectedSize(productId, sizeData) {
    this.selectedSizes[productId] = sizeData;
  }

  // Update product cards with size selectors and image galleries
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

      // Create size selector
      const productInfo = card.querySelector('.product-info');
      const priceElement = card.querySelector('.product-price');
      const addToCartBtn = card.querySelector('.add-to-cart-btn');

      if (!productInfo || !priceElement || !addToCartBtn) return;

      // Remove existing size selector if any
      const existingSelector = productInfo.querySelector('.size-selector');
      if (existingSelector) existingSelector.remove();

      // Only add size selector if product has multiple sizes or is clothing
      if (product.sizes.length > 1 || this.isClothing(product.category)) {
        const sizeSelector = this.createSizeSelector(product);
        priceElement.insertAdjacentElement('afterend', sizeSelector);

        // Set default size
        if (product.sizes.length > 0) {
          this.setSelectedSize(productId, product.sizes[0]);
        }
      } else {
        // Single size - auto-select it
        this.setSelectedSize(productId, product.sizes[0]);
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

  // Check if category is clothing
  isClothing(category) {
    return ['streetwear'].includes(category);
  }

  // Create size selector UI
  createSizeSelector(product) {
    const container = document.createElement('div');
    container.className = 'size-selector';

    if (this.isClothing(product.category)) {
      // Button-style size selector for clothing
      product.sizes.forEach((sizeData, index) => {
        const button = document.createElement('button');
        button.className = 'size-btn';
        button.textContent = sizeData.size;
        button.dataset.size = sizeData.size;
        button.dataset.sku = sizeData.sku;
        button.dataset.price = sizeData.price;
        button.dataset.stock = sizeData.stock;

        if (index === 0) button.classList.add('selected');
        if (sizeData.stock === 0) {
          button.classList.add('out-of-stock');
          button.disabled = true;
        }

        button.onclick = (e) => {
          e.stopPropagation();
          this.selectSize(product.id, sizeData, button);
        };

        container.appendChild(button);
      });
    } else {
      // Dropdown for other products (skincare, fragrance)
      const select = document.createElement('select');
      select.className = 'size-dropdown';

      product.sizes.forEach((sizeData, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${sizeData.size} - $${sizeData.price}`;
        option.dataset.sku = sizeData.sku;
        option.dataset.price = sizeData.price;
        option.dataset.stock = sizeData.stock;

        if (sizeData.stock === 0) {
          option.textContent += ' (Out of Stock)';
          option.disabled = true;
        }

        select.appendChild(option);
      });

      select.onchange = (e) => {
        e.stopPropagation();
        const index = e.target.value;
        this.selectSize(product.id, product.sizes[index], null);
      };

      container.appendChild(select);
    }

    return container;
  }

  // Handle size selection
  selectSize(productId, sizeData, button) {
    this.setSelectedSize(productId, sizeData);

    // Update button states if using button selector
    if (button) {
      const card = button.closest('.product-card');
      card.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      button.classList.add('selected');
    }

    // Update price display with sale prices if applicable
    const card = document.querySelector(`[data-product-id="${productId}"]`);
    const priceElement = card?.querySelector('.product-price');
    if (priceElement) {
      if (sizeData.salePrice) {
        const discount = Math.round(((sizeData.price - sizeData.salePrice) / sizeData.price) * 100);
        priceElement.innerHTML = `
          <span style="text-decoration: line-through; color: #999; margin-right: 0.5rem;">$${sizeData.price}</span>
          <span style="color: #e53935; font-weight: 600;">$${sizeData.salePrice}</span>
          <span style="background: #e53935; color: white; padding: 0.15rem 0.5rem; font-size: 0.7rem; border-radius: 3px; margin-left: 0.5rem;">${discount}% OFF</span>
        `;
      } else {
        priceElement.textContent = `$${sizeData.price.toLocaleString()}`;
      }
    }
  }

  // Attach size selector events
  attachSizeSelectors() {
    // This is called after updateProductCards creates the selectors
  }

  // Check if size is available
  async checkAvailability(productId, sku) {
    try {
      const response = await fetch(`/api/inventory/check?productId=${productId}&sku=${sku}`);
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

// Enhanced add to cart function that includes size
window.addToCart = function(button) {
  const productCard = button.closest('.product-card');
  const productId = productCard.dataset.productId;

  // Get selected size
  const selectedSize = window.productManager.getSelectedSize(productId);

  if (!selectedSize) {
    alert('Please select a size');
    return;
  }

  if (selectedSize.stock === 0) {
    alert('This size is out of stock');
    return;
  }

  // Get product details
  const product = window.productManager.getProduct(productId);

  if (!product) {
    console.error('Product not found:', productId);
    return;
  }

  // Use sale price if available
  const price = selectedSize.salePrice || selectedSize.price;

  const cartItem = {
    id: productId,
    name: product.name,
    brand: product.brand,
    price: price,
    originalPrice: selectedSize.price,
    salePrice: selectedSize.salePrice || null,
    image: product.images ? product.images[0] : product.image,
    size: selectedSize.size,
    sku: selectedSize.sku,
    quantity: 1
  };

  window.cart.addToCart(cartItem);
};
