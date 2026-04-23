/**
 * Authentication Client for PoloStew
 * Handles login, registration, and session management
 */

class AuthClient {
  constructor() {
    this.user = null;
    this.isLoading = false;
  }

  async init() {
    await this.checkAuth();
  }

  /**
   * Check if user is authenticated and get user data
   */
  async checkAuth() {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        this.user = await response.json();
        this.updateUI();
        return true;
      } else {
        this.user = null;
        this.updateUI();
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.user = null;
      this.updateUI();
      return false;
    }
  }

  /**
   * Register new user
   */
  async register(email, password, firstName, lastName) {
    this.isLoading = true;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName
        })
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: data.message,
          user: data.user
        };
      } else {
        return {
          success: false,
          error: data.error || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Login user
   */
  async login(email, password, rememberMe = false) {
    this.isLoading = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          rememberMe
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.user = data.user;
        this.updateUI();

        return {
          success: true,
          user: data.user
        };
      } else {
        return {
          success: false,
          error: data.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    this.isLoading = true;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      this.user = null;
      this.updateUI();

      // Redirect to homepage
      window.location.href = '/index.html';

    } catch (error) {
      console.error('Logout error:', error);
      // Even if API fails, clear local state
      this.user = null;
      this.updateUI();
      window.location.href = '/index.html';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Add item to wishlist
   */
  async addToWishlist(productId) {
    try {
      const response = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local user data
        if (this.user) {
          this.user.wishlist = data.wishlist;
        }
        return { success: true, wishlist: data.wishlist };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Add to wishlist error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(productId) {
    try {
      const response = await fetch('/api/user/wishlist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local user data
        if (this.user) {
          this.user.wishlist = data.wishlist;
        }
        return { success: true, wishlist: data.wishlist };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Remove from wishlist error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Update UI based on auth state
   */
  updateUI() {
    // Update account button if it exists
    const accountBtns = document.querySelectorAll('[aria-label="Account"], .icon-btn[onclick*="Account"]');

    accountBtns.forEach(btn => {
      if (this.user) {
        // User is logged in
        btn.onclick = () => {
          if (this.user.role === 'admin') {
            window.location.href = '/admin/index.html';
          } else {
            window.location.href = '/account.html';
          }
        };

        // Update button appearance if desired
        btn.setAttribute('title', `Logged in as ${this.user.profile.firstName}`);
      } else {
        // User is not logged in
        btn.onclick = () => {
          window.location.href = '/login.html';
        };

        btn.setAttribute('title', 'Login or Sign Up');
      }
    });

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('authStateChanged', {
      detail: { user: this.user }
    }));
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.user !== null;
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.user?.role === 'admin';
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Require authentication (redirect to login if not authenticated)
   */
  async requireAuth(redirectUrl = null) {
    const isAuth = await this.checkAuth();

    if (!isAuth) {
      const redirect = redirectUrl || window.location.pathname;
      window.location.href = `/login.html?redirect=${encodeURIComponent(redirect)}`;
      return false;
    }

    return true;
  }

  /**
   * Require admin access (redirect if not admin)
   */
  async requireAdmin() {
    const isAuth = await this.checkAuth();

    if (!isAuth) {
      window.location.href = '/login.html?redirect=/admin/';
      return false;
    }

    if (!this.isAdmin()) {
      alert('Admin access required');
      window.location.href = '/index.html';
      return false;
    }

    return true;
  }
}

// Initialize global auth instance
window.auth = new AuthClient();

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.auth.init();
  });
} else {
  window.auth.init();
}
