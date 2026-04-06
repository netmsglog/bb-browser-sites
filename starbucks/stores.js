/* @meta
{
  "name": "starbucks/stores",
  "description": "Find Starbucks stores near an address, zip, or city. Page stays on store-locator for select-store.",
  "domain": "www.starbucks.com",
  "args": {
    "place": {"required": true, "description": "Address, zip code, or city, e.g. '5 Plumbago, Irvine, CA 92620', '10001', 'Seattle'"},
    "limit": {"required": false, "description": "Number of stores to return (default: 5)"}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/stores '5 Plumbago, Irvine, CA 92620'"
}
*/
async function(args) {
  if (!args.place) return { error: 'Missing argument: place', hint: 'e.g. bb-browser site starbucks/stores "92620"' };

  const limit = parseInt(args.limit) || 5;

  // Navigate to store locator if not already there
  if (!window.location.pathname.includes('/store-locator')) {
    window.location.href = '/store-locator?source=menu';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (document.querySelector('input[role="searchbox"], input[aria-label*="location"]')) break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Find and fill the search box
  const searchBox = document.querySelector('input[role="searchbox"], input[aria-label*="location"]');
  if (!searchBox) return { error: 'Store locator search box not found' };

  // Clear and fill
  searchBox.focus();
  searchBox.value = '';
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(searchBox, args.place);
  searchBox.dispatchEvent(new Event('input', { bubbles: true }));
  searchBox.dispatchEvent(new Event('change', { bubbles: true }));

  await new Promise(r => setTimeout(r, 500));

  // Click submit / press Enter
  const submitBtn = document.querySelector('button[aria-label*="Submit search"], button[aria-label*="submit"]');
  if (submitBtn) submitBtn.click();
  else searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

  // Close autocomplete dropdown by pressing Escape then wait for results
  await new Promise(r => setTimeout(r, 500));
  searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));

  // Wait for store results to update
  await new Promise(r => setTimeout(r, 3000));

  // Also fetch via API for structured data
  const H = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
  const resp = await fetch('/apiproxy/v1/locations?place=' + encodeURIComponent(args.place), { credentials: 'include', headers: H });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();

  const stores = data.slice(0, limit).map((item, i) => ({
    index: i + 1,
    storeNumber: item.store.storeNumber,
    name: item.store.name,
    address: item.store.address.singleLine,
    distance: item.distance.toFixed(1) + ' mi',
    open: item.store.open,
    hours: item.store.openStatusFormatted,
    phone: item.store.phoneNumber,
    type: item.store.ownershipTypeCode
  }));

  return {
    place: args.place,
    stores,
    total: stores.length,
    hint: 'Select a store: bb-browser site starbucks/select-store "' + (stores[0]?.name || '') + '"'
  };
}
