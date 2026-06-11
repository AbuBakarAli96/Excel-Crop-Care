require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'excel2026';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'excel_crop_care.sqlite');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(PUBLIC_DIR));

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function ensureColumn(table, column, definition){
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
  if(!cols.includes(column)){
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}


function initDb(){
  db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    cat TEXT NOT NULL,
    name TEXT NOT NULL,
    urdu TEXT,
    wt TEXT,
    price REAL NOT NULL DEFAULT 0,
    comp TEXT,
    shape TEXT,
    hot INTEGER DEFAULT 0,
    disc REAL DEFAULT 0,
    img TEXT,
    realProductPhoto INTEGER DEFAULT 0,
    realPhotoSource TEXT,
    stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    date TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    subtotal REAL DEFAULT 0,
    delivery REAL DEFAULT 0,
    total REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'COD',
    status TEXT DEFAULT 'New',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER,
    name TEXT NOT NULL,
    category TEXT,
    price REAL DEFAULT 0,
    qty INTEGER DEFAULT 1,
    img TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS media_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    style TEXT DEFAULT 'dark',
    bg_img TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    end_date TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS deal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    deal_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(deal_id) REFERENCES deals(id) ON DELETE CASCADE
  );
  `);

  ensureColumn('products','stock_status',"TEXT DEFAULT 'in'");
  ensureColumn('products','out_of_stock',"INTEGER DEFAULT 0");
  ensureColumn('products','p_carton',"TEXT DEFAULT ''");
  ensureColumn('products','p_carton_qty',"INTEGER DEFAULT 1");
  ensureColumn('orders','payment_status',"TEXT DEFAULT 'Pending'");
  ensureColumn('orders','transaction_id',"TEXT DEFAULT ''");
  ensureColumn('orders','payment_note',"TEXT DEFAULT ''");
  ensureColumn('orders','payment_proof_url',"TEXT DEFAULT ''");
  ensureColumn('orders','transport_name',"TEXT DEFAULT ''");
  ensureColumn('orders','transport_city',"TEXT DEFAULT ''");
  ensureColumn('orders','transport_note',"TEXT DEFAULT ''");

  const defaultSettings = {
    company_name:'Excel Crop Care',
    company_urdu:'ایکسَل کراپ کیئر',
    slogan_urdu:'ایکسَل اور کسان، خوشحال پاکستان',
    phone:'061-6537203',
    whatsapp:'923000000000',
    address:'Plot 228-229, Phase-II, Industrial Estate, Multan',
    announcement:'🚚 پاکستان بھر میں ترسیل | Free Delivery Rs.2000+',
    logo_url:'',
    hero_background_url:'',
    expert_image_url:'',
    footer_about:'Excel Crop Care provides genuine agricultural products and farmer support.',
    return_policy:'7-day return window for wrong or damaged product with invoice and photo proof.',
    terms_conditions:'Use products according to label directions. Prices and availability may change before order confirmation.',
    faq_text:'FAQ: Delivery, returns, payment methods and product guidance are available through customer support.',
    free_delivery_formula:'Free delivery on orders Rs.2000+',
    customer_support_text:'WhatsApp support available Mon-Sat for orders, crop photos and policy questions.',
    bank_name:'Bank Transfer',
    account_title:'Excel Crop Care',
    account_number:'',
    iban:'',
    branch_city:'Multan',
    bank_note:'Upload payment screenshot after bank transfer. Admin will verify and mark payment as paid.'
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings(key,value) VALUES(?,?)');
  Object.entries(defaultSettings).forEach(([k,v])=>insertSetting.run(k,v));

  const admin = db.prepare('SELECT id FROM admins WHERE username=?').get(ADMIN_USERNAME);
  if(!admin){
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(ADMIN_USERNAME, hash);
    console.log(`Seeded admin: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if(count === 0){
    const seedPath = path.join(DATA_DIR, 'products.seed.json');
    if(fs.existsSync(seedPath)){
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const insert = db.prepare(`INSERT INTO products(id,cat,name,urdu,wt,price,comp,shape,hot,disc,img,realProductPhoto,realPhotoSource,stock)
        VALUES(@id,@cat,@name,@urdu,@wt,@price,@comp,@shape,@hot,@disc,@img,@realProductPhoto,@realPhotoSource,@stock)`);
      const tx = db.transaction((rows)=>{
        rows.forEach(p=>insert.run({
          id:p.id, cat:p.cat||'', name:p.name||'', urdu:p.urdu||'', wt:p.wt||'', price:Number(p.price)||0,
          comp:p.comp||'', shape:p.shape||'', hot:p.hot?1:0, disc:Number(p.disc)||0, img:p.img||'',
          realProductPhoto:p.realProductPhoto?1:0, realPhotoSource:p.realPhotoSource||'', stock:p.stock||0
        }));
      });
      tx(seed);
      console.log(`Seeded ${seed.length} products into database.`);
    }
  }
}
initDb();

