(function (global) {
  'use strict';

  function digitsOnly(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function normalizePhone(phone) {
    if (typeof phone !== 'string') return '';
    let digits = digitsOnly(phone);
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^0[2-7]\d{8}$/.test(digits)) digits = `93${digits.slice(1)}`;
    if (/^[2-7]\d{8}$/.test(digits)) digits = `93${digits}`;
    if (!/^[1-9]\d{7,14}$/.test(digits)) return '';
    if (digits.startsWith('93') && !/^93[2-7]\d{8}$/.test(digits)) return '';
    return digits;
  }

  function resolvePhone(restaurant) {
    const candidates = [
      restaurant?.whatsapp,
      restaurant?.whatsapp_number,
      restaurant?.phone,
      ...(Array.isArray(restaurant?.phones) ? restaurant.phones : []),
      ...(Array.isArray(restaurant?.phone_numbers) ? restaurant.phone_numbers : [])
    ];
    for (const candidate of candidates) {
      const phone = normalizePhone(candidate);
      if (phone) return phone;
    }
    return '';
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        name: String(item?.name || item?.name_dari || 'Item').trim(),
        quantity: Math.max(1, Number(item?.quantity ?? item?.qty ?? 1) || 1),
        price: Number(item?.price || 0) || 0
      }))
      .filter((item) => item.name);
  }

  function formatPrice(value) {
    return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function waOrderLink(phone, restaurantName, items, customerName, address) {
    const digits = normalizePhone(phone);
    if (!digits) return '';

    const orderItems = normalizeItems(items);
    const lines = [
      `Afghan Eats order — ${String(restaurantName || 'Restaurant').trim() || 'Restaurant'}`,
      '',
      'Items:'
    ];

    if (orderItems.length) {
      orderItems.forEach((item) => {
        const lineTotal = item.price * item.quantity;
        lines.push(`- ${item.quantity} × ${item.name} — AFN ${formatPrice(lineTotal)}`);
      });
    } else {
      lines.push('- No items selected');
    }

    lines.push(
      '',
      `Customer: ${String(customerName || '').trim() || 'Not provided'}`,
      `Address: ${String(address || '').trim() || 'Not provided'}`,
      'Payment: Cash on delivery'
    );

    return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function storedCustomerName() {
    try {
      const hint = JSON.parse(localStorage.getItem('ae_customer_hint') || 'null');
      return String(hint?.name || '').trim();
    } catch {
      return '';
    }
  }

  function storedAddress() {
    const active = String(localStorage.getItem('ae_address') || '').trim();
    if (active) return active;

    try {
      const addresses = JSON.parse(localStorage.getItem('ae_addresses') || '[]');
      const chosen = Array.isArray(addresses)
        ? (addresses.find((item) => item?.is_default) || addresses[0])
        : null;
      return [chosen?.district, chosen?.address, chosen?.landmark]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ');
    } catch {
      return '';
    }
  }

  function updateButton({ restaurant, restaurantName, items, customerName, address } = {}) {
    const button = document.getElementById('waOrderBtn');
    if (!button) return '';

    const phone = resolvePhone(restaurant);
    button.hidden = !phone;
    button.style.display = phone ? '' : 'none';
    button.style.display = phone ? '' : 'none';
    const orderItems = normalizeItems(items);
    const link = orderItems.length
      ? waOrderLink(
          phone,
          restaurantName || restaurant?.name_dari || restaurant?.name || '',
          orderItems,
          customerName || storedCustomerName(),
          address || storedAddress()
        )
      : '';

    if (!link) {
      button.removeAttribute('href');
      button.removeAttribute('target');
      button.setAttribute('aria-disabled', 'true');
      button.style.pointerEvents = 'none';
      button.style.opacity = '0.55';
      return '';
    }

    button.href = link;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.setAttribute('aria-disabled', 'false');
    button.style.pointerEvents = '';
    button.style.opacity = '';
    return link;
  }

  global.AfghanEatsWhatsApp = {
    waOrderLink,
    updateButton
  };
})(window);
