/* @meta
{
  "name": "starbucks/add",
  "description": "Add a product to the Starbucks order cart",
  "domain": "www.starbucks.com",
  "args": {
    "size": {"required": false, "description": "Size: Tall, Grande, Venti, Trenta"},
    "milk": {"required": false, "description": "Milk: 'Oat Milk', 'Almond Milk', '2% Milk', etc."},
    "product": {"required": false, "description": "Product URI for SPA navigation, e.g. '483/iced' (only works from /menu pages)"}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/add --size Venti"
}
*/
async function(args) {
  // Navigate to product page if product URI given
  const uri = args.product && /^\d/.test(args.product) ? args.product : null;

  if (uri && !window.location.pathname.includes('/menu/product/' + uri)) {
    const a = document.createElement('a');
    a.href = '/menu/product/' + uri;
    document.body.appendChild(a);
    a.click();
    a.remove();

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (window.location.pathname.includes('/menu/product/') &&
          document.body.textContent.includes('Add to Order')) break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!window.location.pathname.includes('/menu/product/')) {
    return {
      error: 'Not on a product page',
      hint: 'Run: bb-browser open "https://www.starbucks.com/menu/product/483/iced" then: bb-browser site starbucks/add --size Venti'
    };
  }

  // Wait for page ready
  for (let i = 0; i < 20; i++) {
    if (document.body.textContent.includes('Add to Order')) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Select size
  if (args.size) {
    const sizeTarget = args.size.toLowerCase();
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(sizeTarget)) {
        const radio = label.querySelector('input[type="radio"]') || document.getElementById(label.htmlFor);
        if (radio) radio.click();
        else label.click();
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }
  }

  // Select milk
  if (args.milk) {
    const milkTarget = args.milk.toLowerCase();
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      const labelEl = sel.closest('div')?.querySelector('label');
      if (labelEl?.textContent?.toLowerCase().includes('milk') || sel.id?.toLowerCase().includes('milk')) {
        for (const opt of sel.options) {
          if (opt.textContent.toLowerCase().includes(milkTarget)) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 500));
            break;
          }
        }
        break;
      }
    }
  }

  // Get current product info
  const productName = document.querySelector('h1')?.textContent?.trim();
  const checkedLabel = document.querySelector('input[type="radio"]:checked')?.closest('label');
  const selectedSize = checkedLabel?.textContent?.trim();
  const milkSelect = Array.from(document.querySelectorAll('select')).find(s =>
    s.closest('div')?.querySelector('label')?.textContent?.toLowerCase().includes('milk'));
  const selectedMilk = milkSelect?.options[milkSelect.selectedIndex]?.textContent?.trim();

  // Click "Add to Order"
  let addBtn = null;
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent.includes('Add to Order')) { addBtn = btn; break; }
  }
  if (!addBtn) return { error: 'Add to Order button not found' };

  addBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  return {
    status: 'added',
    product: productName,
    size: selectedSize,
    milk: selectedMilk || null
  };
}
