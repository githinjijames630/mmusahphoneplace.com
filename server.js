import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import dotenv from 'dotenv';
import database, { databasePath } from './server/database.js';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();

const app = express();
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(rootDirectory, 'data', 'uploads');
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;
const passwordHash = process.env.OWNER_PASSWORD_HASH;
const isProduction = process.env.NODE_ENV === 'production';
const sessions = new Map();
fs.mkdirSync(uploadDirectory, { recursive: true });

const productUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('INVALID_IMAGE_TYPE'));
    return callback(null, true);
  }
});

if (isProduction && (!sessionSecret || !passwordHash)) {
  throw new Error('SESSION_SECRET and OWNER_PASSWORD_HASH are required in production.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.googleapis.com'],
      formAction: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(password, storedHash) {
  const [salt, expectedKey] = String(storedHash || '').split('$');
  if (!salt || !expectedKey) return false;
  const actualKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeEqual(actualKey, expectedKey);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { expiresAt: Date.now() + 30 * 60 * 1000 });
  return token;
}

function ownerOnly(request, response, next) {
  const token = request.headers.cookie?.match(/(?:^|; )musah_owner_session=([^;]+)/)?.[1];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return response.status(401).json({ error: 'Owner authentication required.' });
  }
  session.expiresAt = Date.now() + 30 * 60 * 1000;
  request.owner = true;
  next();
}

const publicProductFields = 'id, name, brand, category, condition, specs, image_path AS image, selling_price AS price, discount_percent AS discountPercent, stock, status';
const productStatuses = new Set(['Available', 'Reserved', 'Archived']);

function productInput(body) {
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 60) : '';
  const stock = Number(body?.stock);
  const costPrice = Number(body?.costPrice ?? body?.cost);
  const sellingPrice = Number(body?.sellingPrice ?? body?.price);
  const discountPercent = Number(body?.discountPercent ?? body?.discount ?? 0);
  if (!name || !category || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(costPrice) || costPrice < 0 || !Number.isInteger(sellingPrice) || sellingPrice < 0 || !Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;
  const status = productStatuses.has(body.status) ? body.status : 'Available';
  return {
    name,
    brand: typeof body.brand === 'string' ? body.brand.trim().slice(0, 80) : '',
    category,
    condition: typeof body.condition === 'string' ? body.condition.trim().slice(0, 160) : '',
    specs: typeof body.specs === 'string' ? body.specs.trim().slice(0, 1000) : '',
    imagePath: typeof body.imagePath === 'string' && body.imagePath.startsWith('/uploads/') ? body.imagePath.trim().slice(0, 500) : '',
    costPrice,
    sellingPrice,
    discountPercent,
    stock,
    status,
    serial: typeof body.serial === 'string' ? body.serial.trim().slice(0, 120) : '',
    imei1: typeof body.imei1 === 'string' ? body.imei1.trim().slice(0, 30) : '',
    imei2: typeof body.imei2 === 'string' ? body.imei2.trim().slice(0, 30) : '',
    barcode: typeof body.barcode === 'string' ? body.barcode.trim().slice(0, 120) : '',
    supplier: typeof body.supplier === 'string' ? body.supplier.trim().slice(0, 120) : '',
    receivedDate: typeof body.receivedDate === 'string' ? body.receivedDate.trim().slice(0, 30) : ''
  };
}

