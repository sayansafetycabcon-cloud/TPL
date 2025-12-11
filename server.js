const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// simple JSON file read/write helpers
function readJSON(name){ 
  const p = path.join(DATA_DIR, name + '.json');
  try{
    if(!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify([])); }
    return JSON.parse(fs.readFileSync(p,'utf8') || '[]');
  }catch(e){ console.error('readJSON error', name, e); return []; }
}
function writeJSON(name, obj){
  const p = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}
// ensure default data if missing
function ensureDefault(name, defaultVal){
  const p = path.join(DATA_DIR, name + '.json');
  if(!fs.existsSync(p)){ fs.writeFileSync(p, JSON.stringify(defaultVal, null, 2)); }
}

// create defaults similar to front-end
ensureDefault('users', [{ username:'admin', password:'admin123', role:'admin' }, { username:'user1', password:'user123', role:'user' }]);
ensureDefault('factories', { "Jangalpur": { fire:0, firstAid:0, manpower:0 }, "Dhulagarh": { fire:0, firstAid:0, manpower:0 }, "Amta": { fire:0, firstAid:0, manpower:0 }, "Panchla": { fire:0, firstAid:0, manpower:0 } });
ensureDefault('notices', [{ id:1, title:'Welcome!', content:'Use the menu above to navigate the HSE Portal.', active:true }]);
ensureDefault('reports', []);
ensureDefault('stats', { accidents:0, last:null });
ensureDefault('ppe', []);
ensureDefault('ppe_logs', []);
ensureDefault('training', { modules: [], records: [] });
ensureDefault('policies', []);
ensureDefault('gallery', []);
ensureDefault('chat', [{ id:1, user:'System', text:'Welcome', time: new Date().toLocaleString() }]);
ensureDefault('ptw', []);
ensureDefault('visitors', []);

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// serve uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// multer config for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random()*1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

// ---------- Generic CRUD helper functions ----------
function getAll(moduleName){
  return readJSON(moduleName);
}
function saveAll(moduleName, arr){
  writeJSON(moduleName, arr);
}
function findById(moduleName, id){
  const list = readJSON(moduleName);
  return list.find(x => Number(x.id) === Number(id));
}
function insertOne(moduleName, obj){
  const list = readJSON(moduleName);
  list.unshift(obj);
  writeJSON(moduleName, list);
  return obj;
}
function updateOne(moduleName, id, patch){
  const list = readJSON(moduleName);
  const idx = list.findIndex(x=>Number(x.id)===Number(id));
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  writeJSON(moduleName, list);
  return list[idx];
}
function deleteOne(moduleName, id){
  let list = readJSON(moduleName);
  const idx = list.findIndex(x=>Number(x.id)===Number(id));
  if(idx===-1) return false;
  list.splice(idx,1);
  writeJSON(moduleName, list);
  return true;
}

// ---------- Notices ----------
app.get('/api/notices', (req,res)=> res.json(getAll('notices')));
app.post('/api/notices', (req,res)=>{
  const body = req.body;
  if(!body.id) body.id = Date.now();
  insertOne('notices', body);
  res.json(body);
});
app.put('/api/notices/:id', (req,res)=>{
  const updated = updateOne('notices', req.params.id, req.body);
  if(!updated) return res.status(404).json({error:'Not found'});
  res.json(updated);
});
app.delete('/api/notices/:id', (req,res)=>{
  const ok = deleteOne('notices', req.params.id);
  if(!ok) return res.status(404).json({error:'Not found'});
  res.json({ok:true});
});

// ---------- Reports ----------
app.get('/api/reports', (req,res)=> res.json(getAll('reports')));
app.post('/api/reports', (req,res)=>{
  const obj = req.body;
  if(!obj.id) obj.id = Date.now();
  insertOne('reports', obj);
  res.json(obj);
});
app.put('/api/reports/:id', (req,res)=>{
  const u = updateOne('reports', req.params.id, req.body);
  if(!u) return res.status(404).json({error:'Not found'});
  res.json(u);
});
app.delete('/api/reports/:id', (req,res)=>{
  if(!deleteOne('reports', req.params.id)) return res.status(404).json({error:'Not found'});
  res.json({ok:true});
});

