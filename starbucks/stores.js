/* @meta
{
  "name": "starbucks/stores",
  "description": "Find nearby Starbucks stores by zip code, city, or coordinates",
  "domain": "www.starbucks.com",
  "args": {
    "place": {"required": false, "description": "Zip code, city name, or address (e.g. '92602', 'Seattle', '1600 Pennsylvania Ave')"},
    "lat": {"required": false, "description": "Latitude"},
    "lng": {"required": false, "description": "Longitude"},
    "limit": {"required": false, "description": "Number of stores to return (default: 10)"}
  },
  "readOnly": true,
  "example": "bb-browser site starbucks/stores 92602"
}
*/
async function(args) {
  const H = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
  const limit = parseInt(args.limit) || 10;

  let url;
  if (args.place) {
    url = '/apiproxy/v1/locations?place=' + encodeURIComponent(args.place);
  } else if (args.lat && args.lng) {
    url = '/apiproxy/v1/locations?lat=' + args.lat + '&lng=' + args.lng;
  } else {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      url = '/apiproxy/v1/locations?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude;
    } catch(e) {
      return { error: 'Could not detect location', hint: 'Provide a zip code: bb-browser site starbucks/stores 92602' };
    }
  }

  const resp = await fetch(url, { credentials: 'include', headers: H });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();

  const stores = data.slice(0, limit).map(item => ({
    storeNumber: item.store.storeNumber,
    name: item.store.name,
    address: item.store.address.singleLine,
    city: item.store.address.city,
    state: item.store.address.countrySubdivisionCode,
    phone: item.store.phoneNumber,
    distance: item.distance.toFixed(1) + ' mi',
    open: item.store.open,
    hours: item.store.openStatusFormatted,
    type: item.store.ownershipTypeCode
  }));

  return { stores, total: stores.length };
}
