/* @meta
{
  "name": "namesilo/domains",
  "description": "List all domains in your NameSilo account",
  "domain": "www.namesilo.com",
  "args": {},
  "readOnly": true,
  "example": "bb-browser site namesilo/domains"
}
*/
async function(args) {
  const resp = await fetch('/account_domains_data.php?1=1&no_demo=1&_search=false&rows=1000&page=1&sidx=Domain&sord=asc', { credentials: 'include' });
  if (!resp.ok) return { error: 'HTTP ' + resp.status, hint: 'Not logged in? Visit namesilo.com and log in first.' };
  const data = await resp.json();

  const domains = data.rows.map(row => {
    const nameMatch = row.cell[0].match(/\/account\/domains\/(\d+)">([^<]+)</);
    const nsMatch = row.cell[2].match(/<small>([^<]*)<\/small>/);
    const icons = row.cell[6];
    return {
      domain: nameMatch ? nameMatch[2] : row.cell[0],
      domainId: nameMatch ? parseInt(nameMatch[1]) : null,
      nameservers: nsMatch ? nsMatch[1] : row.cell[2],
      created: row.cell[3],
      expires: row.cell[4],
      status: row.cell[5],
      locked: icons.includes('domain_lock.png'),
      privacy: icons.includes('domain_privacy.png'),
      autoRenew: icons.includes('domain_autorenew.png') && !icons.includes('autorenew_off')
    };
  });

  return { domains, total: domains.length };
}