// ---------- PPE ----------
app.get('/api/ppe', (req,res)=> res.json(getAll('ppe')));
app.post('/api/ppe', (req,res)=>{
  const body = req.body;

  if(body.action){
    const items = readJSON('ppe');

    if(body.action === 'restock'){
      const idx = items.findIndex(x=>Number(x.id)===Number(body.id));
      if(idx!==-1){ 
        items[idx].qty = (items[idx].qty||0) + Number(body.qty||0); 
        writeJSON('ppe', items); 
        return res.json(items[idx]); 
      }
      return res.status(404).json({error:'Item not found'});
    }

    if(body.action === 'issue'){
      const idx = items.findIndex(x=>Number(x.id)===Number(body.id));
      if(idx===-1) return res.status(404).json({error:'Item not found'});
      if((items[idx].qty||0) < Number(body.qty||0)) 
        return res.status(400).json({error:'Insufficient stock'});
      
      items[idx].qty = items[idx].qty - Number(body.qty||0);
      writeJSON('ppe', items);

      const logs = readJSON('ppe_logs');
      logs.unshift({ date: new Date().toISOString(), item: items[idx].name, qty: body.qty, to: body.to || '' });
      writeJSON('ppe_logs', logs);

      return res.json({ ok:true, item: items[idx] });
    }

    return res.status(400).json({error:'Unknown action'});
  }

  if(!body.id) body.id = Date.now();
  insertOne('ppe', body);
  res.json(body);
});
app.put('/api/ppe/:id', (req,res)=>{
  const u = updateOne('ppe', req.params.id, req.body);
  if(!u) return res.status(404).json({error:'Not found'});
  res.json(u);
});
app.delete('/api/ppe/:id', (req,res)=>{
  if(!deleteOne('ppe', req.params.id)) return res.status(404).json({error:'Not found'});
  res.json({ok:true});
});

// ---------- Training ----------
app.get('/api/training', (req,res)=> res.json(readJSON('training')));
app.post('/api/training', (req,res)=>{
  const body = req.body;
  const tr = readJSON('training');

  if(body.action === 'addModule' && body.module){
    const m = body.module; 
    if(!m.id) m.id = Date.now();
    tr.modules.push(m); 
    writeJSON('training', tr); 
    return res.json(tr);
  }

  if(body.action === 'addRecord' && body.record){
    const r = body.record; 
    if(!r.id) r.id = Date.now();
    tr.records.push(r); 
    writeJSON('training', tr); 
    return res.json(tr);
  }

  res.status(400).json({error:'Unsupported action'});
});
app.put('/api/training/:id', (req,res)=>{
  const tr = readJSON('training');
  let idx = tr.modules.findIndex(x=>Number(x.id)===Number(req.params.id));
  if(idx!==-1){ 
    tr.modules[idx] = Object.assign({}, tr.modules[idx], req.body); 
    writeJSON('training', tr); 
    return res.json(tr.modules[idx]); 
  }
  idx = tr.records.findIndex(x=>Number(x.id)===Number(req.params.id));
  if(idx!==-1){ 
    tr.records[idx] = Object.assign({}, tr.records[idx], req.body); 
    writeJSON('training', tr); 
    return res.json(tr.records[idx]); 
  }
  res.status(404).json({error:'Not found'});
});
app.delete('/api/training/:id', (req,res)=>{
  const tr = readJSON('training');
  tr.modules = tr.modules.filter(x=>Number(x.id)!==Number(req.params.id));
  tr.records = tr.records.filter(x=>Number(x.id)!==Number(req.params.id));
  writeJSON('training', tr);
  res.json({ok:true});
});

// ---------- PTW ----------
app.get('/api/ptw', (req,res)=> res.json(readJSON('ptw')));
app.post('/api/ptw', (req,res)=>{
  const body = req.body; 
  if(!body.id) body.id = Date.now();
  insertOne('ptw', body); 
  res.json(body);
});
app.put('/api/ptw/:id', (req,res)=>{
  const u = updateOne('ptw', req.params.id, req.body);
  if(!u) return res.status(404).json({error:'Not found'});
  res.json(u);
});
app.delete('/api/ptw/:id', (req,res)=>{
  if(!deleteOne('ptw', req.params.id)) return res.status(404).json({error:'Not found'});
  res.json({ok:true});
});

// ---------- Visitors ----------
app.get('/api/visitors', (req,res)=> res.json(readJSON('visitors')));
app.post('/api/visitors', upload.single('file'), (req,res)=>{
  let body = req.body;

  if(req.file){
    try{ const meta = JSON.parse(body.meta || '{}'); body = Object.assign({}, meta, body); }catch(e){}
    body.photo = '/uploads/' + req.file.filename;
  } else if(body.photo && body.photo.startsWith('data:')) {}

  if(!body.id) body.id = Date.now();
  insertOne('visitors', body);
  res.json(body);
});
app.put('/api/visitors/:id', (req,res)=>{ 
  const u = updateOne('visitors', req.params.id, req.body); 
  if(!u) return res.status(404).json({error:'Not found'}); 
  res.json(u); 
});
app.delete('/api/visitors/:id', (req,res)=>{ 
  if(!deleteOne('visitors', req.params.id)) return res.status(404).json({error:'Not found'}); 
  res.json({ok:true}); 
});

