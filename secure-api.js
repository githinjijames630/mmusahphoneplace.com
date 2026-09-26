(() => {
  if (window.location.protocol === 'file:') return;

  const mapProduct = (product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand || '',
    category: product.category || 'General',
    condition: product.condition || '',
    specs: product.specs || '',
    image: product.image || product.image_path || '',
    cost: Number(product.cost_price || product.cost || 0),
    price: Number(product.selling_price || product.price || 0),
    discountPercent: Number(product.discount_percent || product.discountPercent || 0),
    stock: Number(product.stock || 0),
    status: product.status || 'Available',
    serial: product.serial || '',
    imei1: product.imei1 || '',
    imei2: product.imei2 || '',
    barcode: product.barcode || '',
    supplier: product.supplier || '',
    receivedDate: product.received_date || ''
  });

  const mapSale = (sale) => ({
    id: sale.id,
    product: sale.product_name || 'Unnamed product',
    customer: sale.customer_name || 'Walk-in customer',
    paid: Number(sale.amount_paid || 0),
    cost: Number(sale.cost_at_sale || 0),
    date: String(sale.sold_at || '').slice(0, 10),
    customerPhone: sale.customer_phone || '',
    paymentMethod: sale.payment_method || '',
    reference: sale.transaction_reference || '',
    soldAt: sale.sold_at || ''
  });

  const mapExpense = (expense) => ({
    id: expense.id,
    description: expense.description || '',
    category: expense.category || '',
    amount: Number(expense.amount || 0),
    date: expense.expense_date || ''
  });

  async function loadProducts() {
    const ownerPage = /owner\.html$/i.test(window.location.pathname);
    const authenticated = ownerPage ? (await fetch('/api/auth/me', { credentials: 'same-origin' })).ok : true;
    if (!authenticated) return;
    const response = await fetch(ownerPage ? '/api/owner/products' : '/api/products', { credentials: 'same-origin' });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.products) || !window.state) return;
    window.secureApiActive = true;
    window.state.products = payload.products.map(mapProduct);
    if (ownerPage) {
      const [salesResponse, expensesResponse] = await Promise.all([
        fetch('/api/owner/sales', { credentials: 'same-origin' }),
        fetch('/api/owner/expenses', { credentials: 'same-origin' })
      ]);
      if (salesResponse.ok && expensesResponse.ok) {
        const [salesPayload, expensesPayload] = await Promise.all([salesResponse.json(), expensesResponse.json()]);
        window.state.sales = Array.isArray(salesPayload.sales) ? salesPayload.sales.map(mapSale) : [];
        window.state.expenses = Array.isArray(expensesPayload.expenses) ? expensesPayload.expenses.map(mapExpense) : [];
      }
    }
    window.renderPublic?.();
    window.renderOwner?.();
    window.renderInventory?.();
    window.renderSales?.();
    window.renderExpenses?.();
    window.renderOwner?.();
  }

  async function saveProduct(form) {
    const data = Object.fromEntries(new FormData(form));
    const product = new FormData();
    ['name', 'category', 'condition', 'specs', 'supplier', 'serial', 'imei1', 'imei2', 'receivedDate', 'barcode', 'status'].forEach((field) => product.append(field, data[field] || (field === 'status' ? 'Available' : '')));
    product.append('stock', String(Number(data.stock)));
    product.append('costPrice', String(Number(data.cost)));
    product.append('sellingPrice', String(Number(data.price)));
    product.append('discountPercent', String(Number(data.discountPercent || data.discount || 0)));
    if (data.image instanceof File && data.image.size > 0) product.append('image', data.image);
    const editingId = form.dataset.editingProduct;
    const response = await fetch(editingId ? `/api/owner/products/${editingId}` : '/api/owner/products', {
      method: editingId ? 'PATCH' : 'POST',
      credentials: 'same-origin',
      body: product
    });
    if (!response.ok) throw new Error('Inventory update failed');
    form.removeAttribute('data-editing-product');
    window.closeModal?.();
    await loadProducts();
    window.showToast?.(editingId ? 'Product updated securely' : 'Product added securely');
  }

  async function saveSale(form) {
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/owner/sales', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: Number(data.product),
        customerName: data.customer,
        customerPhone: data.customerPhone,
        amountPaid: Number(data.paid),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        soldAt: data.soldAt ? new Date(data.soldAt).toISOString() : null
      })
    });
    if (!response.ok) throw new Error('Sale update failed');
    window.closeModal?.();
    await loadProducts();
    window.showToast?.('Sale recorded securely');
  }

  async function saveExpense(form) {
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/owner/expenses', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: data.description,
        category: data.category,
        amount: Number(data.amount),
        expenseDate: data.date
      })
    });
    if (!response.ok) throw new Error('Expense update failed');
    window.closeModal?.();
    await loadProducts();
    window.showToast?.('Expense recorded securely');
  }

  document.addEventListener('submit', (event) => {
    if (!window.secureApiActive || event.target.id !== 'modalForm' || document.querySelector('#modalEyebrow')?.textContent !== 'INVENTORY') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveProduct(event.target).catch(() => window.showToast?.('Could not save product to the server'));
  }, true);

  document.addEventListener('submit', (event) => {
    if (!window.secureApiActive || event.target.id !== 'modalForm') return;
    const eyebrow = document.querySelector('#modalEyebrow')?.textContent;
    if (eyebrow !== 'SALES LOG' && eyebrow !== 'EXPENSES') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const save = eyebrow === 'SALES LOG' ? saveSale : saveExpense;
    save(event.target).catch(() => window.showToast?.(`Could not save ${eyebrow === 'SALES LOG' ? 'sale' : 'expense'} to the server`));
  }, true);

  document.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-product]');
    if (!window.secureApiActive || !deleteButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const productId = deleteButton.dataset.deleteProduct;
    fetch(`/api/owner/products/${productId}`, { method: 'DELETE', credentials: 'same-origin' })
      .then((response) => { if (!response.ok) throw new Error('Archive failed'); return loadProducts(); })
      .then(() => window.showToast?.('Product archived securely'))
      .catch(() => window.showToast?.('Could not archive product on the server'));
  }, true);

  window.addEventListener('secure-owner-login', loadProducts);
  window.addEventListener('DOMContentLoaded', () => setTimeout(loadProducts, 0));
})();
