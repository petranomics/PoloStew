// Script to add Add to Cart buttons and data-product-ids to all product cards
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

// Product cards that need updating with their IDs
const updates = [
  { oldName: 'Goldea The Roman Night', id: 'fragrance-goldea', price: '$145' },
  { oldName: 'Aqva Pour Homme', id: 'fragrance-aqva', price: '$110' },
  { oldName: 'Submariner Date', id: 'watches-submariner', price: '$14,300' },
  { oldName: 'GMT-Master II', id: 'watches-gmt', price: '$15,900' },
  { oldName: 'Yacht-Master', id: 'watches-yacht', price: '$13,150' },
  { oldName: 'Birkin 25', id: 'bags-birkin', price: '$12,500' },
  { oldName: 'Kelly 28', id: 'bags-kelly', price: '$11,800' },
  { oldName: 'Constance 24', id: 'bags-constance', price: '$9,200' },
  { oldName: 'Classic Flap Bag', id: 'accessories-classic-flap', price: '$8,800' },
  { oldName: 'Boy Bag', id: 'accessories-boy', price: '$5,300' },
  { oldName: '2.55 Reissue', id: 'accessories-2.55', price: '$7,400' },
  { oldName: 'Box Logo Hoodie', id: 'streetwear-box-logo', price: '$1,200' },
  { oldName: 'Air Force 1 High', id: 'streetwear-af1', price: '$895' },
  { oldName: 'Shoulder Bag', id: 'streetwear-shoulder', price: '$750' }
];

updates.forEach(({ oldName, id, price }) => {
  // Find the product card pattern and add data-product-id if not exists
  const cardPattern = new RegExp(
    `(<div class="product-card"(?! data-product-id)[^>]*onclick="[^"]*">\\s*<div class="product-image-container">.*?<h3 class="product-name">${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>\\s*<p class="product-price">${price.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>\\s*)(</div>)`,
    'gs'
  );

  html = html.replace(cardPattern, `$1<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(this)">Add to Cart</button>\n                $2`);

  // Add data-product-id to cards that don't have it
  const dataIdPattern = new RegExp(
    `<div class="product-card"((?! data-product-id)[^>]*)(>\\s*<div class="product-image-container">.*?<h3 class="product-name">${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>)`,
    'gs'
  );

  html = html.replace(dataIdPattern, `<div class="product-card" data-product-id="${id}"$1$2`);
});

fs.writeFileSync(filePath, html, 'utf8');
console.log('Updated all product cards!');
