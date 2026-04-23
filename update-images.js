import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const productsPath = join(process.cwd(), 'data', 'products.json');
const data = JSON.parse(readFileSync(productsPath, 'utf8'));

// Sample additional image URLs for variety
const sampleImages = [
  "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=1000&fit=crop",
  "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=1000&fit=crop",
  "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&h=1000&fit=crop",
  "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=1000&fit=crop",
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=1000&fit=crop",
  "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&h=1000&fit=crop"
];

data.products.forEach(product => {
  if (product.image && !product.images) {
    // Convert single image to images array with 3 variations
    const baseImage = product.image.replace(/w=\d+/, 'w=800').replace(/h=\d+/, 'h=1000');
    product.images = [
      baseImage,
      sampleImages[Math.floor(Math.random() * sampleImages.length)],
      sampleImages[Math.floor(Math.random() * sampleImages.length)]
    ];
    delete product.image;
  }
});

writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf8');
console.log('✓ Updated all products with multiple images');
