(function (global) {
  'use strict';

  function digitsOnly(phone) {
    return String(phone || '').replace(/\D/g, '');
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
    const digits = digitsOnly(phone);
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

    const phone = restaurant?.whatsapp || restaurant?.whatsapp_number || restaurant?.phone || '';
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
