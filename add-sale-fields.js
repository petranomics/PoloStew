import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const productsPath = join(process.cwd(), 'data', 'products.json');
const data = JSON.parse(readFileSync(productsPath, 'utf8'));

// Add sale fields and timestamps to all products
data.products.forEach((product, index) => {
  // Add created date (stagger by days for variety)
  const daysAgo = index * 5;
  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - daysAgo);
  product.createdAt = createdDate.toISOString();

  // Add sale status (make every 4th product on sale)
  product.onSale = index % 4 === 0;

  // If on sale, add sale prices to sizes (20% off)
  if (product.onSale) {
    product.sizes.forEach(size => {
      size.salePrice = Math.round(size.price * 0.8);
    });
  }

  // Add featured flag (every 5th product)
  product.featured = index % 5 === 0;
});

writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf8');
console.log('✓ Added sale fields, timestamps, and featured flags to all products');
