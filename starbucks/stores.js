/* @meta
{
  "name": "starbucks/stores",
  "description": "Find nearby Starbucks stores",
  "domain": "www.starbucks.com",
  "args": {
    "lat": {"required": false, "description": "Latitude (auto-detected if omitted)"},
    "lng": {"required": false, "description": "Longitude (auto-detected if omitted)"},
    "limit": {"required": false, "description": "Number of stores to return (default: 10)"}
  },
  "readOnly": true,
  "example": "bb-browser site starbucks/stores"
}
*/
async function(args) {
  const H = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
  const limit = parseInt(args.limit) || 10;
  let lat = args.lat, lng = args.lng;

  if (!lat || !lng) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch(e) {
      return { error: 'Could not detect location', hint: 'Provide --lat and --lng, e.g. --lat 33.72 --lng -117.74' };
    }
  }

  const resp = await fetch('/apiproxy/v1/locations?lat=' + lat + '&lng=' + lng, { credentials: 'include', headers: H });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();

  const stores = data.slice(0, limit).map(item => ({
    storeNumber: item.store.storeNumber,
    name: item.store.name,
    address: item.store.address.singleLine,
    city: item.store.address.city,
    state: item.store.address.countrySubdivisionCode,
    phone: item.store.phoneNumber,
    distance: item.distance + ' mi',
    open: item.store.open,
    hours: item.store.openStatusFormatted,
    type: item.store.ownershipTypeCode
  }));

  return { stores, total: stores.length };
}
