/* @meta
{
  "name": "starbucks/add",
  "description": "Add product to Starbucks cart",
  "domain": "www.starbucks.com",
  "args": {
    "product": {"required": true, "description": "Product URI, e.g. '483/iced'. Get from starbucks/menu."},
    "size": {"required": false, "description": "Size: Tall, Grande, Venti, Trenta"},
    "milk": {"required": false, "description": "Milk: 'Oat Milk', 'Almond Milk', '2% Milk', etc."}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/add 483/iced --size Venti"
}
*/
async function(args) {
  if (!args.product || !/^\d/.test(args.product)) {
    return { error: 'Missing or invalid product URI', hint: 'Get URIs from: bb-browser site starbucks/menu --category Frappuccino' };
  }

  const targetPath = '/menu/product/' + args.product;

  if (!window.location.pathname.includes(targetPath)) {
    const cmd = 'bb-browser open "https://www.starbucks.com' + targetPath + '" && sleep 5 && bb-browser site starbucks/add ' + args.product + (args.size ? ' --size ' + args.size : '') + (args.milk ? ' --milk "' + args.milk + '"' : '');
    return { error: 'Not on product page. Run: ' + cmd };
  }

  for (let i = 0; i < 20; i++) {
    if (document.body.textContent.includes('Add to Order')) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (args.size) {
    const sizeTarget = args.size.toLowerCase();
    for (const label of document.querySelectorAll('label')) {
      if (label.textContent.toLowerCase().includes(sizeTarget)) {
        const radio = label.querySelector('input[type="radio"]') || document.getElementById(label.htmlFor);
        if (radio) radio.click(); else label.click();
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }
  }

  if (args.milk) {
    const milkTarget = args.milk.toLowerCase();
    for (const sel of document.querySelectorAll('select')) {
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

  const productName = document.querySelector('h1')?.textContent?.trim();
  const checkedLabel = document.querySelector('input[type="radio"]:checked')?.closest('label');
  const selectedSize = checkedLabel?.textContent?.trim();
  const milkSelect = Array.from(document.querySelectorAll('select')).find(s =>
    s.closest('div')?.querySelector('label')?.textContent?.toLowerCase().includes('milk'));
  const selectedMilk = milkSelect?.options[milkSelect.selectedIndex]?.textContent?.trim();

  let addBtn = null;
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent.includes('Add to Order')) { addBtn = btn; break; }
  }
  if (!addBtn) return { error: 'Add to Order button not found' };

  addBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  return { status: 'added', product: productName, size: selectedSize, milk: selectedMilk || null };
}
