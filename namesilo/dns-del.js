/* @meta
{
  "name": "namesilo/dns-del",
  "description": "Delete a DNS record from a domain in your NameSilo account",
  "domain": "www.namesilo.com",
  "args": {
    "domain": {"required": true, "description": "Domain name (e.g. 'example.com') or domain ID"},
    "id": {"required": true, "description": "Record ID to delete. Use namesilo/dns to find IDs."}
  },
  "readOnly": false,
  "example": "bb-browser site namesilo/dns-del example.com --id 422584149"
}
*/
async function(args) {
  if (!args.domain) return { error: 'Missing argument: domain' };
  if (!args.id) return { error: 'Missing argument: id' };

  // Resolve domain name to domain ID
  let domainId = args.domain;
  let domainName = args.domain;
  if (!/^\d+$/.test(domainId)) {
    const listResp = await fetch('/account_domains_data.php?1=1&no_demo=1&_search=false&rows=1000&page=1&sidx=Domain&sord=asc', { credentials: 'include' });
    if (!listResp.ok) return { error: 'HTTP ' + listResp.status, hint: 'Not logged in?' };
    const listData = await listResp.json();
    let found = false;
    for (const row of listData.rows) {
      const m = row.cell[0].match(/\/account\/domains\/(\d+)">([^<]+)</);
      if (m && m[2] === args.domain) {
        domainId = m[1];
        domainName = m[2];
        found = true;
        break;
      }
    }
    if (!found) return { error: 'Domain not found: ' + args.domain, hint: 'Run namesilo/domains to see your domains' };
  }

  // Get CSRF token
  const tokenResp = await fetch('/public/api/token', { credentials: 'include' });
  if (!tokenResp.ok) return { error: 'Failed to get CSRF token' };
  const tokenData = await tokenResp.json();
  const csrf = tokenData.data.xsrfToken;

  const resp = await fetch('/domain/api/' + domainId + '/records/' + args.id, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRF-TOKEN': csrf }
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => null);
    return { error: 'HTTP ' + resp.status, detail: errData };
  }

  const data = await resp.json();
  if (data.result !== 'success') return { error: data.message || 'Delete failed' };

  return { action: 'deleted', domain: domainName, recordId: parseInt(args.id) };
}