// ---------- Policies ----------
app.get('/api/policies', (req,res)=> res.json(readJSON('policies')));
app.post('/api/policies', upload.single('file'), (req,res)=>{
  const title = req.body.title || `Policy ${Date.now()}`;
  let obj = { id: Date.now(), title };

  if(req.file){
    obj.url = '/uploads/' + req.file.filename;
  } else if(req.body.data){
    obj.data = req.body.data;
  }

  insertOne('policies', obj);
  res.json(obj);
});
app.put('/api/policies/:id', (req,res)=>{ 
  const u = updateOne('policies', req.params.id, req.body); 
  if(!u) return res.status(404).json({error:'Not found'}); 
  res.json(u); 
});
app.delete('/api/policies/:id', (req,res)=>{ 
  if(!deleteOne('policies', req.params.id)) return res.status(404).json({error:'Not found'}); 
  res.json({ok:true}); 
});

// ---------- Gallery ----------
app.get('/api/gallery', (req,res)=> res.json(readJSON('gallery')));
app.post('/api/gallery', upload.single('file'), (req,res)=>{
  let obj = { id: Date.now() };
  if(req.file){
    obj.url = '/uploads/' + req.file.filename;
  } else if(req.body.data){
    obj.data = req.body.data;
  }
  insertOne('gallery', obj);
  res.json(obj);
});
app.put('/api/gallery/:id', (req,res)=>{ 
  const u = updateOne('gallery', req.params.id, req.body); 
  if(!u) return res.status(404).json({error:'Not found'}); 
  res.json(u); 
});
app.delete('/api/gallery/:id', (req,res)=>{ 
  if(!deleteOne('gallery', req.params.id)) return res.status(404).json({error:'Not found'}); 
  res.json({ok:true}); 
});

// ---------- Factories ----------
app.get('/api/factories', (req,res)=>{
  const data = readJSON('factories');
  res.json(data);
});
app.post('/api/factories', (req,res)=>{
  const body = req.body;
  writeJSON('factories', body);
  res.json(body);
});
app.put('/api/factories', (req,res)=>{
  const body = req.body;

  if(Array.isArray(body)){
    const obj = {};
    body.forEach(f => { 
      if(f.name) obj[f.name] = { fire: f.fire||0, firstAid: f.firstAid||0, manpower: f.manpower||0 }; 
    });
    writeJSON('factories', obj);
    return res.json(obj);
  } 

  writeJSON('factories', body);
  return res.json(body);
});
app.delete('/api/factories/:id', (req,res)=>{
  const data = readJSON('factories');
  if(data[req.params.id]){
    delete data[req.params.id];
    writeJSON('factories', data);
    return res.json({ok:true});
  }
  return res.status(404).json({error:'Not found'});
});

// ---------- Chat ----------
app.get('/api/chat', (req,res)=> res.json(readJSON('chat')));
app.post('/api/chat', (req,res)=>{
  const msg = req.body;
  if(!msg.id) msg.id = Date.now();
  insertOne('chat', msg);
  res.json(msg);
});
app.put('/api/chat/:id', (req,res)=>{ 
  const u = updateOne('chat', req.params.id, req.body); 
  if(!u) return res.status(404).json({error:'Not found'}); 
  res.json(u); 
});
app.delete('/api/chat/:id', (req,res)=>{ 
  if(!deleteOne('chat', req.params.id)) return res.status(404).json({error:'Not found'}); 
  res.json({ok:true}); 
});

// ---------- Small stats ----------
app.get('/api/stats', (req,res)=> res.json(readJSON('stats')));
app.put('/api/stats', (req,res)=>{ 
  writeJSON('stats', req.body); 
  res.json(req.body); 
});

// ---------- Auth ----------
app.post('/api/auth/login', (req,res)=>{
  const { username, password } = req.body || {};
  const users = readJSON('users');
  const user = users.find(u => u.username === username && u.password === password);

  if(!user){
    if(username==='admin' && password==='admin123'){
      const u = { username:'admin', role:'admin' };
      return res.json({ token: 'admintoken-'+Date.now(), user: u });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = 'token-' + Date.now() + '-' + Math.round(Math.random()*1e6);
  res.json({ token, user: { username: user.username, role: user.role } });
});

// ---------- Generic /api root ----------
app.get('/api', (req,res)=> {
  res.json({ ok:true, message:'HSE API running', modules: ['notices','factories','reports','ppe','training','policies','gallery','visitors','ptw','chat'] });
});

// ---------- NEW ROOT ROUTE (FIX FOR RENDER HOME PAGE) ----------
app.get("/", (req, res) => {
  res.send("HSE Backend is running successfully!");
});

// ---------- Start Server ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HSE backend listening at http://0.0.0.0:${PORT}`);
  console.log(`uploads served at /uploads (folder ${UPLOADS_DIR})`);
  console.log(`data files at ${DATA_DIR}`);
});