const DEFAULT_PCARTON = {"1": "50", "2": "20", "3": "10", "4": "40", "5": "20", "6": "12", "7": "3", "8": "40", "9": "50", "10": "2", "11": "20", "12": "12", "13": "40", "14": "12", "15": "30", "16": "40", "17": "12", "18": "50", "19": "20", "20": "12", "21": "60", "22": "4", "23": "70", "24": "50", "25": "12", "26": "40", "27": "12", "28": "40", "29": "20", "30": "50", "31": "20", "32": "12", "33": "3", "34": "20", "35": "20", "36": "20", "37": "12", "38": "BAG", "39": "BAG", "40": "BAG", "41": "BAG", "42": "BAG", "43": "BAG", "44": "BAG", "45": "15", "46": "8", "47": "BAG", "48": "12", "49": "30", "50": "12", "51": "12", "52": "CAN", "53": "CAN", "54": "CAN", "55": "DRUM", "56": "12", "57": "4", "58": "6", "59": "CAN", "60": "DRUM", "61": "CAN", "62": "CAN", "63": "40", "64": "12", "65": "12", "66": "12", "67": "20", "68": "30", "69": "12", "70": "20", "71": "80", "72": "15", "73": "20", "74": "40", "75": "10", "76": "100", "77": "20", "78": "12", "79": "12", "80": "20", "81": "20", "82": "12", "83": "40", "84": "100", "85": "20", "86": "20", "87": "12", "88": "12", "89": "20", "90": "40", "91": "8", "92": "20", "93": "40", "94": "30", "95": "30", "96": "40", "97": "15", "98": "BAG", "99": "8", "100": "20", "101": "BAG", "102": "BAG", "103": "BAG", "104": "BAG", "105": "BAG", "106": "BAG"};
function cartonQtyFromValue(v){ const n=parseInt(v,10); return Number.isFinite(n)&&n>0?n:1; }
function seedPCarton(){ const stmt=db.prepare('UPDATE products SET p_carton=?, p_carton_qty=? WHERE id=? AND (p_carton IS NULL OR p_carton=\'\')'); Object.entries(DEFAULT_PCARTON).forEach(([id,v])=>stmt.run(String(v), cartonQtyFromValue(v), Number(id))); }

seedPCarton();

function productRowToClient(p){
  return {
    id:p.id, cat:p.cat, name:p.name, urdu:p.urdu, wt:p.wt, price:p.price, comp:p.comp,
    shape:p.shape, hot:!!p.hot, disc:p.disc, img:p.img, realProductPhoto:!!p.realProductPhoto,
    realPhotoSource:p.realPhotoSource, stock:p.stock, stock_status:p.stock_status||'in', stockStatus:p.stock_status||'in', outOfStock:!!(p.out_of_stock), p_carton:p.p_carton||'', pCarton:p.p_carton||'', p_carton_qty:p.p_carton_qty||1, pCartonQty:p.p_carton_qty||1
  };
}

function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({error:'Missing admin token'});
  try{ req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({error:'Invalid or expired token'}); }
}

