/* @meta
{
  "name": "starbucks/add",
  "description": "Add current product to cart. First open: bb-browser open 'https://www.starbucks.com/menu/product/<uri>'",
  "domain": "www.starbucks.com",
  "args": {
    "size": {"required": false, "description": "Size: Tall, Grande, Venti, Trenta"},
    "milk": {"required": false, "description": "Milk: 'Oat Milk', 'Almond Milk', '2% Milk', etc."}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/add --size Tall"
}
*/
async function(args) {
  // Verify we're on a product page
  if (!window.location.pathname.includes('/menu/product/')) {
    return { error: 'Not on a product page', hint: 'First run: bb-browser open "https://www.starbucks.com/menu/product/483/iced"' };
  }

  // Wait for page to fully load
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('button') && document.body.textContent.includes('Add to Order')) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Select size if specified
  if (args.size) {
    const sizeTarget = args.size.toLowerCase();
    const radios = document.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      const label = radio.closest('label') || document.querySelector('label[for="' + radio.id + '"]');
      const labelText = (label?.textContent || '').toLowerCase();
      if (labelText.includes(sizeTarget)) {
        radio.click();
        label?.click();
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }
  }

  // Select milk if specified
  if (args.milk) {
    const milkTarget = args.milk.toLowerCase();
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      const labelEl = sel.closest('[class*="formGroup"]')?.querySelector('label') ||
                      document.querySelector('label[for="' + sel.id + '"]');
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

  // Get current state
  const productName = document.querySelector('h1')?.textContent?.trim();
  const checkedRadio = document.querySelector('input[type="radio"]:checked');
  const selectedSize = checkedRadio?.closest('label')?.textContent?.trim() ||
                       checkedRadio?.value;
  const milkSelect = Array.from(document.querySelectorAll('select')).find(s =>
    s.closest('[class*="formGroup"]')?.querySelector('label')?.textContent?.toLowerCase().includes('milk'));
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
    milk: selectedMilk || null,
    hint: 'View cart: bb-browser open "https://www.starbucks.com/menu/cart" && bb-browser site starbucks/cart'
  };
}
