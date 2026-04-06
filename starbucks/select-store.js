/* @meta
{
  "name": "starbucks/select-store",
  "description": "Select a Starbucks store for ordering. First open: bb-browser open 'https://www.starbucks.com/store-locator?source=menu'",
  "domain": "www.starbucks.com",
  "args": {
    "store": {"required": true, "description": "Store name (partial match) or store number, e.g. 'Culver', '5741-5526'"}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/select-store Culver"
}
*/
async function(args) {
  if (!args.store) return { error: 'Missing argument: store' };

  if (!window.location.pathname.includes('/store-locator')) {
    return { error: 'Not on store locator page', hint: 'First run: bb-browser open "https://www.starbucks.com/store-locator?source=menu"' };
  }

  await new Promise(r => setTimeout(r, 1000));

  const target = args.store.toLowerCase();

  // Find the "Select <storeName>" button that matches
  let selectBtn = null;
  let storeName = null;
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
    if (label.startsWith('select ') && label.includes(target)) {
      selectBtn = btn;
      storeName = (btn.getAttribute('aria-label') || btn.textContent).replace(/^Select /i, '').trim();
      break;
    }
  }

  if (!selectBtn) {
    // List available stores for the user
    const available = [];
    for (const btn of buttons) {
      const label = btn.getAttribute('aria-label') || btn.textContent || '';
      if (/^Select /i.test(label)) {
        available.push(label.replace(/^Select /i, '').trim());
      }
    }
    return { error: 'Store not found: ' + args.store, available: available.slice(0, 10), hint: 'Try a partial name from the list above' };
  }

  // Click "Select" to highlight the store
  selectBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  // Now find and click "Order Here" button
  let orderBtn = null;
  for (const btn of document.querySelectorAll('button')) {
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
    if (label.includes('order here')) {
      orderBtn = btn;
      break;
    }
  }

  if (!orderBtn) {
    // Also check for links
    for (const a of document.querySelectorAll('a')) {
      if ((a.textContent || '').toLowerCase().includes('order here')) {
        orderBtn = a;
        break;
      }
    }
  }

  if (orderBtn) {
    orderBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    return {
      status: 'selected',
      store: storeName,
      redirected: window.location.pathname,
      hint: 'Store selected! Now browse the menu or add items to cart.'
    };
  }

  return {
    status: 'highlighted',
    store: storeName,
    hint: 'Store highlighted but "Order Here" not found. Try clicking it manually.'
  };
}
