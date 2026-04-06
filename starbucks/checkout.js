/* @meta
{
  "name": "starbucks/checkout",
  "description": "Checkout and place your Starbucks order",
  "domain": "www.starbucks.com",
  "args": {
    "password": {"required": true, "description": "Your Starbucks account password (required for order confirmation)"}
  },
  "readOnly": false,
  "example": "bb-browser site starbucks/checkout --password mypassword"
}
*/
async function(args) {
  if (!args.password) return { error: 'Missing argument: password', hint: 'Password is required to confirm checkout' };

  if (!window.location.pathname.includes('/menu/cart')) {
    return { error: 'Not on cart page', hint: 'Run: bb-browser open "https://www.starbucks.com/menu/cart" then retry' };
  }

  await new Promise(r => setTimeout(r, 1000));

  // Check for empty cart
  const pageText = document.body.textContent || '';
  if (pageText.includes('Your cart is empty') || pageText.includes('Start your order')) {
    return { error: 'Cart is empty', hint: 'Use starbucks/add to add items first' };
  }

  // Get order summary before checkout
  const countMatch = pageText.match(/Review order \((\d+)\)/);
  const totalMatch = pageText.match(/Total\s*\$([\d.]+)/);
  const storeEl = document.querySelector('[class*="storeName"]');
  const storeText = pageText.match(/Store\s+([^\n]+)/)?.[1]?.trim();

  // Step 1: Click "Checkout" button
  let checkoutBtn = null;
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent.includes('Checkout')) { checkoutBtn = btn; break; }
  }
  if (!checkoutBtn) return { error: 'Checkout button not found' };

  checkoutBtn.click();
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Wait for password dialog
  let passwordInput = null;
  for (let i = 0; i < 20; i++) {
    passwordInput = document.querySelector('input[type="password"], input[name="password"]');
    if (passwordInput) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (!passwordInput) {
    // Maybe no password needed (session still valid) - check if we went to confirmation
    if (window.location.pathname.includes('/order-confirmation') || pageText.includes('Order placed')) {
      return { status: 'placed', total: totalMatch ? '$' + totalMatch[1] : null };
    }
    return { error: 'Password dialog did not appear' };
  }

  // Step 3: Fill password
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(passwordInput, args.password);
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

  await new Promise(r => setTimeout(r, 500));

  // Step 4: Click Submit
  let submitBtn = null;
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent.trim() === 'Submit') { submitBtn = btn; break; }
  }
  if (!submitBtn) return { error: 'Submit button not found' };

  submitBtn.click();

  // Step 5: Wait for result
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));

    // Check for error
    const errorText = document.body.textContent;
    if (errorText.includes('Wrong password') || errorText.includes('incorrect')) {
      return { error: 'Wrong password' };
    }

    // Check for success - page might navigate to confirmation
    if (window.location.pathname.includes('/order-confirmation') || window.location.pathname.includes('/order-status')) {
      await new Promise(r => setTimeout(r, 2000));
      const confirmText = document.body.textContent;
      const orderNumMatch = confirmText.match(/Order\s*#?\s*(\d+)/i);
      const etaMatch = confirmText.match(/(\d+[-–]\d+\s*min)/i);
      return {
        status: 'placed',
        itemCount: countMatch?.[1],
        total: totalMatch ? '$' + totalMatch[1] : null,
        orderNumber: orderNumMatch?.[1],
        eta: etaMatch?.[1],
        url: window.location.href
      };
    }

    // Check if dialog closed (password accepted, order being placed)
    const dialog = document.querySelector('input[type="password"]');
    if (!dialog && !errorText.includes('Re-enter password')) {
      // Dialog closed, order might be processing
      await new Promise(r => setTimeout(r, 3000));
      if (window.location.pathname.includes('/order-confirmation') || window.location.pathname.includes('/order-status')) {
        const ct = document.body.textContent;
        const oNum = ct.match(/Order\s*#?\s*(\d+)/i);
        return {
          status: 'placed',
          itemCount: countMatch?.[1],
          total: totalMatch ? '$' + totalMatch[1] : null,
          orderNumber: oNum?.[1],
          url: window.location.href
        };
      }
    }
  }

  return { error: 'Timeout waiting for order confirmation', hint: 'Check the browser to see what happened' };
}
