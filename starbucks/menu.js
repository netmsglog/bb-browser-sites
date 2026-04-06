/* @meta
{
  "name": "starbucks/menu",
  "description": "Browse Starbucks menu categories and items",
  "domain": "www.starbucks.com",
  "args": {
    "category": {"required": false, "description": "Filter by category, e.g. 'Frappuccino', 'Hot Coffees', 'Food'"},
    "store": {"required": false, "description": "Store number (default: 5741)"}
  },
  "readOnly": true,
  "example": "bb-browser site starbucks/menu --category Frappuccino"
}
*/
async function(args) {
  const H = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
  const storeNumber = args.store || '5741';

  const resp = await fetch('/apiproxy/v1/ordering/menu?ownershipTypeCode=CO&storeNumber=' + storeNumber + '&timeZone=GMT-08%3A00%20America%2FLos_Angeles', { credentials: 'include', headers: H });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();

  const filter = args.category?.toLowerCase();

  // Recursively collect categories and products
  const collectItems = (node, path) => {
    const results = [];
    const name = node.name || '';
    const currentPath = path ? path + ' > ' + name : name;

    for (const prod of (node.products || [])) {
      results.push({
        name: prod.name,
        productNumber: prod.productNumber,
        formCode: prod.formCode,
        uri: prod.productNumber + '/' + (prod.formCode || '').toLowerCase(),
        available: prod.availability !== 'UNAVAILABLE'
      });
    }
    for (const child of (node.children || [])) {
      results.push(...collectItems(child, currentPath));
    }
    return results;
  };

  const categories = [];
  for (const menu of (data.menus || [])) {
    for (const sub of (menu.children || [])) {
      const catName = sub.name;
      if (filter && !catName.toLowerCase().includes(filter) && !menu.name.toLowerCase().includes(filter)) continue;
      const items = collectItems(sub, '');
      if (items.length > 0) {
        categories.push({ name: catName, parent: menu.name, items, totalItems: items.length });
      }
    }
    // Also check if top-level matches
    if (filter && menu.name.toLowerCase().includes(filter) && !categories.some(c => c.parent === menu.name)) {
      const items = collectItems(menu, '');
      if (items.length > 0) {
        categories.push({ name: menu.name, items, totalItems: items.length });
      }
    }
  }

  if (filter) {
    return { storeNumber, categories: categories.map(c => ({ name: c.name, items: c.items.slice(0, 20), totalItems: c.totalItems })) };
  }

  return {
    storeNumber,
    categories: categories.map(c => ({ name: c.name, parent: c.parent, totalItems: c.totalItems, sample: c.items.slice(0, 3).map(i => ({ name: i.name, uri: i.uri })) }))
  };
}
