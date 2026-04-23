/**
 * Shopping Cart Management
 * Handles add to cart, remove from cart, and cart display
 * Adapted for single-item vintage model (stock is always 1, no size variants)
 */

class Cart {
  constructor() {
    this.items = this.loadCart();
    this.updateCartUI();
  }

  // Load cart from localStorage
  loadCart() {
    try {
      const cartData = localStorage.getItem('polostew_cart');
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error loading cart:', error);
      return [];
    }
  }

  // Save cart to localStorage
  saveCart() {
    try {
      localStorage.setItem('polostew_cart', JSON.stringify(this.items));
      this.updateCartUI();
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }

  // Add item to cart (single-item vintage: no size variant, quantity always 1)
  addToCart(product) {
    const { id, name, brand, price, image, size, condition, era } = product;

    // Check if item already in cart (one-of-a-kind, no duplicates allowed)
    const existingItem = this.items.find(item => item.id === id);

    if (existingItem) {
      this.showNotification(`${name} is already in your cart — it's one of a kind`);
      return false;
    }

    // Add the item — quantity is always 1 for vintage items
    this.items.push({
      id,
      name,
      brand,
      price: parseFloat(price),
      image,
      size: size || 'One Size',
      condition: condition || '',
      era: era || '',
      quantity: 1
    });

    this.saveCart();
    this.showNotification(`${name} reserved — added to cart`);
    return true;
  }

  // Remove item from cart (releases the reservation)
  removeFromCart(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveCart();
  }

  // Update item quantity — capped at 1 for vintage items
  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      }
      // Quantity stays at 1 — vintage items cannot be increased
    }
  }

  // Get cart total
  getTotal() {
    return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  // Get cart count
  getCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  // Clear cart
  clearCart() {
    this.items = [];
    this.saveCart();
  }

  // Update cart UI (badge)
  updateCartUI() {
    const cartCount = this.getCount();
    const cartBadge = document.querySelector('.cart-badge');

    if (cartBadge) {
      if (cartCount > 0) {
        cartBadge.textContent = cartCount;
        cartBadge.style.display = 'flex';
      } else {
        cartBadge.style.display = 'none';
      }
    }
  }

  // Show notification
  showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;

    // Add to body
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize cart
window.cart = new Cart();

// Global function to add to cart from product cards (vintage single-item model)
function addToCart(button) {
  const productCard = button.closest('.product-card');
  const productId = productCard.dataset.productId || productCard.id || `product-${Date.now()}`;

  // If productManager is available, use it for full product data
  if (window.productManager) {
    const product = window.productManager.getProduct(productId);
    if (product) {
      if (window.productManager.isSold(product)) {
        window.cart.showNotification('This item has been sold');
        return;
      }

      const price = product.salePrice || product.basePrice;
      window.cart.addToCart({
        id: productId,
        name: product.name,
        brand: product.brand,
        price: price,
        image: product.images ? product.images[0] : product.image,
        size: product.size || 'One Size',
        condition: product.condition || '',
        era: product.era || ''
      });
      return;
    }
  }

  // Fallback: read from DOM
  const product = {
    id: productId,
    name: productCard.querySelector('.product-name')?.textContent || 'Product',
    brand: productCard.querySelector('.product-brand')?.textContent || 'Brand',
    price: productCard.querySelector('.product-price')?.textContent.replace('$', '').replace(',', '') || '0',
    image: productCard.querySelector('.product-image')?.src || ''
  };

  window.cart.addToCart(product);
}

// Enhanced wishlist toggle that integrates with auth
async function toggleWishlist(button) {
  const productCard = button.closest('.product-card');
  const productId = productCard.dataset.productId || productCard.id;

  // Check if user is authenticated
  if (!window.auth) {
    window.location.href = '/login.html';
    return;
  }

  await window.auth.checkAuth();

  if (!window.auth.user) {
    window.location.href = '/login.html';
    return;
  }

  // Toggle wishlist state
  const isInWishlist = button.classList.contains('active');

  try {
    if (isInWishlist) {
      await window.auth.removeFromWishlist(productId);
      button.classList.remove('active');
      button.textContent = '\u2661';
    } else {
      await window.auth.addToWishlist(productId);
      button.classList.add('active');
      button.textContent = '\u2665';
    }
  } catch (error) {
    console.error('Wishlist error:', error);
    // If not authenticated, redirect to login
    if (error.message?.includes('401')) {
      window.location.href = '/login.html';
    }
  }
}
