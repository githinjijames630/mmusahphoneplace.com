(function () {
  const phoneNumber = '254797933367';
  const detailBackdrop = document.querySelector('#productDetailBackdrop');
  if (!detailBackdrop) return;

  const fields = {
    image: document.querySelector('#productDetailImage'),
    icon: document.querySelector('#productDetailIcon'),
    category: document.querySelector('#productDetailCategory'),
    title: document.querySelector('#productDetailTitle'),
    price: document.querySelector('#productDetailPrice'),
    condition: document.querySelector('#productDetailCondition'),
    specs: document.querySelector('#productDetailSpecs'),
    stock: document.querySelector('#productDetailStock'),
    order: document.querySelector('#productDetailOrder'),
    ask: document.querySelector('#productDetailAsk')
  };
  let selectedProduct = null;

  function money(value) {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function findProduct(card) {
    const name = card.querySelector('h3')?.textContent.trim();
    return window.state?.products?.find((product) => product.name === name) || null;
  }

  function whatsapp(product, prefix) {
    const message = encodeURIComponent(`Hello Musah Mobiles, ${prefix} ${product.name}.`);
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank', 'noopener');
  }

  function openDetails(product) {
    selectedProduct = product;
    const pricing = window.getDiscountInfo ? window.getDiscountInfo(product.price || 0, product.discountPercent || 0) : { finalPrice: Number(product.price || 0), isDiscounted: false, originalPrice: Number(product.price || 0) };
    fields.category.textContent = product.category || 'PRODUCT DETAILS';
    fields.title.textContent = product.name || 'Product';
    fields.price.textContent = pricing.isDiscounted ? `${money(pricing.finalPrice)} (was ${money(pricing.originalPrice)})` : money(pricing.finalPrice);
    fields.condition.textContent = product.condition || 'Condition details available from our team.';
    fields.specs.textContent = product.specs || 'Ask us for full specifications and availability.';
    fields.stock.textContent = product.stock <= 2 ? `Only ${product.stock} left in stock` : 'Available in stock now';
    fields.icon.textContent = product.icon || 'M';
    fields.image.style.backgroundImage = product.image ? `url("${product.image}")` : '';
    fields.image.classList.toggle('has-photo', Boolean(product.image));
    fields.icon.hidden = Boolean(product.image);
    detailBackdrop.classList.remove('hidden');
    document.body.classList.add('product-detail-open');
    fields.order.focus();
  }

  function closeDetails() {
    detailBackdrop.classList.add('hidden');
    document.body.classList.remove('product-detail-open');
    selectedProduct = null;
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest('#publicProductGrid .product-card');
    if (!card || event.target.closest('button')) return;
    const product = findProduct(card);
    if (!product) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDetails(product);
  }, true);

  fields.order.addEventListener('click', () => { if (selectedProduct) whatsapp(selectedProduct, 'I would like to order'); });
  fields.ask.addEventListener('click', () => { if (selectedProduct) whatsapp(selectedProduct, 'I have a question about'); });
  document.querySelector('#productDetailClose').addEventListener('click', closeDetails);
  detailBackdrop.addEventListener('click', (event) => { if (event.target === detailBackdrop) closeDetails(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !detailBackdrop.classList.contains('hidden')) closeDetails(); });
}());