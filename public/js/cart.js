/**
 * Shopping Cart Management
 * Handles add to cart, remove from cart, and cart display
 */

class Cart {
  constructor() {
    this.items = this.loadCart();
    this.updateCartUI();
  }

  // Load cart from localStorage
  loadCart() {
    try {
      const cartData = localStorage.getItem('luxine_cart');
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error loading cart:', error);
      return [];
    }
  }

  // Save cart to localStorage
  saveCart() {
    try {
      localStorage.setItem('luxine_cart', JSON.stringify(this.items));
      this.updateCartUI();
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }

  // Add item to cart
  addToCart(product) {
    const { id, name, brand, price, image, size, sku } = product;

    // Check if item already exists (same product AND same size)
    const existingItem = this.items.find(item =>
      item.id === id && item.size === size && item.sku === sku
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.items.push({
        id,
        name,
        brand,
        price: parseFloat(price),
        image,
        size: size || 'One Size',
        sku: sku || '',
        quantity: 1
      });
    }

    this.saveCart();
    this.showNotification(`${name} ${size ? `(${size})` : ''} added to cart`);
    return true;
  }

  // Remove item from cart
  removeFromCart(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveCart();
  }

  // Update item quantity
  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this.saveCart();
      }
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

// Global function to add to cart from product cards
function addToCart(button) {
  const productCard = button.closest('.product-card');
  const product = {
    id: productCard.dataset.productId || productCard.id || `product-${Date.now()}`,
    name: productCard.querySelector('.product-name')?.textContent || 'Product',
    brand: productCard.querySelector('.product-brand')?.textContent || 'Brand',
    price: productCard.querySelector('.product-price')?.textContent.replace('$', '') || '0',
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
      button.textContent = '♡';
    } else {
      await window.auth.addToWishlist(productId);
      button.classList.add('active');
      button.textContent = '♥';
    }
  } catch (error) {
    console.error('Wishlist error:', error);
    // If not authenticated, redirect to login
    if (error.message?.includes('401')) {
      window.location.href = '/login.html';
    }
  }
}
