/* @meta
{
  "name": "namesilo/dns",
  "description": "List DNS records for a domain in your NameSilo account",
  "domain": "www.namesilo.com",
  "args": {
    "domain": {"required": true, "description": "Domain name (e.g. 'example.com') or domain ID"},
    "type": {"required": false, "description": "Filter by record type: A, AAAA, CNAME, MX, TXT, etc."}
  },
  "readOnly": true,
  "example": "bb-browser site namesilo/dns example.com"
}
*/
async function(args) {
  if (!args.domain) return { error: 'Missing argument: domain' };

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

  const resp = await fetch('/domain/api/' + domainId + '/records', { credentials: 'include' });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();
  if (data.result !== 'success') return { error: data.message || 'Failed to fetch DNS records' };

  let records = data.data.map(r => ({
    id: r.id,
    host: r.host,
    type: r.type,
    value: r.value,
    ttl: r.ttl,
    distance: r.distance,
    updatedAt: r.updatedAt
  }));

  if (args.type) {
    const filterType = args.type.toUpperCase();
    records = records.filter(r => r.type === filterType);
  }

  return { domain: domainName, domainId: parseInt(domainId), records, total: records.length };
}
