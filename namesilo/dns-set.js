/* @meta
{
  "name": "namesilo/dns-set",
  "description": "Add or update a DNS record for a domain in your NameSilo account",
  "domain": "www.namesilo.com",
  "args": {
    "domain": {"required": true, "description": "Domain name (e.g. 'example.com') or domain ID"},
    "type": {"required": true, "description": "Record type: A, AAAA, CNAME, MX, TXT, SRV, CAA"},
    "host": {"required": true, "description": "Hostname: '@' for root, 'www', 'sub', etc."},
    "value": {"required": true, "description": "Record value: IP address, hostname, text, etc."},
    "ttl": {"required": false, "description": "TTL in seconds (default: 3600)"},
    "distance": {"required": false, "description": "Priority/distance for MX/SRV records (default: 0)"},
    "id": {"required": false, "description": "Record ID to update. If omitted, adds a new record. Use namesilo/dns to find IDs."}
  },
  "readOnly": false,
  "example": "bb-browser site namesilo/dns-set example.com --type A --host @ --value 1.2.3.4"
}
*/
async function(args) {
  if (!args.domain) return { error: 'Missing argument: domain' };
  if (!args.type) return { error: 'Missing argument: type' };
  if (!args.host) return { error: 'Missing argument: host' };
  if (!args.value) return { error: 'Missing argument: value' };

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

  const body = {
    host: args.host,
    type: args.type.toUpperCase(),
    value: args.value,
    ttl: parseInt(args.ttl) || 3600,
    distance: parseInt(args.distance) || 0
  };

  let url, method;
  if (args.id) {
    // Update existing record
    url = '/domain/api/' + domainId + '/records/' + args.id;
    method = 'PUT';
  } else {
    // Add new record
    url = '/domain/api/' + domainId + '/records';
    method = 'POST';
  }

  const resp = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => null);
    return { error: 'HTTP ' + resp.status, detail: errData };
  }

  const data = await resp.json();
  if (data.result !== 'success') return { error: data.message || 'Operation failed' };

  return {
    action: args.id ? 'updated' : 'added',
    domain: domainName,
    record: data.data ? {
      id: data.data.id,
      host: data.data.host,
      type: data.data.type,
      value: data.data.value,
      ttl: data.data.ttl,
      distance: data.data.distance
    } : null
  };
}
