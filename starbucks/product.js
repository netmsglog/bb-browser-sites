/* @meta
{
  "name": "starbucks/product",
  "description": "Get product details, size options and customizations",
  "domain": "www.starbucks.com",
  "args": {
    "product": {"required": true, "description": "Product URI from menu, e.g. '483/iced' or '407/hot'"},
    "store": {"required": false, "description": "Store number (default: nearest)"}
  },
  "readOnly": true,
  "example": "bb-browser site starbucks/product 483/iced"
}
*/
async function(args) {
  if (!args.product) return { error: 'Missing argument: product' };

  const storeNumber = args.store || '5741';
  const resp = await fetch('/apiproxy/v1/ordering/' + args.product + '?storeNumber=' + storeNumber, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();

  if (!data.products || !data.products[0]) return { error: 'Product not found' };
  const prod = data.products[0];

  const sizes = prod.sizes.map(s => ({
    name: s.name,
    sizeCode: s.sizeCode,
    sku: s.sku,
    default: s.default,
    calories: s.nutrition?.calories
  }));

  // Extract key customization options from defaultOptionValues of the default size
  const defaultSize = prod.sizes.find(s => s.default) || prod.sizes[0];
  const customizations = [];
  for (const dov of (defaultSize.defaultOptionValues || [])) {
    const opt = dov.productOption;
    if (!opt?.form) continue;
    const optSizes = opt.form.sizes || [];
    const defaultSku = optSizes.find(s => s.default)?.sku;
    // Only show options that are actually included (defaultValue > 0) or are key choices
    if (dov.defaultValue > 0 || opt.form.formCode === 'size') {
      customizations.push({
        name: opt.form.name,
        type: opt.form.formCode,
        defaultQuantity: dov.defaultValue,
        choices: optSizes.map(s => ({ name: s.name, sku: s.sku, sizeCode: s.sizeCode }))
      });
    }
  }

  return {
    name: prod.name,
    productNumber: prod.productNumber,
    formCode: prod.formCode,
    description: prod.description,
    uri: args.product,
    sizes,
    customizations: customizations.slice(0, 15)
  };
}