function saveProductImage(file) {
  if (!file) return '';
  const signatures = [
    { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], extension: 'jpg' },
    { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47], extension: 'png' },
    { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], extension: 'webp' }
  ];
  const signature = signatures.find((item) => item.type === file.mimetype && item.bytes.every((value, index) => file.buffer[index] === value));
  if (!signature || (signature.type === 'image/webp' && file.buffer.toString('ascii', 8, 12) !== 'WEBP')) throw new Error('INVALID_IMAGE');
  const filename = `${crypto.randomUUID()}.${signature.extension}`;
  fs.writeFileSync(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

function recordAudit(action, recordType, recordId, metadata = {}) {
  database.prepare('INSERT INTO audit_events (action, record_type, record_id, metadata_json) VALUES (?, ?, ?, ?)').run(action, recordType, recordId, JSON.stringify(metadata));
}

app.get('/api/products', (_request, response) => {
  const products = database.prepare(`SELECT ${publicProductFields} FROM products WHERE stock > 0 AND status != 'Archived' ORDER BY updated_at DESC`).all();
  return response.json({ products });
});

app.get('/api/owner/products', ownerOnly, (_request, response) => {
  const products = database.prepare('SELECT * FROM products ORDER BY updated_at DESC').all();
  return response.json({ products });
});

app.post('/api/owner/products', ownerOnly, productUpload.single('image'), (request, response) => {
  const product = productInput(request.body);
  if (!product) return response.status(400).json({ error: 'Invalid product details.' });
  try {
    product.imagePath = saveProductImage(request.file) || product.imagePath;
  } catch (error) {
    if (error.message === 'INVALID_IMAGE') return response.status(400).json({ error: 'Unsupported or invalid image.' });
    throw error;
  }
  const result = database.prepare(`INSERT INTO products (name, brand, category, condition, specs, image_path, cost_price, selling_price, discount_percent, stock, status, serial, imei1, imei2, barcode, supplier, received_date) VALUES (@name, @brand, @category, @condition, @specs, @imagePath, @costPrice, @sellingPrice, @discountPercent, @stock, @status, @serial, @imei1, @imei2, @barcode, @supplier, @receivedDate)`).run(product);
  recordAudit('create', 'product', result.lastInsertRowid, { name: product.name, discountPercent: product.discountPercent });
  return response.status(201).json({ id: result.lastInsertRowid });
});

app.patch('/api/owner/products/:id', ownerOnly, productUpload.single('image'), (request, response) => {
  const id = Number(request.params.id);
  const product = productInput(request.body);
  if (!Number.isInteger(id) || id < 1 || !product) return response.status(400).json({ error: 'Invalid product details.' });
  const existing = database.prepare('SELECT image_path FROM products WHERE id=?').get(id);
  if (!existing) return response.status(404).json({ error: 'Product not found.' });
  try {
    product.imagePath = saveProductImage(request.file) || product.imagePath || existing.image_path || '';
  } catch (error) {
    if (error.message === 'INVALID_IMAGE') return response.status(400).json({ error: 'Unsupported or invalid image.' });
    throw error;
  }
  const result = database.prepare(`UPDATE products SET name=@name, brand=@brand, category=@category, condition=@condition, specs=@specs, image_path=@imagePath, cost_price=@costPrice, selling_price=@sellingPrice, discount_percent=@discountPercent, stock=@stock, status=@status, serial=@serial, imei1=@imei1, imei2=@imei2, barcode=@barcode, supplier=@supplier, received_date=@receivedDate, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...product, id });
  if (!result.changes) return response.status(404).json({ error: 'Product not found.' });
  recordAudit('update', 'product', id, { name: product.name });
  return response.status(204).end();
});

app.delete('/api/owner/products/:id', ownerOnly, (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: 'Invalid product id.' });
  const result = database.prepare("UPDATE products SET status='Archived', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  if (!result.changes) return response.status(404).json({ error: 'Product not found.' });
  recordAudit('archive', 'product', id);
  return response.status(204).end();
});

app.get('/api/owner/sales', ownerOnly, (_request, response) => {
  const sales = database.prepare('SELECT sales.*, products.name AS product_name FROM sales JOIN products ON products.id = sales.product_id ORDER BY sales.sold_at DESC').all();
  return response.json({ sales });
});

app.post('/api/owner/sales', ownerOnly, (request, response) => {
  const productId = Number(request.body?.productId ?? request.body?.product);
  const customerName = typeof request.body?.customerName === 'string' ? request.body.customerName.trim().slice(0, 120) : '';
  const customerPhone = typeof request.body?.customerPhone === 'string' ? request.body.customerPhone.trim().slice(0, 30) : '';
  const amountPaid = Number(request.body?.amountPaid ?? request.body?.paid);
  const paymentMethod = typeof request.body?.paymentMethod === 'string' ? request.body.paymentMethod.trim().slice(0, 40) : '';
  const reference = typeof request.body?.reference === 'string' ? request.body.reference.trim().slice(0, 80) : '';
  if (!Number.isInteger(productId) || productId < 1 || !customerName || !Number.isInteger(amountPaid) || amountPaid < 0 || !paymentMethod) return response.status(400).json({ error: 'Invalid sale details.' });
  try {
    const saleId = database.transaction(() => {
      const product = database.prepare('SELECT id, name, stock, cost_price FROM products WHERE id=? AND status != \'Archived\'').get(productId);
      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      if (product.stock < 1) throw new Error('OUT_OF_STOCK');
      const result = database.prepare('INSERT INTO sales (product_id, customer_name, customer_phone, amount_paid, payment_method, transaction_reference, cost_at_sale, sold_at) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))').run(productId, customerName, customerPhone, amountPaid, paymentMethod, reference, product.cost_price, request.body?.soldAt || null);
      database.prepare('UPDATE products SET stock=stock-1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(productId);
      recordAudit('create', 'sale', result.lastInsertRowid, { productId, productName: product.name });
      return result.lastInsertRowid;
    })();
    return response.status(201).json({ id: saleId });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') return response.status(404).json({ error: 'Product not found.' });
    if (error.message === 'OUT_OF_STOCK') return response.status(409).json({ error: 'Product is out of stock.' });
    throw error;
  }
});

app.get('/api/owner/expenses', ownerOnly, (_request, response) => {
  const expenses = database.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC').all();
  return response.json({ expenses });
});

app.post('/api/owner/expenses', ownerOnly, (request, response) => {
  const description = typeof request.body?.description === 'string' ? request.body.description.trim().slice(0, 160) : '';
  const category = typeof request.body?.category === 'string' ? request.body.category.trim().slice(0, 60) : '';
  const amount = Number(request.body?.amount);
  const expenseDate = typeof request.body?.expenseDate === 'string' ? request.body.expenseDate.trim().slice(0, 30) : '';
  if (!description || !category || !Number.isInteger(amount) || amount < 0 || !expenseDate) return response.status(400).json({ error: 'Invalid expense details.' });
  const result = database.prepare('INSERT INTO expenses (description, category, amount, expense_date) VALUES (?, ?, ?, ?)').run(description, category, amount, expenseDate);
  recordAudit('create', 'expense', result.lastInsertRowid, { description, amount });
  return response.status(201).json({ id: result.lastInsertRowid });
});

app.get('/api/health', (_request, response) => response.json({ ok: true, database: database.open ? 'connected' : 'unavailable', databasePath }));

app.use('/uploads', express.static(uploadDirectory, { fallthrough: false }));

app.use((error, _request, response, next) => {
  if (error.message === 'INVALID_IMAGE_TYPE' || error.code === 'LIMIT_FILE_SIZE') return response.status(400).json({ error: 'Use a JPEG, PNG, or WebP image up to 5 MB.' });
  return next(error);
});

app.post('/api/auth/login', loginLimiter, (request, response) => {
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  if (!passwordHash || !verifyPassword(password, passwordHash)) {
    return response.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = createSession();
  response.setHeader('Set-Cookie', `musah_owner_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${isProduction ? '; Secure' : ''}`);
  return response.status(204).end();
});

app.post('/api/auth/logout', ownerOnly, (request, response) => {
  const token = request.headers.cookie?.match(/(?:^|; )musah_owner_session=([^;]+)/)?.[1];
  if (token) sessions.delete(token);
  response.setHeader('Set-Cookie', 'musah_owner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  return response.status(204).end();
});

app.get('/api/auth/me', ownerOnly, (_request, response) => response.json({ authenticated: true }));

app.use(express.static(rootDirectory, { index: 'index.html', dotfiles: 'deny' }));

app.listen(port, () => {
  console.log(`Musah Mobiles server listening on http://localhost:${port}`);
});