const storage = multer.diskStorage({
  destination: (req,file,cb)=>cb(null, UPLOAD_DIR),
  filename: (req,file,cb)=>{
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').slice(0,60);
    cb(null, `${Date.now()}-${safe}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req,file,cb)=>{
    if(!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});


function getSettings(){
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}
function setSetting(key,value){
  db.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(String(key), String(value ?? ''));
}
function dealRowToClient(d){
  const items = db.prepare(`SELECT di.product_id, di.deal_price, p.name, p.cat, p.wt, p.price, p.comp, p.img
    FROM deal_items di LEFT JOIN products p ON p.id=di.product_id WHERE di.deal_id=? ORDER BY di.id ASC`).all(d.id);
  return {id:d.id,title:d.title,description:d.description,style:d.style,bg_img:d.bg_img,active:!!d.active,end_date:d.end_date,items};
}


function savePaymentProofFromBody(body){
  const proof = body.paymentProof || body.payment_proof || body.proof || {};
  const data = typeof proof === 'string' ? proof : (proof.data || '');
  if(!data || !String(data).startsWith('data:image/')) return '';
  const match = String(data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if(!match) return '';
  const mime = match[1].toLowerCase();
  const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : mime.includes('gif') ? '.gif' : '.jpg';
  const filename = `payment-proof-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], 'base64'));
  return `/uploads/${filename}`;
}
function boolFromBody(v){
  return v === true || v === 'true' || v === '1' || v === 1 || String(v).toLowerCase()==='out';
}

