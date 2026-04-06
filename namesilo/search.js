/* @meta
{
  "name": "namesilo/search",
  "description": "Search domain availability and pricing on NameSilo",
  "domain": "www.namesilo.com",
  "args": {
    "query": {"required": true, "description": "Domain name to search (e.g. 'hello' or 'hello.com')"},
    "tlds": {"required": false, "description": "Comma-separated TLDs to check (default: com,net,org,io,ai,cc,us,shop,top,one,art,buzz)"}
  },
  "readOnly": true,
  "example": "bb-browser site namesilo/search mysite"
}
*/
async function(args) {
  if (!args.query) return { error: 'Missing argument: query' };

  const defaultTlds = ['com', 'net', 'org', 'io', 'ai', 'cc', 'us', 'shop', 'top', 'one', 'art', 'buzz'];
  const tlds = args.tlds ? args.tlds.split(',').map(t => t.trim().replace(/^\./, '')) : defaultTlds;

  // Extract base domain name (strip TLD if provided)
  let query = args.query.trim().toLowerCase();
  const dotIndex = query.lastIndexOf('.');
  if (dotIndex > 0) {
    const possibleTld = query.slice(dotIndex + 1);
    if (possibleTld.length >= 2) {
      query = query.slice(0, dotIndex);
      // If user specified a specific TLD like "hello.com", check that TLD first
      if (!tlds.includes(possibleTld)) {
        tlds.unshift(possibleTld);
      }
    }
  }

  // Step 1: Get CSRF token
  const tokenResp = await fetch('/public/api/token', { credentials: 'include' });
  if (!tokenResp.ok) return { error: 'Failed to get CSRF token. HTTP ' + tokenResp.status, hint: 'Try opening namesilo.com first' };
  const tokenData = await tokenResp.json();
  const csrf = tokenData.data.xsrfToken;

  // Step 2: Submit search
  const searchResp = await fetch('/public/api/domains/complex-search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
    body: JSON.stringify({
      requests: [{ type: 'bulk-check', domains: [query], tlds: tlds }],
      tlds: tlds
    })
  });
  if (!searchResp.ok) return { error: 'Search request failed. HTTP ' + searchResp.status };
  const searchData = await searchResp.json();
  if (searchData.result !== 'success') return { error: searchData.message || 'Search failed' };

  const checkId = searchData.data.checkId;

  // Step 3: Poll for results (up to 10 seconds)
  let domains = [];
  let completed = false;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const resultResp = await fetch('/public/api/domains/results/' + checkId, { credentials: 'include' });
    if (!resultResp.ok) continue;
    const resultData = await resultResp.json();
    if (resultData.result === 'success' && resultData.data) {
      domains = resultData.data.domains || [];
      completed = resultData.data.completed;
      if (completed || domains.length >= tlds.length) break;
    }
  }

  // Deduplicate by domain name
  const seen = new Set();
  const unique = [];
  for (const d of domains) {
    if (!seen.has(d.domain)) {
      seen.add(d.domain);
      unique.push(d);
    }
  }

  // Sort: available first, then by price
  unique.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.currentPrice - b.currentPrice;
  });

  return {
    query: query,
    results: unique.map(d => ({
      domain: d.domain,
      available: d.available,
      premium: d.premium,
      price: '$' + d.currentPrice.toFixed(2),
      regularPrice: '$' + d.regularPrice.toFixed(2),
      renewalPrice: '$' + d.renewalPrice.toFixed(2),
      onSale: d.currentPrice < d.regularPrice
    })),
    total: unique.length,
    completed: completed
  };
}
