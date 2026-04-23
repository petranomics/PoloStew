/**
 * Product Filters & Sorting
 * Handles filtering by price, brand, sale status, and sorting
 */

class ProductFilters {
  constructor(products, onFilterChange) {
    this.allProducts = products;
    this.filteredProducts = [...products];
    this.onFilterChange = onFilterChange;

    this.filters = {
      brands: [],
      priceRange: { min: 0, max: Infinity },
      onSale: false,
      featured: false,
      category: null
    };

    this.sortBy = 'newest'; // newest, price-low, price-high, name-az
  }

  // Apply all filters
  applyFilters() {
    let filtered = [...this.allProducts];

    // Filter by category
    if (this.filters.category) {
      filtered = filtered.filter(p => p.category === this.filters.category);
    }

    // Filter by brands
    if (this.filters.brands.length > 0) {
      filtered = filtered.filter(p => this.filters.brands.includes(p.brand));
    }

    // Filter by price range (using base price)
    filtered = filtered.filter(p => {
      const price = p.onSale && p.sizes[0].salePrice ? p.sizes[0].salePrice : p.basePrice;
      return price >= this.filters.priceRange.min && price <= this.filters.priceRange.max;
    });

    // Filter by sale status
    if (this.filters.onSale) {
      filtered = filtered.filter(p => p.onSale === true);
    }

    // Filter by featured
    if (this.filters.featured) {
      filtered = filtered.filter(p => p.featured === true);
    }

    // Apply sorting
    filtered = this.sortProducts(filtered);

    this.filteredProducts = filtered;

    if (this.onFilterChange) {
      this.onFilterChange(this.filteredProducts);
    }

    return this.filteredProducts;
  }

  // Sort products
  sortProducts(products) {
    const sorted = [...products];

    switch (this.sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'price-low':
        sorted.sort((a, b) => {
          const priceA = a.onSale && a.sizes[0].salePrice ? a.sizes[0].salePrice : a.basePrice;
          const priceB = b.onSale && b.sizes[0].salePrice ? b.sizes[0].salePrice : b.basePrice;
          return priceA - priceB;
        });
        break;
      case 'price-high':
        sorted.sort((a, b) => {
          const priceA = a.onSale && a.sizes[0].salePrice ? a.sizes[0].salePrice : a.basePrice;
          const priceB = b.onSale && b.sizes[0].salePrice ? b.sizes[0].salePrice : b.basePrice;
          return priceB - priceA;
        });
        break;
      case 'name-az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-za':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return sorted;
  }

  // Set brand filter
  setBrandFilter(brands) {
    this.filters.brands = Array.isArray(brands) ? brands : [brands];
    return this.applyFilters();
  }

  // Toggle brand filter
  toggleBrand(brand) {
    const index = this.filters.brands.indexOf(brand);
    if (index > -1) {
      this.filters.brands.splice(index, 1);
    } else {
      this.filters.brands.push(brand);
    }
    return this.applyFilters();
  }

  // Set price range filter
  setPriceRange(min, max) {
    this.filters.priceRange = { min, max };
    return this.applyFilters();
  }

  // Toggle sale filter
  toggleSaleFilter() {
    this.filters.onSale = !this.filters.onSale;
    return this.applyFilters();
  }

  // Toggle featured filter
  toggleFeaturedFilter() {
    this.filters.featured = !this.filters.featured;
    return this.applyFilters();
  }

  // Set category filter
  setCategoryFilter(category) {
    this.filters.category = category;
    return this.applyFilters();
  }

  // Set sort order
  setSortBy(sortBy) {
    this.sortBy = sortBy;
    return this.applyFilters();
  }

  // Clear all filters
  clearFilters() {
    this.filters = {
      brands: [],
      priceRange: { min: 0, max: Infinity },
      onSale: false,
      featured: false,
      category: this.filters.category // Keep category filter
    };
    this.sortBy = 'newest';
    return this.applyFilters();
  }

  // Get all unique brands
  getAllBrands() {
    const brands = new Set(this.allProducts.map(p => p.brand));
    return Array.from(brands).sort();
  }

  // Get price range
  getPriceRange() {
    const prices = this.allProducts.map(p =>
      p.onSale && p.sizes[0].salePrice ? p.sizes[0].salePrice : p.basePrice
    );
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }

  // Get filter counts
  getFilterCounts() {
    return {
      total: this.allProducts.length,
      filtered: this.filteredProducts.length,
      onSale: this.allProducts.filter(p => p.onSale).length,
      featured: this.allProducts.filter(p => p.featured).length
    };
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.ProductFilters = ProductFilters;
}
