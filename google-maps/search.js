/* @meta
{
  "name": "google-maps/search",
  "description": "Search for places on Google Maps",
  "domain": "www.google.com/maps",
  "args": {
    "query": {"required": true, "description": "Search query, e.g. 'gas station', 'coffee near me', 'pizza 10001'"}
  },
  "readOnly": true,
  "example": "bb-browser site google-maps/search 'gas station'"
}
*/
async function(args) {
  if (!args.query) return { error: 'Missing argument: query' };

  // Check if we're already on a maps search page with results
  const alreadyOnResults = window.location.pathname.includes('/maps/search/');

  if (!alreadyOnResults) {
    // Use the search input to search within the SPA
    const input = document.querySelector('#searchboxinput, input[name="q"]');
    if (!input) return { error: 'Google Maps not loaded', hint: 'First run: bb-browser open "https://www.google.com/maps/search/' + encodeURIComponent(args.query) + '" then retry this command' };

    // Set value using native input setter to trigger React/Angular change detection
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, args.query);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise(r => setTimeout(r, 300));

    // Press Enter to submit
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  }

  // Wait for results feed
  let feed = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    feed = document.querySelector('[role="feed"]');
    if (feed && feed.querySelectorAll('a[href*="/maps/place"]').length > 0) break;
  }

  if (!feed) {
    // Single place result
    await new Promise(r => setTimeout(r, 2000));
    const title = document.querySelector('h1');
    if (title) {
      const addr = document.querySelector('[data-item-id="address"]');
      const phone = document.querySelector('[data-item-id*="phone"]');
      const ratingEl = document.querySelector('.F7nice span[aria-hidden]');
      const coordMatch = window.location.href.match(/@([\d.-]+),([\d.-]+)/);
      return {
        query: args.query,
        results: [{
          name: title.textContent?.trim(),
          address: addr?.textContent?.trim(),
          phone: phone?.textContent?.trim(),
          rating: ratingEl?.textContent?.trim(),
          lat: coordMatch ? parseFloat(coordMatch[1]) : null,
          lng: coordMatch ? parseFloat(coordMatch[2]) : null
        }],
        total: 1
      };
    }
    return { error: 'No results found', hint: 'First run: bb-browser open "https://www.google.com/maps/search/' + encodeURIComponent(args.query) + '" && sleep 5, then retry' };
  }

  const links = feed.querySelectorAll(':scope > div > div > a[href*="/maps/place"]');
  const results = [];

  for (const link of links) {
    const container = link.closest(':scope > div > div') || link.parentElement;
    const nameEl = container.querySelector('.fontHeadlineSmall, .qBF1Pd');
    if (!nameEl) continue;

    const ratingEl = container.querySelector('.MW4etd');
    const reviewsEl = container.querySelector('.UY7F9');
    const infoSpans = container.querySelectorAll('.W4Efsd');
    const href = link.href || '';
    const coordMatch = href.match(/!3d([\d.-]+)!4d([\d.-]+)/);

    let category = null, address = null, hours = null, phone = null;
    for (const span of infoSpans) {
      const text = span.textContent?.trim();
      if (!text || text.length < 3 || /^\d\.\d\(/.test(text)) continue;
      const parts = text.split(' · ').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (/^\(\d{3}\)/.test(part) || /^\+?\d[\d\s-]{7,}/.test(part)) phone = part;
        else if (/[Oo]pen|[Cc]losed|hours/i.test(part)) {
          // Split "AddressOpen hours" into address and hours
          const hoursMatch = part.match(/(Open\s.+|Closed\s*.*)$/i);
          if (hoursMatch) {
            hours = hoursMatch[1].trim();
            const addrPart = part.slice(0, part.indexOf(hoursMatch[1])).trim();
            if (addrPart && /\d/.test(addrPart) && !address) address = addrPart;
          } else {
            hours = part;
          }
        }
        else if (!category && !/\d{3,}/.test(part) && part.length < 40) category = part;
        else if (!address && /\d/.test(part) && part.length > 5) address = part;
      }
      if (category && address) break;
    }

    results.push({
      name: nameEl.textContent?.trim(),
      category, address, phone, hours,
      rating: ratingEl?.textContent?.trim() || null,
      reviews: reviewsEl?.textContent?.replace(/[()]/g, '').trim() || null,
      lat: coordMatch ? parseFloat(coordMatch[1]) : null,
      lng: coordMatch ? parseFloat(coordMatch[2]) : null
    });
  }

  return { query: args.query, results, total: results.length };
}
