/* @meta
{
  "name": "starbucks/cart",
  "description": "View Starbucks cart contents and pricing",
  "domain": "www.starbucks.com/menu/cart",
  "args": {},
  "readOnly": true,
  "example": "bb-browser site starbucks/cart"
}
*/
async function(args) {
  // Wait for cart page to load (domain auto-opens /menu/cart)
  for (let i = 0; i < 30; i++) {
    if (window.location.pathname.includes('/menu/cart')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 2000));

  const pageText = document.body.textContent || '';

  if (pageText.includes('Your cart is empty') || pageText.includes('Start your order')) {
    return { items: [], total: null, hint: 'Cart is empty. Use starbucks/add to add items.' };
  }

  // Parse items using h3 headings (product names in cart)
  const items = [];
  const h3s = document.querySelectorAll('h3');
  for (const h3 of h3s) {
    const name = h3.textContent?.trim();
    if (!name || name.length > 80 || name.length < 3) continue;
    if (/Reward|Pickup|About|Career|Social/i.test(name)) continue;

    const card = h3.parentElement?.parentElement;
    if (!card) continue;
    const cardText = card.textContent || '';
    const sizeMatch = cardText.match(/(Tall|Grande|Venti|Trenta)\s+\d+\s*fl\s*oz/i);
    const priceMatch = cardText.match(/\$(\d+\.\d{2})/);

    items.push({ name, size: sizeMatch?.[0], price: priceMatch ? '$' + priceMatch[1] : null });
  }

  const countMatch = pageText.match(/Review order \((\d+)\)/);
  const subtotalMatch = pageText.match(/Subtotal\s*\$([\d.]+)/);
  const totalMatch = pageText.match(/Total\s*\$([\d.]+)/);
  const storeMatch = pageText.match(/Store\s+([^\n]+\d+\.\d+\s*mi)/);
  const pickupMatch = pageText.match(/Pickup time\s+([^\n]+)/);

  return {
    items,
    itemCount: parseInt(countMatch?.[1]) || items.length,
    subtotal: subtotalMatch ? '$' + subtotalMatch[1] : null,
    total: totalMatch ? '$' + totalMatch[1] : null,
    store: storeMatch?.[1]?.trim(),
    pickupTime: pickupMatch?.[1]?.trim()
  };
}