// Public API
app.get('/api/health', (req,res)=>res.json({ok:true, app:'Excel Crop Care Backend v12'}));
app.get('/api/products', (req,res)=>{
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  res.json(rows.map(productRowToClient));
});
app.get('/api/products/:id', (req,res)=>{
  const row = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if(!row) return res.status(404).json({error:'Product not found'});
  res.json(productRowToClient(row));
});
app.post('/api/orders', upload.single('payment_proof'), (req,res)=>{
  const body = req.body || {};
  const customer = body.customer || {};
  const flatCustomer = {
    name: body.name || body.customer_name || customer.name || '',
    phone: body.phone || customer.phone || '',
    city: body.city || customer.city || '',
    address: body.address || customer.address || ''
  };

  let items = body.items || [];
  if(typeof items === 'string'){
    try{ items = JSON.parse(items); }catch(e){ items = []; }
  }

  const subtotal = Number(body.subtotal || 0);
  const delivery = Number(body.delivery || 0);
  const total = Number(body.total || subtotal + delivery || 0);
  const payment_method = body.payment_method || body.paymentMethod || 'Bank Transfer';
  const payment_status = body.payment_status || body.paymentStatus || 'Pending';
  const transaction_id = body.transaction_id || body.transactionId || '';
  const payment_note = body.payment_note || body.paymentNote || '';
  const transport_name = body.transport_name || body.transportName || body.cargo_center || '';
  const transport_city = body.transport_city || body.transportCity || '';
  const transport_note = body.transport_note || body.transportNote || '';

  if(!flatCustomer.name || !flatCustomer.phone || !flatCustomer.city || !flatCustomer.address){
    return res.status(400).json({error:'Customer name, phone, city and address are required'});
  }
  if(!Array.isArray(items) || items.length === 0){
    return res.status(400).json({error:'Order items are required'});
  }

  let proofUrl = '';
  if(req.file) proofUrl = `/uploads/${req.file.filename}`;
  else proofUrl = savePaymentProofFromBody(body);

  const id = body.id || ('ECC-' + Date.now());
  const date = body.date || new Date().toLocaleDateString('en-PK');

  const tx = db.transaction(()=>{
    db.prepare(`INSERT OR REPLACE INTO orders(id,date,customer_name,phone,city,address,subtotal,delivery,total,payment_method,status,payment_status,transaction_id,payment_note,payment_proof_url,transport_name,transport_city,transport_note)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,date,flatCustomer.name,flatCustomer.phone,flatCustomer.city,flatCustomer.address,subtotal,delivery,total,payment_method,body.status || 'New',payment_status,transaction_id,payment_note,proofUrl,transport_name,transport_city,transport_note);

    db.prepare('DELETE FROM order_items WHERE order_id=?').run(id);
    const itemStmt = db.prepare(`INSERT INTO order_items(order_id,product_id,name,category,price,qty,img) VALUES(?,?,?,?,?,?,?)`);
    items.forEach(it=>itemStmt.run(id,it.product_id||it.id||null,it.name||it.n||'Product',it.category||it.cat||'',Number(it.price)||0,Number(it.qty)||1,it.img||''));
  });
  tx();
  res.status(201).json({ok:true, order:buildOrder(id)});
});


app.get('/api/site/settings', (req,res)=>res.json(getSettings()));
app.get('/api/deals', (req,res)=>{
  const where = req.query.all === '1' ? '' : 'WHERE active=1';
  const rows = db.prepare(`SELECT * FROM deals ${where} ORDER BY id DESC`).all();
  res.json(rows.map(dealRowToClient));
});

// Admin API
app.post('/api/admin/login', (req,res)=>{
  const {username,password} = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username || '');
  if(!admin || !bcrypt.compareSync(password || '', admin.password_hash)) return res.status(401).json({error:'Invalid username or password'});
  const token = jwt.sign({id:admin.id, username:admin.username}, JWT_SECRET, {expiresIn:'8h'});
  res.json({ok:true, token, admin:{id:admin.id, username:admin.username}});
});
app.get('/api/admin/me', auth, (req,res)=>res.json({ok:true, admin:req.admin}));

app.get('/api/admin/products', auth, (req,res)=>{
  res.json(db.prepare('SELECT * FROM products ORDER BY id ASC').all().map(productRowToClient));
});
app.post('/api/admin/products', auth, upload.single('image'), (req,res)=>{
  const body = req.body || {};
  const nextId = (db.prepare('SELECT MAX(id) AS m FROM products').get().m || 0) + 1;
  const img = req.file ? `/uploads/${req.file.filename}` : (body.img || '');
  const stockStatus = body.stock_status || body.stockStatus || (body.outOfStock==='1'||body.outOfStock==='true' ? 'out' : 'in');
  const pCarton = body.p_carton || body.pCarton || DEFAULT_PCARTON[nextId] || '';
  const pCartonQty = cartonQtyFromValue(pCarton);
  db.prepare(`INSERT INTO products(id,cat,name,urdu,wt,price,comp,shape,hot,disc,img,realProductPhoto,realPhotoSource,stock,stock_status,out_of_stock,p_carton,p_carton_qty)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(nextId,body.cat||'Insecticides',body.name||'New Product',body.urdu||'',body.wt||'',Number(body.price)||0,body.comp||'',body.shape||'bottle',body.hot==='true'||body.hot==='1'?1:0,Number(body.disc)||0,img,req.file?1:0,req.file?'admin uploaded product photo':body.realPhotoSource||'',Number(body.stock)||0,stockStatus,stockStatus==='out'?1:0,pCarton,pCartonQty);
  res.status(201).json({ok:true, product:productRowToClient(db.prepare('SELECT * FROM products WHERE id=?').get(nextId))});
});
app.put('/api/admin/products/:id', auth, upload.single('image'), (req,res)=>{
  const existing = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if(!existing) return res.status(404).json({error:'Product not found'});
  const b = req.body || {};
  const img = req.file ? `/uploads/${req.file.filename}` : (b.img !== undefined ? b.img : existing.img);
  const stockStatus = b.stock_status || b.stockStatus || (b.outOfStock==='1'||b.outOfStock==='true' ? 'out' : (existing.stock_status || 'in'));
  const pCarton = b.p_carton || b.pCarton || existing.p_carton || DEFAULT_PCARTON[req.params.id] || '';
  const pCartonQty = cartonQtyFromValue(pCarton);
  db.prepare(`UPDATE products SET cat=?,name=?,urdu=?,wt=?,price=?,comp=?,shape=?,hot=?,disc=?,img=?,realProductPhoto=?,realPhotoSource=?,stock=?,stock_status=?,out_of_stock=?,p_carton=?,p_carton_qty=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(b.cat||existing.cat,b.name||existing.name,b.urdu??existing.urdu,b.wt??existing.wt,Number(b.price??existing.price),b.comp??existing.comp,b.shape??existing.shape,(b.hot==='true'||b.hot==='1'||b.hot===true)?1:0,Number(b.disc??existing.disc),img,req.file?1:(b.realProductPhoto==='true'||b.realProductPhoto==='1'||existing.realProductPhoto?1:0),req.file?'admin uploaded product photo':(b.realPhotoSource??existing.realPhotoSource),Number(b.stock??existing.stock),stockStatus,stockStatus==='out'?1:0,pCarton,pCartonQty,req.params.id);
  res.json({ok:true, product:productRowToClient(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id))});
});
app.post('/api/admin/products/:id/image', auth, upload.single('image'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'Image file is required'});
  const img = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE products SET img=?, realProductPhoto=1, realPhotoSource=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(img,'admin uploaded product photo',req.params.id);
  res.json({ok:true, img, product:productRowToClient(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id))});
});
app.delete('/api/admin/products/:id', auth, (req,res)=>{
  const result = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ok:true, deleted:result.changes});
});

function buildOrder(id){
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if(!o) return null;
  const items = db.prepare('SELECT product_id AS id, name, category AS cat, price, qty, img FROM order_items WHERE order_id=?').all(id);
  return {id:o.id,date:o.date,name:o.customer_name,phone:o.phone,city:o.city,address:o.address,items,subtotal:o.subtotal,delivery:o.delivery,total:o.total,status:o.status,payment_method:o.payment_method,paymentMethod:o.payment_method,payment_status:o.payment_status||'Pending',paymentStatus:o.payment_status||'Pending',transaction_id:o.transaction_id||'',transactionId:o.transaction_id||'',payment_note:o.payment_note||'',paymentNote:o.payment_note||'',payment_proof_url:o.payment_proof_url||'',paymentProofUrl:o.payment_proof_url||'',paymentProof:o.payment_proof_url?{url:o.payment_proof_url,data:o.payment_proof_url}:null,transport_name:o.transport_name||'',transportName:o.transport_name||'',transport_city:o.transport_city||'',transportCity:o.transport_city||'',transport_note:o.transport_note||'',transportNote:o.transport_note||'',created_at:o.created_at};
}

app.get('/api/admin/settings', auth, (req,res)=>res.json(getSettings()));
app.put('/api/admin/settings', auth, (req,res)=>{
  const body = req.body || {};
  Object.entries(body).forEach(([k,v])=>setSetting(k,v));
  res.json({ok:true, settings:getSettings()});
});
app.post('/api/admin/settings/upload/:key', auth, upload.single('image'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'Image file is required'});
  const key = req.params.key;
  const allowed = new Set(['logo_url','hero_background_url','expert_image_url']);
  if(!allowed.has(key)) return res.status(400).json({error:'Invalid setting image key'});
  const url = `/uploads/${req.file.filename}`;
  setSetting(key,url);
  db.prepare('INSERT INTO media_library(label,url,type) VALUES(?,?,?)').run(key,url,'image');
  res.json({ok:true, key, url, settings:getSettings()});
});
app.get('/api/admin/media', auth, (req,res)=>{
  res.json(db.prepare('SELECT * FROM media_library ORDER BY id DESC').all());
});
app.post('/api/admin/media', auth, upload.single('image'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'Image file is required'});
  const url = `/uploads/${req.file.filename}`;
  const label = req.body.label || req.file.originalname || 'Uploaded image';
  const info = db.prepare('INSERT INTO media_library(label,url,type) VALUES(?,?,?)').run(label,url,'image');
  res.status(201).json({ok:true, media:{id:info.lastInsertRowid,label,url,type:'image'}});
});

app.get('/api/admin/deals', auth, (req,res)=>{
  const rows = db.prepare('SELECT * FROM deals ORDER BY id DESC').all();
  res.json(rows.map(dealRowToClient));
});
app.post('/api/admin/deals', auth, (req,res)=>{
  const b = req.body || {};
  const info = db.prepare('INSERT INTO deals(title,description,style,bg_img,active,end_date) VALUES(?,?,?,?,?,?)')
    .run(b.title || 'Special Deal', b.description || '', b.style || 'dark', b.bg_img || '', b.active === false || b.active === 0 ? 0 : 1, b.end_date || '');
  const dealId = info.lastInsertRowid;
  const itemStmt = db.prepare('INSERT INTO deal_items(deal_id,product_id,deal_price) VALUES(?,?,?)');
  const items = Array.isArray(b.items) ? b.items : [];
  const tx = db.transaction(()=>{ items.forEach(it=>{ if(it.product_id) itemStmt.run(dealId, Number(it.product_id), Number(it.deal_price)||0); }); });
  tx();
  res.status(201).json({ok:true, deal:dealRowToClient(db.prepare('SELECT * FROM deals WHERE id=?').get(dealId))});
});
app.put('/api/admin/deals/:id', auth, (req,res)=>{
  const existing = db.prepare('SELECT * FROM deals WHERE id=?').get(req.params.id);
  if(!existing) return res.status(404).json({error:'Deal not found'});
  const b = req.body || {};
  db.prepare('UPDATE deals SET title=?,description=?,style=?,bg_img=?,active=?,end_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(b.title || existing.title, b.description ?? existing.description, b.style || existing.style, b.bg_img ?? existing.bg_img, b.active === false || b.active === 0 ? 0 : 1, b.end_date ?? existing.end_date, req.params.id);
  db.prepare('DELETE FROM deal_items WHERE deal_id=?').run(req.params.id);
  const itemStmt = db.prepare('INSERT INTO deal_items(deal_id,product_id,deal_price) VALUES(?,?,?)');
  const items = Array.isArray(b.items) ? b.items : [];
  const tx = db.transaction(()=>{ items.forEach(it=>{ if(it.product_id) itemStmt.run(req.params.id, Number(it.product_id), Number(it.deal_price)||0); }); });
  tx();
  res.json({ok:true, deal:dealRowToClient(db.prepare('SELECT * FROM deals WHERE id=?').get(req.params.id))});
});
app.delete('/api/admin/deals/:id', auth, (req,res)=>{
  db.prepare('DELETE FROM deals WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

app.get('/api/admin/orders', auth, (req,res)=>{
  const rows = db.prepare('SELECT id FROM orders ORDER BY created_at DESC').all();
  res.json(rows.map(r=>buildOrder(r.id)));
});
app.put('/api/admin/orders/:id/status', auth, (req,res)=>{
  const allowed = new Set(['New','Pending','Payment Pending','Payment Verification','Delivery Process','Completed','Cancelled']);
  const status = allowed.has(req.body.status) ? req.body.status : (req.body.status || 'New');
  const paymentStatus = req.body.paymentStatus || req.body.payment_status || null;
  if(paymentStatus){
    db.prepare('UPDATE orders SET status=?, payment_status=? WHERE id=?').run(status, paymentStatus, req.params.id);
  } else {
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  }
  res.json({ok:true, order:buildOrder(req.params.id)});
});
app.get('/api/admin/accounts/summary', auth, (req,res)=>{
  const orders = db.prepare('SELECT * FROM orders').all();
  const items = db.prepare('SELECT oi.*, o.status FROM order_items oi JOIN orders o ON o.id=oi.order_id').all();
  const net = orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+Number(o.total||0),0);
  const completed = orders.filter(o=>o.status==='Completed').reduce((s,o)=>s+Number(o.total||0),0);
  const pending = orders.filter(o=>o.status==='New'||o.status==='Pending').reduce((s,o)=>s+Number(o.total||0),0);
  const cancelled = orders.filter(o=>o.status==='Cancelled').reduce((s,o)=>s+Number(o.total||0),0);
  const units = items.filter(i=>i.status!=='Cancelled').reduce((s,i)=>s+Number(i.qty||0),0);
  const byProduct = {};
  items.filter(i=>i.status!=='Cancelled').forEach(i=>{ const k=i.name; if(!byProduct[k]) byProduct[k]={name:k,qty:0,revenue:0}; byProduct[k].qty+=Number(i.qty||0); byProduct[k].revenue+=Number(i.price||0)*Number(i.qty||1); });
  res.json({orders:orders.length,net,completed,pending,cancelled,units,byProduct:Object.values(byProduct).sort((a,b)=>b.revenue-a.revenue)});
});

app.get('/admin', (req,res)=>res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.use((err,req,res,next)=>res.status(400).json({error:err.message || 'Request failed'}));
app.listen(PORT, ()=>console.log(`Excel Crop Care backend running at http://localhost:${PORT}`));
