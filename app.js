/* Dashboard Pengajuan PO — Naintiland
   Login & data bersama: Firebase Auth (email/kata sandi) + Firestore.
   Mode demo tanpa Firebase: buka index.html?demo (data hanya di memori). */
'use strict';
const KOP = window.KOP;
const DEF_JAB = [{id:'acc',title:'Accounting'},{id:'spv',title:'SPV Proyek'},{id:'bm',title:'Branch Manager'},{id:'gm',title:'General Manager'},{id:'dir',title:'Direktur'}];
const DEF_RULES = [
  {max:5000000,  modes:{acc:'approve',spv:'none',bm:'none',gm:'none',dir:'none'}},
  {max:15000000, modes:{acc:'none',spv:'approve',bm:'none',gm:'none',dir:'none'}},
  {max:25000000, modes:{acc:'none',spv:'none',bm:'approve',gm:'none',dir:'none'}},
  {max:99000000, modes:{acc:'none',spv:'none',bm:'none',gm:'approve',dir:'none'}},
  {max:null,     modes:{acc:'none',spv:'none',bm:'none',gm:'none',dir:'approve'}}
];
const DEF_NOTE = 'Mohon barang dikirim sesuai spesifikasi & tanggal dibutuhkan.';
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const VIEWS = {dashboard:'Dashboard',pengajuan:'Pengajuan PO',persetujuan:'Persetujuan',rekap:'Rekap Pembelian',pengaturan:'Pengaturan'};
const IC = {
 dashboard:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
 pengajuan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3h8l4 4v14H7z"/><path d="M10 12h6M10 16h6"/></svg>',
 persetujuan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
 pengaturan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
 rekap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
 dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
 box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.500h4.500a2 2 0 010 4H10a2 2 0 000 4h5M12 6.500v11"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.800z"/></svg>'
};
// auth: 'loading' | 'setup' | 'out' | 'in'
const S = {auth:'loading', pos:[], users:{}, cfg:{}, me:{id:'',email:''}, loaded:false, view:'dashboard', q:'', fs:'', gate:'login'};
let fs = null, auth = null, unsubs = [], pendingName = '', W = null, F = null, pad = null;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v==null?'':v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fnum = n => Math.round(n).toLocaleString('id-ID');
const rp = n => 'Rp. ' + fnum(n);
const qtyf = n => (+n).toLocaleString('id-ID', {maximumFractionDigits:3});
const today = () => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const tgl = s => { if(!s) return '-'; const [y,m,d] = s.split('-'); return (+d)+' '+BULAN[+m-1]+' '+y; };
const tglShort = t => { const d = new Date(t); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); };
const clone = o => JSON.parse(JSON.stringify(o));
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const okSig = s => typeof s === 'string' && s.startsWith('data:image/png;base64,');
function calc(po){
  const items = (po.items||[]).map(i => ({...i, jumlah: num(i.qty)*num(i.harga) - num(i.diskon)}));
  const subtotal = items.reduce((a,i) => a+i.jumlah, 0), ppn = Math.round(subtotal*num(po.ppnPct)/100);
  const ongkir = Math.max(0, num(po.ongkir));
  return {items, subtotal, ppn, ongkir, total: subtotal+ppn+ongkir};
}
function toast(t){ const b = $('#toastBox'); b.innerHTML = '<div class="toast">'+esc(t)+'</div>'; clearTimeout(toast.t); toast.t = setTimeout(() => b.innerHTML = '', 4000); }

/* ---------- jabatan & aturan nominal ---------- */
const jab = () => (Array.isArray(S.cfg.jabatan) && S.cfg.jabatan.length) ? S.cfg.jabatan : DEF_JAB;
const rules = () => (Array.isArray(S.cfg.rules) && S.cfg.rules.length) ? S.cfg.rules : DEF_RULES;
// Aturan khusus pembelian Inventaris. Bawaan: di bawah Rp 25 juta cukup disetujui Accounting;
// Rp 25 juta s.d. di bawah Rp 100 juta disetujui General Manager, diketahui Accounting;
// Rp 100 juta ke atas disetujui Direktur, diketahui General Manager dan Accounting.
function defRulesInv(){
  const J = jab(), find = (re, id) => (J.find(j => re.test(j.title)) || J.find(j => j.id === id) || {}).id;
  const acc = find(/account/i, 'acc'), gm = find(/general/i, 'gm'), dir = find(/direktur|director/i, 'dir');
  if(!acc || !gm || !dir) return rules();
  const m = x => { const o = {}; J.forEach(j => o[j.id] = x[j.id] || 'none'); return o; };
  return [{max:24999999, modes:m({[acc]:'approve'})}, {max:99999999, modes:m({[acc]:'know', [gm]:'approve'})}, {max:null, modes:m({[acc]:'know', [gm]:'know', [dir]:'approve'})}];
}
const rulesInv = () => (Array.isArray(S.cfg.rulesInv) && S.cfg.rulesInv.length) ? S.cfg.rulesInv : defRulesInv();
function ruleFor(total, set){
  const rs = [...(set || rules())].sort((a,b) => (a.max==null?Infinity:a.max) - (b.max==null?Infinity:b.max));
  return rs.find(r => r.max==null || total <= r.max) || rs[rs.length-1];
}
function flowFor(po){
  const r = ruleFor(calc(po).total, po.jenis === 'Inventaris' ? rulesInv() : rules()), m = r.modes || {};
  let flow = jab().filter(j => m[j.id] === 'approve');
  if(!flow.length) flow = jab();
  return {flow, knowers: jab().filter(j => m[j.id] === 'know' && !flow.includes(j))};
}
const me = () => S.users[S.me.id] || {};
const myRole = () => me().role || '';
const isAdmin = () => !!S.me.id && S.cfg.adminUid === S.me.id;
// Jenis transaksi. Inventaris memakai aturan persetujuan Inventaris; jenis lain memakai aturan umum.
const JENIS = ['Material','Inventaris','Upah Tukang Borongan','Upah Buruh Harian','Biaya Fasum','Biaya Marketing'];
const JCOLOR = {'Material':['rgba(15,138,140,.10)','#0a6c72'],'Inventaris':['rgba(232,162,58,.16)','#8a5a0b'],'Upah Tukang Borongan':['rgba(123,116,214,.14)','#4b44a8'],'Upah Buruh Harian':['rgba(240,107,181,.14)','#a3326f'],'Biaya Fasum':['rgba(63,163,77,.14)','#2e7a3a'],'Biaya Marketing':['rgba(43,98,217,.12)','#2b52a8']};
const jenisOf = p => JENIS.includes(p && p.jenis) ? p.jenis : 'Material';
// Nama tampilan jabatan pengaju PO (ID internalnya tetap 'purchasing').
const PURCH = 'Project & Material Control';
const roleName = r => r === 'purchasing' ? PURCH : ((jab().find(l => l.id === r) || {}).title || 'Belum ada jabatan');
const isPurch = () => myRole() === 'purchasing';
const canRekap = () => isAdmin() || isPurch();
const poFlow = po => (po.status !== 'draft' && Array.isArray(po.flow) && po.flow.length) ? po.flow : flowFor(po).flow;
const poKnowers = po => po.status !== 'draft' ? (po.knowers || []) : flowFor(po).knowers;
const curLevel = po => po.status === 'diajukan' ? poFlow(po)[po.step||0] : null;
const canApprove = po => { const l = curLevel(po); return !!l && myRole() === l.id; };
const sameName = (a,b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
// Orang yang sama dengan salah satu penyetuju PO ini (akun yang sama, atau nama yang sama di akun lain)?
const isApprover = (po, uid, name) => (po.approvals||[]).some(a => a.by === uid || sameName(a.name, name));
const canKnow = po => (po.status === 'diajukan' || po.status === 'disetujui') && (po.knowIds||[]).includes(myRole()) && !(po.knows||[]).some(k => k.levelId === myRole()) && !isApprover(po, S.me.id, me().name);
// Kolom "Mengetahui" yang ditampilkan: dilewati bila orangnya sudah menandatangani sebagai penyetuju.
function shownKnowers(po){
  const ks = po.knows || [];
  return poKnowers(po).filter(l => {
    const k = ks.find(x => x.levelId === l.id);
    if(k) return !isApprover(po, k.by, k.name);
    const holders = Object.keys(S.users).filter(u => S.users[u].role === l.id);
    return !(holders.length && holders.every(u => isApprover(po, u, S.users[u].name)));
  });
}
const canEdit = po => isPurch() && po.status !== 'disetujui';
const canDelete = po => (isPurch() && po.status !== 'disetujui') || isAdmin();
// Jabatan "Mengetahui" wajib menandai sebelum PO dianggap selesai. PO yang semua penyetujunya sudah
// menekan Setujui tetapi belum diketahui ditampilkan sebagai "Menunggu diketahui ..." dan belum bisa diunduh.
const pendingKnow = po => shownKnowers(po).filter(l => !(po.knows||[]).some(k => k.levelId === l.id));
const done = po => po.status === 'disetujui' && !pendingKnow(po).length;
const eff = po => (po.status === 'disetujui' && !done(po)) ? 'diajukan' : po.status;
const stLabel = po => po.status === 'draft' ? 'Draft' : po.status === 'ditolak' ? 'Ditolak' : po.status === 'disetujui' ? (done(po) ? 'Disetujui' : 'Menunggu diketahui ' + pendingKnow(po).map(l => l.title).join(', ')) : 'Menunggu ' + ((curLevel(po)||{}).title || '');
const stPill = po => '<span class="st '+esc(eff(po))+'">'+esc(stLabel(po))+'</span>';
// Admin dan Purchasing melihat semua PO. Jabatan lain hanya melihat PO yang melibatkan jabatannya
// (ia penyetuju/yang mengetahui di alurnya) atau yang pernah ia putuskan.
const involves = po => { const r = myRole(), u = S.me.id; if(!r || po.status === 'draft') return false;
  return poFlow(po).some(l => l.id === r) || (po.knowIds||[]).includes(r) || (po.approvals||[]).some(a => a.by === u) || !!(po.rejected && po.rejected.by === u) || (po.knows||[]).some(k => k.by === u); };
const visible = () => canRekap() ? S.pos : S.pos.filter(involves);
const sorted = () => [...visible()].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
const pendingMine = () => S.pos.filter(p => canApprove(p) || canKnow(p));
function nextNo(date, skipId){
  const [y,m] = date.split('-'), pre = 'PO-'+y.slice(2)+m+'-'; let mx = 0;
  S.pos.forEach(p => { if(p.id !== skipId && String(p.no||'').startsWith(pre)){ const n = parseInt(String(p.no).slice(pre.length),10); if(n > mx) mx = n; } });
  return pre + String(mx+1).padStart(3,'0');
}

/* ---------- penyimpanan (Firestore, atau memori saat demo) ---------- */
async function write(fn, mem){
  try { if(fs) await fn(); else { mem(); render(); } return true; }
  catch(e){ console.error(e); toast(e && e.code === 'permission-denied' ? 'Ditolak: Anda tidak berwenang untuk tindakan ini.' : 'Gagal menyimpan, coba lagi.'); return false; }
}
const memPO = id => S.pos.find(p => p.id === id);
const setPO = (id,d) => write(() => fs.collection('pos').doc(id).set(d), () => { const i = S.pos.findIndex(p => p.id === id), r = {...d,id}; if(i<0) S.pos.push(r); else S.pos[i] = r; });
const updPO = (id,patch) => write(() => fs.collection('pos').doc(id).update(patch), () => Object.assign(memPO(id), patch));
const delPO = id => write(() => fs.collection('pos').doc(id).delete(), () => { S.pos = S.pos.filter(p => p.id !== id); });
const updUser = (uid,patch) => write(() => fs.collection('users').doc(uid).update(patch), () => { S.users[uid] = {...S.users[uid], ...patch}; });
const updCfg = patch => write(() => fs.collection('config').doc('app').update(patch), () => Object.assign(S.cfg, patch));

/* ---------- mulai ---------- */
const VERSION = '20.11-n2';
function init(){
  const bs = document.querySelector('.brand small'); if(bs) bs.textContent = 'Purchase Order · v' + VERSION;
  route();
  const c = window.FIREBASE_CONFIG || {}, ready = c.apiKey && !/^ISI/.test(c.apiKey);
  if(window.DEMO || /[?&]demo\b/.test(location.search)){
    S.auth = 'in'; S.loaded = true; S.demo = true;
    S.me = {id:'demo', email:'demo@contoh.id'};
    S.users = {demo:{name:'', sig:'', email:'demo@contoh.id', role:'purchasing'}};
    S.cfg = {adminUid:'demo', jabatan:clone(DEF_JAB), rules:clone(DEF_RULES)};
    seedDemo();
    return render();
  }
  if(!ready || !window.firebase){ S.auth = 'setup'; return render(); }
  firebase.initializeApp(c); auth = firebase.auth(); fs = firebase.firestore();
  auth.onAuthStateChanged(u => {
    unsubs.forEach(f => f()); unsubs = []; S.pos = []; S.users = {}; S.cfg = {}; S.loaded = false; W = null; closeModal();
    if(!u){ S.auth = 'out'; S.me = {id:'',email:''}; return render(); }
    S.auth = 'in'; S.me = {id:u.uid, email:u.email||''}; render(); subscribe();
  });
  render();
}
function seedDemo(){
  S.users.demo.name = 'Pengguna Demo';
  const mk = (n, st, jenis, project, supplier, items) => {
    const d = {id:'d'+n, no:nextNo(today()), tanggal:today(), project, supplier, prioritas:'Normal', jenis, bank:'BCA', rek:'7890123456', an:supplier, items, ppnPct:0, catatan:DEF_NOTE, status:st,
      step:0, approvals:[], knows:[], rejected:null, flow:[], knowers:[], knowIds:[], createdBy:'demo', createdAt:Date.now()-n*1000, updatedAt:Date.now(), createdName:'Pengguna Demo', createdSig:''};
    if(st !== 'draft') Object.assign(d, submitFields(d));
    if(st === 'disetujui'){ d.step = d.flow.length; d.approvals = d.flow.map(l => ({levelId:l.id, title:l.title, by:'contoh', name:'Contoh '+l.title, sig:'', at:Date.now()})); }
    S.pos.push(d);
  };
  mk(1, 'disetujui', 'Material', 'Ibu Rusnaini', 'Interma', [{nama:'HPL Th 009 D', qty:4, satuan:'lbr', harga:215000, diskon:20000, ket:''}]);
  mk(2, 'diajukan', 'Material', 'Kitchen Set Pak Andi', 'Setia Jaya', [{nama:'Plywood 18 mm', qty:40, satuan:'lbr', harga:250000, diskon:0, ket:''}, {nama:'HPL Th 009 D', qty:28, satuan:'lbr', harga:250000, diskon:0, ket:''}]);
  mk(3, 'draft', 'Inventaris', 'Workshop', 'Mitra Teknik', [{nama:'Mesin bor', qty:1, satuan:'unit', harga:750000, diskon:0, ket:''}]);
}
// Menyimpan file ke perangkat. Di dalam pratinjau Claude, unduhan lewat jalur khususnya.
async function saveFile(name, blob){
  if(window.claude && window.claude.use){ const dl = await window.claude.use('downloads'); if(!dl) throw {code:'unavailable'}; await dl.save({filename:name, data:blob}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function subscribe(){
  const fail = e => { console.error(e); toast('Data tidak dapat dimuat. Periksa koneksi atau aturan Firestore.'); };
  let seen = {u:false, c:false};
  const check = () => { if(seen.u && seen.c && !S.loaded){ S.loaded = true; } render(); };
  unsubs.push(fs.collection('users').onSnapshot(s => {
    const o = {}; s.forEach(d => o[d.id] = d.data()); S.users = o;
    if(!o[S.me.id] && !subscribe.made){ subscribe.made = true;
      fs.collection('users').doc(S.me.id).set({name: pendingName || (S.me.email.split('@')[0]), email: S.me.email, sig:'', role:'', createdAt: Date.now()}).catch(fail).finally(() => subscribe.made = false); }
    seen.u = true; check();
  }, fail));
  unsubs.push(fs.collection('config').doc('app').onSnapshot(s => {
    if(s.exists) S.cfg = s.data();
    else fs.collection('config').doc('app').set({adminUid:S.me.id, jabatan:DEF_JAB, rules:DEF_RULES}).catch(() => {}); // pengguna pertama = admin
    seen.c = true; check();
  }, fail));
  unsubs.push(fs.collection('pos').onSnapshot(s => { const a = []; s.forEach(d => a.push({...d.data(), id:d.id})); S.pos = a; render(); }, fail));
}

/* ---------- gerbang: setup & login ---------- */
function gateHTML(){
  if(S.auth === 'loading') return '<div class="gate"><h1>Memuat…</h1></div>';
  if(S.auth === 'setup') return '<div class="gate"><h1>Hubungkan Firebase</h1><p>Aplikasi ini belum terhubung ke proyek Firebase.</p><p>Isi <code>firebase-config.js</code> dengan konfigurasi proyek Anda, lalu pasang <code>firestore.rules</code>. Langkah lengkapnya ada di <code>README.md</code>.</p><p>Ingin melihat-lihat dulu tanpa Firebase?</p><a class="btn p" href="?demo" style="text-decoration:none">Buka mode demo</a></div>';
  const reg = S.gate === 'daftar';
  return '<form class="gate" id="gateForm"><h1>'+(reg?'Daftar akun':'Masuk')+'</h1><p>Dashboard Pengajuan PO — Naintiland</p>'+
    (reg?'<label>Nama (tercetak di PO)</label><input type="text" id="gName" maxlength="60" required>':'')+
    '<label>Email</label><input type="text" inputmode="email" autocomplete="username" id="gEmail" required>'+
    '<label>Kata sandi</label><input type="password" id="gPass" autocomplete="'+(reg?'new-password':'current-password')+'" required minlength="6" style="background:rgba(255,255,255,.7);border:1.5px solid rgba(255,255,255,.9);border-radius:11px;padding:9px 12px;width:100%;outline:0">'+
    '<button class="btn p" type="submit">'+(reg?'Daftar':'Masuk')+'</button>'+
    '<div class="alt"><button type="button" class="link" data-act="gswitch">'+(reg?'Sudah punya akun? Masuk':'Belum punya akun? Daftar')+'</button>'+(reg?'':'<button type="button" class="link" data-act="greset">Lupa kata sandi</button>')+'</div></form>';
}
const AUTH_MSG = {'auth/invalid-credential':'Email atau kata sandi salah.','auth/wrong-password':'Email atau kata sandi salah.','auth/user-not-found':'Akun tidak ditemukan.','auth/email-already-in-use':'Email ini sudah terdaftar. Silakan masuk.','auth/weak-password':'Kata sandi minimal 6 karakter.','auth/invalid-email':'Format email tidak valid.','auth/too-many-requests':'Terlalu banyak percobaan. Coba lagi nanti.','auth/network-request-failed':'Tidak ada koneksi internet.','auth/operation-not-allowed':'Login email/kata sandi belum diaktifkan di Firebase (README langkah 2).','auth/unauthorized-domain':'Domain ini belum diizinkan di Firebase Authentication (README langkah 6).'};
async function gateSubmit(){
  const email = $('#gEmail').value.trim(), pass = $('#gPass').value, btn = $('#gateForm button[type=submit]');
  btn.disabled = true;
  try {
    if(S.gate === 'daftar'){ pendingName = $('#gName').value.trim(); await auth.createUserWithEmailAndPassword(email, pass); }
    else await auth.signInWithEmailAndPassword(email, pass);
  } catch(e){ btn.disabled = false; toast(AUTH_MSG[e.code] || 'Gagal masuk: ' + (e.message||e.code)); }
}

/* ---------- render ---------- */
function route(){ const h = location.hash.slice(1); S.view = VIEWS[h] ? h : 'dashboard'; }
window.addEventListener('hashchange', () => { route(); if(S.view !== 'pengaturan') W = null; render(); });
function render(){
  const inApp = S.auth === 'in';
  $('#app').hidden = !inApp;
  const g = $('#gate');
  if(!inApp){ const key = S.auth + S.gate; if(g.dataset.k !== key){ g.dataset.k = key; g.innerHTML = gateHTML(); } return; }
  g.dataset.k = ''; g.innerHTML = '';
  const pm = pendingMine().length, nm = me().name || '';
  $('#nav').innerHTML = Object.keys(VIEWS).filter(k => k !== 'rekap' || canRekap()).map((k,i) => (k==='pengaturan'?'<hr>':'')+'<button class="nav'+(S.view===k?' on':'')+'" data-go="'+k+'">'+IC[k]+'<span>'+VIEWS[k]+'</span>'+(k==='persetujuan'&&pm?'<span class="cnt">'+pm+'</span>':'')+'</button>').join('');
  $('#hello').textContent = 'Selamat datang' + (nm ? ', '+nm : '') + ' 👋';
  $('#title').textContent = VIEWS[S.view];
  $('#ava').textContent = (nm||'?').charAt(0).toUpperCase();
  $('#whoName').textContent = nm || 'Isi profil';
  $('#whoRole').textContent = roleName(myRole()) + (isAdmin() ? ' · Admin' : '');
  let n = '';
  if(S.demo) n += '<div class="note warn">Mode demo — data hanya tersimpan sementara di tab ini. Ganti jabatan Anda di Pengaturan untuk mencoba tiap peran.</div>';
  if(S.loaded && !myRole()) n += '<div class="note">'+(isAdmin() ? 'Anda admin. Tetapkan jabatan Anda dan pengguna lain di menu Pengaturan.' : 'Jabatan Anda belum ditetapkan. Minta admin menetapkannya di menu Pengaturan.')+'</div>';
  $('#notes').innerHTML = n;
  const v = $('#view');
  if(!S.loaded){ v.innerHTML = '<div class="card empty">Memuat data…</div>'; return; }
  if(S.view === 'pengaturan' && isAdmin() && W && v.querySelector('#setBox')) { renderUsers(); return; } // jangan timpa isian yang belum disimpan
  if(S.view === 'rekap' && !canRekap()){ v.innerHTML = '<div class="card empty">Rekap Pembelian hanya dapat dilihat oleh Admin dan '+esc(PURCH)+'.</div>'; return; }
  v.innerHTML = ({dashboard:vDash, pengajuan:vList, persetujuan:vAppr, rekap:vRekap, pengaturan:vSet})[S.view]();
}
function rowActs(po){
  const id = esc(po.id); let a = '<button class="btn sm" data-act="view" data-id="'+id+'">Lihat</button>';
  if(canApprove(po)) a += '<button class="btn sm p" data-act="approve" data-id="'+id+'">Setujui</button><button class="btn sm d" data-act="reject" data-id="'+id+'">Tolak</button>';
  if(canKnow(po)) a += '<button class="btn sm p" data-act="know" data-id="'+id+'">Mengetahui</button>';
  if(canEdit(po)) a += '<button class="btn sm" data-act="edit" data-id="'+id+'">Edit</button>';
  if(canDelete(po)) a += '<button class="btn sm d" data-act="del" data-id="'+id+'">Hapus</button>';
  if(done(po)) a += '<button class="btn sm p" data-act="pdf" data-id="'+id+'">'+IC.dl+'Unduh PO</button>';
  return '<div class="acts">'+a+'</div>';
}
function poTable(list, acts, emptyMsg, compact){
  if(!list.length) return '<div class="empty">'+esc(emptyMsg)+'</div>';
  return '<div class="tw"><table><thead><tr><th>No. PO</th>'+(compact?'':'<th>Tanggal</th>')+'<th>Project</th>'+(compact?'':'<th>Supplier</th>')+'<th class="num">Total</th><th>Status</th>'+(acts?'<th></th>':'')+'</tr></thead><tbody>'+
  list.map(po => '<tr><td><button class="pono" data-act="view" data-id="'+esc(po.id)+'">'+esc(po.no)+'</button></td>'+
    (compact?'':'<td style="white-space:nowrap">'+esc(tgl(po.tanggal))+'</td>')+
    '<td>'+esc(po.project)+(compact?'<br><span style="font-size:11.5px;color:var(--ink2);white-space:nowrap">'+esc(po.supplier)+'</span>':'')+'</td>'+
    (compact?'':'<td>'+esc(po.supplier)+'</td>')+'<td class="num">'+rp(calc(po).total)+'</td><td>'+stPill(po)+'</td>'+(acts?'<td>'+rowActs(po)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
}
function vDash(){
  const c = {disetujui:0, diajukan:0, ditolak:0, draft:0}; let val = 0;
  visible().forEach(p => { const e = eff(p); if(c[e] != null) c[e]++; if(done(p)) val += calc(p).total; });
  const tot = visible().length || 1, pm = pendingMine().length, pct = k => (c[k]/tot*100)+'%';
  const jt = val >= 1e9 ? [(val/1e9).toLocaleString('id-ID',{maximumFractionDigits:2}),'M'] : val >= 1e6 ? [(val/1e6).toLocaleString('id-ID',{maximumFractionDigits:1}),'jt'] : [fnum(val),''];
  const cta = isPurch() ? ['Jangan lupa','Buat pengajuan PO baru','Buat pengajuan','new'] : pm ? ['Perlu tindakan', pm+' PO menunggu tindakan Anda','Buka persetujuan','goappr'] : ['Semua beres','Tidak ada PO yang menunggu Anda','Lihat semua PO','golist'];
  return '<div class="grid"><div class="col"><div class="card"><div class="chead"><h2>'+(canRekap()?'Pengajuan terbaru':'PO terkait jabatan Anda')+'</h2><button class="link" data-go="pengajuan">Lihat semua</button></div>'+
    poTable(sorted().slice(0,6), false, 'Belum ada pengajuan PO.', true)+'</div></div>'+
  '<div class="col"><div class="card"><div class="chead"><h2>Ringkasan status</h2><button class="link" data-go="pengajuan">Lihat semua</button></div>'+
    '<div class="bar"><span style="width:'+pct('disetujui')+';background:var(--ok)"></span><span style="width:'+pct('diajukan')+';background:var(--wait)"></span><span style="width:'+pct('ditolak')+';background:var(--no)"></span><span style="width:'+pct('draft')+';background:var(--draft)"></span></div>'+
    '<div class="legend"><div><small><i class="dot" style="background:var(--ok)"></i>Disetujui</small><b>'+c.disetujui+'</b></div><div><small><i class="dot" style="background:var(--wait)"></i>Menunggu</small><b>'+c.diajukan+'</b></div><div><small><i class="dot" style="background:var(--no)"></i>Ditolak</small><b>'+c.ditolak+'</b></div><div><small><i class="dot" style="background:var(--draft)"></i>Draft</small><b>'+c.draft+'</b></div></div></div>'+
  '<div class="tiles">'+
    '<div class="card tile"><div class="ticon t1">'+IC.box+'</div><div><small>Total PO</small><strong>'+visible().length+'</strong></div></div>'+
    '<div class="card tile"><div class="ticon t2">'+IC.coin+'</div><div><small>'+(canRekap()?'Nilai disetujui':'Nilai yang disetujui')+'</small><strong><i>Rp </i>'+jt[0]+'<i>'+jt[1]+'</i></strong></div></div>'+
    '<div class="card tile"><div class="ticon t3">'+IC.clock+'</div><div><small>Dalam proses</small><strong>'+c.diajukan+'</strong></div></div>'+
    '<div class="card tile"><div class="ticon t4">'+IC.star+'</div><div><small>Menunggu saya</small><strong>'+pm+'</strong></div></div></div>'+
  '<div class="cta"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><small>'+cta[0]+'</small><h3>'+esc(cta[1])+'</h3><button class="pill" data-act="'+cta[3]+'">'+cta[2]+'</button></div>'+
  '</div></div>';
}
function filtered(){ const q = S.q.trim().toLowerCase(); return sorted().filter(p => (!S.fs || eff(p) === S.fs) && (!q || [p.no,p.project,p.supplier].join(' ').toLowerCase().includes(q))); }
function vList(){
  return '<div class="card"><div class="chead"><div class="filters"><input type="text" id="q" placeholder="Cari no. PO, project, supplier…" value="'+esc(S.q)+'"><select id="fs"><option value="">Semua status</option>'+
    [['draft','Draft'],['diajukan','Menunggu persetujuan'],['disetujui','Disetujui'],['ditolak','Ditolak']].map(o => '<option value="'+o[0]+'"'+(S.fs===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>'+
    (isPurch() ? '<button class="btn p" data-act="new">+ Buat pengajuan PO</button>' : '')+'</div><div id="listBody">'+poTable(filtered(), true, visible().length ? 'Tidak ada PO yang cocok.' : 'Belum ada pengajuan PO.')+'</div></div>';
}
function vAppr(){
  const r = myRole();
  if(!r || r === 'purchasing') return '<div class="card empty">Halaman ini untuk jabatan yang menyetujui atau mengetahui PO ('+esc(jab().map(l => l.title).join(', '))+').<br>Jabatan Anda saat ini: '+esc(roleName(r))+'.</div>';
  const mine = p => (p.approvals||[]).some(a => a.by === S.me.id) || (p.rejected && p.rejected.by === S.me.id) || (p.knows||[]).some(k => k.by === S.me.id);
  return '<div class="col"><div class="card"><div class="chead"><h2>Menunggu tindakan Anda · '+esc(roleName(r))+'</h2></div>'+poTable(pendingMine(), true, 'Tidak ada PO yang menunggu tindakan Anda.')+'</div>'+
    '<div class="card"><div class="chead"><h2>Riwayat keputusan Anda</h2></div>'+poTable(sorted().filter(mine), true, 'Belum ada riwayat.')+'</div></div>';
}
/* ----- rekap pembelian bulanan ----- */
// Nama klien = kolom Project. Dikelompokkan tanpa membedakan huruf besar-kecil dan spasi berlebih.
const clientKey=p=>String(p.project||'').trim().replace(/\s+/g,' ').toLowerCase()||'(tanpa nama)';
function rekap(){
  const m=S.rm||today().slice(0,7),month=S.pos.filter(p=>done(p)&&String(p.tanggal||'').slice(0,7)===m)
    .sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||String(a.no).localeCompare(String(b.no)));
  // Satu kelompok per klien; di dalamnya dipisah per jenis transaksi.
  const cmap={},J=()=>({rows:[],po:0,ppn:0,ong:0,total:0});
  month.forEach(p=>{const k=clientKey(p),c=calc(p),jn=jenisOf(p);
    const x=cmap[k]||(cmap[k]={key:k,name:String(p.project||'').trim().replace(/\s+/g,' ')||'(tanpa nama)',po:0,rows:[],sub:0,ppn:0,ong:0,by:{},j:{}});
    const q=x.j[jn]||(x.j[jn]=J());
    x.po++;c.items.forEach(i=>{x.rows.push({p,i,jenis:jn});q.rows.push({p,i,jenis:jn})});
    q.po++;q.ppn+=c.ppn;q.ong+=c.ongkir;q.total+=c.total;
    x.sub+=c.subtotal;x.ppn+=c.ppn;x.ong+=c.ongkir;x.by[jn]=(x.by[jn]||0)+c.total});
  const clients=Object.values(cmap).map(c=>Object.assign(c,{item:c.rows.length,total:Object.values(c.by).reduce((a,v)=>a+v,0)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  const ck=clients.some(c=>c.key===S.rk)?S.rk:'',cname=ck?cmap[ck].name:'',shown=ck?[cmap[ck]]:clients;
  const T={by:{},ong:0,total:0};shown.forEach(c=>{JENIS.forEach(j=>{if(c.by[j])T.by[j]=(T.by[j]||0)+c.by[j]});T.ong+=c.ong;T.total+=c.total});
  // Daftar PO yang memakai ongkos kirim bulan ini, diurutkan per klien.
  const ongList=month.filter(p=>(!ck||clientKey(p)===ck)&&calc(p).ongkir>0).sort((a,b)=>cmap[clientKey(a)].name.localeCompare(cmap[clientKey(b)].name)||String(a.tanggal).localeCompare(String(b.tanggal)));
  // Total per bulan sepanjang tahun yang dipilih (ikut filter klien), dipisah per jenis transaksi.
  const yr=m.slice(0,4),months12=Array.from({length:12},(_,i)=>({m:yr+'-'+String(i+1).padStart(2,'0'),by:{},ong:0,po:0,total:0}));
  S.pos.filter(p=>done(p)&&String(p.tanggal||'').slice(0,4)===yr&&(!ck||clientKey(p)===ck)).forEach(p=>{const r=months12[+String(p.tanggal).slice(5,7)-1];if(!r)return;const c=calc(p),jn=jenisOf(p);r.po++;r.ong+=c.ongkir;r.total+=c.total;r.by[jn]=(r.by[jn]||0)+c.total});
  // Jenis yang muncul di bulan ini / tahun ini; Material selalu ditampilkan bila tidak ada data.
  const jMonth=JENIS.filter(j=>T.by[j]),jYear=JENIS.filter(j=>T.by[j]||months12.some(r=>r.by[j]));
  return {m,clients,shown,ck,cname,T,yr,months12,ongList,cmap,jMonth:jMonth.length?jMonth:['Material'],jYear:jYear.length?jYear:['Material']};
}
const blnLabel=m=>BULAN[+m.slice(5,7)-1]+' '+m.slice(0,4);
function vRekap(){
  const {m,clients,shown,ck,cname,T,ongList,cmap,jMonth}=rekap();
  const months=[...new Set(S.pos.map(p=>String(p.tanggal||'').slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)).concat(today().slice(0,7),m))].sort().reverse();
  const TI=['t1','t3','t2','t4'],tile=(c,ic,l,v)=>'<div class="card tile"><div class="ticon '+c+'">'+ic+'</div><div><small>'+l+'</small><strong style="font-size:20px">'+rp(v)+'</strong></div></div>';
  const sub=t=>'<br><span style="font-size:11.5px;color:var(--ink2)">'+t+'</span>';
  const pill=j=>'<span class="st" style="font-size:11px;padding:3px 9px;background:'+JCOLOR[j][0]+';color:'+JCOLOR[j][1]+'">'+esc(j)+'</span>';
  const card=c=>'<div class="card"><div class="chead" style="align-items:flex-start"><div><h2 style="font-size:17px;font-weight:600">'+esc(c.name)+'</h2>'+
    '<div style="font-size:12px;color:var(--ink2);margin-top:3px">'+c.po+' PO · '+c.item+' item'+JENIS.filter(j=>c.by[j]).map(j=>' · '+esc(j)+' '+rp(c.by[j])).join('')+'</div></div>'+
    '<b style="font-weight:600;font-size:16px">'+rp(c.total)+'</b></div>'+
    '<div class="tw"><table><thead><tr><th>Tgl</th><th>No. PO</th><th>Uraian</th><th>Jenis</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Jumlah</th></tr></thead><tbody>'+
    JENIS.filter(jn=>c.j[jn]).map(jn=>{const q=c.j[jn];
      return '<tr><td colspan="7" style="background:'+JCOLOR[jn][0]+';font-weight:600;padding:9px 10px">'+esc(jn)+' <span style="font-weight:400;color:var(--ink2);font-size:12px">· '+q.rows.length+' item</span></td></tr>'+
      q.rows.map(r=>'<tr><td style="white-space:nowrap">'+esc(String(r.p.tanggal||'').slice(8,10)+'/'+String(r.p.tanggal||'').slice(5,7))+'</td><td><button class="pono" data-act="view" data-id="'+esc(r.p.id)+'">'+esc(r.p.no)+'</button></td><td>'+esc(r.i.nama)+sub(esc(r.p.supplier))+'</td><td>'+pill(r.jenis)+'</td><td class="num">'+qtyf(r.i.qty)+' '+esc(r.i.satuan)+'</td><td class="num">'+rp(r.i.harga)+'</td><td class="num">'+rp(r.i.jumlah)+'</td></tr>').join('')+
      (q.ppn?'<tr><td colspan="6" class="num">PPN</td><td class="num">'+rp(q.ppn)+'</td></tr>':'')+
      (q.ong?'<tr><td colspan="6" class="num">Ongkos kirim</td><td class="num">'+rp(q.ong)+'</td></tr>':'')+
      '<tr><td colspan="6" class="num">Subtotal '+esc(jn)+'</td><td class="num"><b>'+rp(q.total)+'</b></td></tr>'}).join('')+
    '<tr><td colspan="6" class="num"><b>Total '+esc(c.name)+'</b></td><td class="num"><b>'+rp(c.total)+'</b></td></tr></tbody></table></div></div>';
  const per=!ck&&clients.length>1?'<div class="card"><div class="chead"><h2>Ringkasan per klien · '+esc(blnLabel(m))+'</h2></div>'+
    '<div class="tw"><table><thead><tr><th>Klien / project</th><th class="num">PO</th>'+jMonth.map(j=>'<th class="num">'+esc(j)+'</th>').join('')+'<th class="num">Ongkir</th><th class="num">Total</th></tr></thead><tbody>'+
    clients.map(c=>'<tr><td><button class="pono" data-act="rkc" data-k="'+esc(c.key)+'">'+esc(c.name)+'</button>'+sub(c.item+' item')+'</td><td class="num">'+c.po+'</td>'+jMonth.map(j=>'<td class="num">'+(c.by[j]?rp(c.by[j]):'-')+'</td>').join('')+'<td class="num">'+(c.ong?rp(c.ong):'-')+'</td><td class="num"><b>'+rp(c.total)+'</b></td></tr>').join('')+
    '</tbody></table></div><div style="font-size:12px;color:var(--ink2);margin-top:10px">Klik nama klien untuk melihat rincian klien itu saja. Ongkir sudah termasuk di kolom jenis transaksinya.</div></div>':'';
  // Rekap ongkos kirim bulan ini: per PO, dikelompokkan per klien.
  const ong='<div class="card"><div class="chead"><h2>Ongkos kirim · '+esc(blnLabel(m))+(ck?' · '+esc(cname):'')+'</h2><b style="font-weight:600">'+rp(T.ong)+'</b></div>'+(ongList.length?
    '<div class="tw"><table><thead><tr><th>Klien</th><th>Tgl</th><th>No. PO</th><th>Supplier</th><th>Jenis</th><th class="num">Ongkos kirim</th></tr></thead><tbody>'+
    ongList.map((p,n)=>{const k=clientKey(p),first=!n||clientKey(ongList[n-1])!==k;
      return '<tr><td>'+(first?'<b style="font-weight:600">'+esc(cmap[k].name)+'</b>':'')+'</td><td style="white-space:nowrap">'+esc(String(p.tanggal||'').slice(8,10)+'/'+String(p.tanggal||'').slice(5,7))+'</td><td><button class="pono" data-act="view" data-id="'+esc(p.id)+'">'+esc(p.no)+'</button></td><td>'+esc(p.supplier)+'</td><td>'+pill(jenisOf(p))+'</td><td class="num">'+rp(calc(p).ongkir)+'</td></tr>'}).join('')+
    '<tr><td colspan="5" class="num"><b>Total ongkos kirim</b></td><td class="num"><b>'+rp(T.ong)+'</b></td></tr></tbody></table></div>'
    :'<div class="empty">Tidak ada ongkos kirim pada '+esc(blnLabel(m))+(ck?' untuk '+esc(cname):'')+'.</div>')+'</div>';
  return '<div class="col"><div class="card"><div class="chead" style="margin:0"><div class="filters"><select id="rm">'+months.map(x=>'<option value="'+x+'"'+(x===m?' selected':'')+'>'+blnLabel(x)+'</option>').join('')+'</select>'+
    '<select id="rk"><option value="">Semua klien</option>'+clients.map(c=>'<option value="'+esc(c.key)+'"'+(c.key===ck?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select>'+
    (ck?'<button class="btn" data-act="rkall">Semua klien</button>':'')+'</div><button class="btn" data-act="csv">'+IC.dl+'Unduh rekap (Excel)</button></div>'+
    '<div style="font-size:12px;color:var(--ink2);margin-top:10px">Berisi PO yang sudah disetujui penuh pada bulan yang dipilih, dirinci per klien (kolom Project) dan per jenis transaksi. Jumlah sudah dipotong diskon; total sudah termasuk PPN dan ongkos kirim.</div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px">'+jMonth.map((j,i)=>tile(TI[i%2===0?0:1],i%2===0?IC.box:IC.rekap,esc(j),T.by[j]||0)).join('')+tile('t2',IC.clock,'Ongkos kirim',T.ong)+tile('t4',IC.coin,ck?'Total '+esc(cname):'Total bulan ini',T.total)+'</div>'+
    per+ong+(shown.length?shown.map(card).join(''):'<div class="card empty">Belum ada transaksi yang disetujui pada '+esc(blnLabel(m))+'.</div>')+'</div>';
}
function loadExcel(){return window.ExcelJS?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';s.onload=()=>ok();s.onerror=()=>no(new Error('exceljs'));document.head.appendChild(s)})}
async function rekapXLSX(){
  await loadExcel();
  const {m,clients,shown,ck,cname,T,yr,months12,ongList,cmap,jMonth,jYear}=rekap(),bl=blnLabel(m),wb=new ExcelJS.Workbook();wb.creator='Dashboard PO Naintiland';
  const thin={style:'thin',color:{argb:'FFBFBFBF'}},box={top:thin,left:thin,bottom:thin,right:thin},fill=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}}),NF='#,##0;-#,##0;"-"',
    H=['No','Tanggal','No. PO','Supplier','Uraian','Qty','Satuan','Harga Satuan (Rp)','Diskon (Rp)','Jumlah (Rp)'],AL=['center','center','left','left','left','center','center','right','right','right'],NC=H.length,L='J';
  const COL=n=>String.fromCharCode(64+n);
  const sheet=(name,orient,widths)=>{const w=wb.addWorksheet(name.slice(0,31),{views:[{showGridLines:false}],pageSetup:{orientation:orient,paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.4,right:.4,top:.5,bottom:.5,header:.2,footer:.2}}});w.columns=widths.map(x=>({width:x}));return w};
  const band=(w,r,n,text,st)=>{w.mergeCells(r,1,r,n);const c=w.getCell(r,1);c.value=text;Object.assign(c,st);return c};
  const head=(w,r,labels)=>{labels.forEach((h,i)=>{const c=w.getCell(r,i+1);c.value=h;c.font={bold:true,color:{argb:'FFFFFFFF'},size:10};c.fill=fill('FF4A442A');c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=box});w.getRow(r).height=24};
  const title=(w,n,t2)=>{band(w,1,n,'NAINTILAND',{font:{bold:true,size:14,color:{argb:'FF1F3864'}}});w.getRow(1).height=22;
    band(w,2,n,t2,{font:{bold:true,size:12}});
    band(w,3,n,'Berisi PO yang sudah disetujui penuh, berdasarkan tanggal PO. Jumlah sudah dipotong diskon; total termasuk PPN dan ongkos kirim.',{font:{italic:true,size:9,color:{argb:'FF7F7F7F'}}});return 5};
  const tag=ck?'  ·  '+cname.toUpperCase():'';
  // Satu lembar per jenis transaksi yang ada bulan ini: rincian per klien, masing-masing dengan total sendiri.
  jMonth.forEach(jn=>{
    const ws=sheet(jn,'landscape',[5,12,17,22,36,8,9,16,14,18]);let r=title(ws,NC,'REKAP '+jn.toUpperCase()+' PER KLIEN — '+bl.toUpperCase()+tag);
    const list=shown.filter(c=>c.j[jn]),totals=[];
    if(!list.length){band(ws,r,NC,'Tidak ada transaksi '+jn.toLowerCase()+' yang disetujui pada '+bl+'.',{font:{italic:true,size:10,color:{argb:'FF7F7F7F'}}});r+=2}
    list.forEach(c=>{const q=c.j[jn];
      band(ws,r,NC,'KLIEN: '+c.name.toUpperCase()+'  ·  '+q.po+' PO  ·  '+q.rows.length+' item',{font:{bold:true,size:11,color:{argb:'FF0A6C72'}}});ws.getRow(r).height=20;r++;
      head(ws,r,H);r++;const first=r;
      q.rows.forEach((x,n)=>{const d=String(x.p.tanggal||'').split('-'),dt=d.length===3?new Date(Date.UTC(+d[0],+d[1]-1,+d[2])):null;
        [n+1,dt,x.p.no,x.p.supplier,x.i.nama,num(x.i.qty),x.i.satuan||'',num(x.i.harga),num(x.i.diskon),x.i.jumlah].forEach((v,i)=>{const cl=ws.getCell(r,i+1);cl.value=v;cl.border=box;cl.font={size:10};cl.alignment={horizontal:AL[i],vertical:'middle',wrapText:i===3||i===4};if(i===1)cl.numFmt='dd/mm/yyyy';if(i>=7)cl.numFmt=NF;if(i===5)cl.numFmt='#,##0.###'});r++});
      [['PPN',q.ppn],['Ongkos kirim',q.ong]].forEach(x=>{if(!x[1])return;for(let i=1;i<=NC;i++)ws.getCell(r,i).border=box;const cl=ws.getCell(r,5);cl.value=x[0];cl.font={size:10,italic:true};const v=ws.getCell(r,NC);v.value=x[1];v.numFmt=NF;v.font={size:10};v.alignment={horizontal:'right'};r++});
      band(ws,r,NC-1,'TOTAL '+jn.toUpperCase()+' — '+c.name.toUpperCase(),{font:{bold:true,size:10},alignment:{horizontal:'right',vertical:'middle'}});
      for(let i=1;i<=NC;i++){const cl=ws.getCell(r,i);cl.border=box;cl.fill=fill('FFC4BD97')}
      const t=ws.getCell(r,NC);t.value={formula:'SUM('+L+first+':'+L+(r-1)+')',result:q.total};t.numFmt=NF;t.font={bold:true,size:10};t.alignment={horizontal:'right',vertical:'middle'};ws.getRow(r).height=20;totals.push(L+r);r+=2});
    const sum=list.reduce((a,c)=>a+c.j[jn].total,0);
    band(ws,r,NC-1,'TOTAL '+jn.toUpperCase()+' '+bl.toUpperCase()+tag,{font:{bold:true,size:11,color:{argb:'FFFFFFFF'}},alignment:{horizontal:'right',vertical:'middle'}});
    for(let i=1;i<=NC;i++){const cl=ws.getCell(r,i);cl.fill=fill('FF4A442A');cl.border=box}
    const gt=ws.getCell(r,NC);gt.value=totals.length?{formula:totals.join('+'),result:sum}:0;gt.numFmt=NF;gt.font={bold:true,size:11,color:{argb:'FFFFFFFF'}};gt.alignment={horizontal:'right',vertical:'middle'};ws.getRow(r).height=22;r+=2;
    band(ws,r,NC,'Dibuat '+tglShort(Date.now())+' dari Dashboard Pengajuan PO.',{font:{italic:true,size:8,color:{argb:'FF7F7F7F'}}});
  });
  // Lembar Ringkasan: per klien bulan ini, lalu total per bulan sepanjang tahun, dipisah per jenis transaksi dan ongkos kirim.
  const cols=jYear,nc=3+cols.length+2,cO=COL(4+cols.length),cT=COL(5+cols.length),cJ0=COL(4),cJ1=COL(3+cols.length);
  const w2=sheet('Ringkasan','landscape',[5,32,7].concat(cols.map(()=>16),[14,18]));let q=title(w2,nc,'RINGKASAN TRANSAKSI — '+bl.toUpperCase()+tag);
  const HS=cols.map(j=>j+' (Rp)').concat(['Ongkir (Rp)','Total (Rp)']);
  const sumRow=(r0,r1,rr,label)=>{w2.mergeCells(rr,1,rr,3);Object.assign(w2.getCell(rr,1),{value:label,font:{bold:true,size:10},alignment:{horizontal:'right'}});
    for(let i=1;i<=nc;i++){const x=w2.getCell(rr,i);x.border=box;x.fill=fill('FFC4BD97')}
    for(let i=4;i<=nc;i++){const col=COL(i),x=w2.getCell(rr,i);x.value=r1>=r0?{formula:'SUM('+col+r0+':'+col+r1+')'}:0;x.numFmt=NF;x.font={bold:true,size:10};x.alignment={horizontal:'right'}}};
  const row=(vals,hl)=>{vals.forEach((v,i)=>{const x=w2.getCell(q,i+1);x.value=v;x.border=box;x.font={size:10,bold:i===nc-1||!!hl};x.alignment={horizontal:i===1?'left':i<3?'center':'right',vertical:'middle'};if(i>=3)x.numFmt=NF;if(hl)x.fill=fill('FFE8F4F3')});q++};
  const tot=()=>({formula:'SUM('+cJ0+q+':'+cJ1+q+')'});
  band(w2,q,nc,'A. PER KLIEN — '+bl.toUpperCase(),{font:{bold:true,size:11,color:{argb:'FF0A6C72'}}});q++;
  head(w2,q,['No','Klien / Project','PO'].concat(HS));q++;
  let f0=q;shown.forEach((c,n)=>row([n+1,c.name,c.po].concat(cols.map(j=>c.by[j]||0),[c.ong,Object.assign(tot(),{result:c.total})])));
  sumRow(f0,q-1,q,'TOTAL '+bl.toUpperCase());q+=1;
  band(w2,q,nc,'Ongkir sudah termasuk di kolom jenis transaksinya; kolom Ongkir menunjukkan bagiannya. Total = jumlah semua kolom jenis transaksi.',{font:{italic:true,size:8,color:{argb:'FF7F7F7F'}}});q+=2;
  band(w2,q,nc,'B. TOTAL PER BULAN — TAHUN '+yr+(ck?' · '+cname.toUpperCase():''),{font:{bold:true,size:11,color:{argb:'FF0A6C72'}}});q++;
  head(w2,q,['No','Bulan','PO'].concat(HS));q++;
  f0=q;months12.forEach((x,n)=>row([n+1,blnLabel(x.m),x.po].concat(cols.map(j=>x.by[j]||0),[x.ong,Object.assign(tot(),{result:x.total})]),x.m===m));
  sumRow(f0,q-1,q,'TOTAL TAHUN '+yr);
  // Lembar Ongkos Kirim: setiap PO yang memakai ongkir bulan ini, dikelompokkan per klien.
  const w3=sheet('Ongkos Kirim','portrait',[5,30,12,17,24,20,18]);let o=title(w3,7,'REKAP ONGKOS KIRIM — '+bl.toUpperCase()+tag);
  const ot=[];
  if(!ongList.length){band(w3,o,7,'Tidak ada ongkos kirim pada '+bl+'.',{font:{italic:true,size:10,color:{argb:'FF7F7F7F'}}});o+=2}
  else{head(w3,o,['No','Klien / Project','Tanggal','No. PO','Supplier','Jenis','Ongkir (Rp)']);o++;
    let n=0,k0=null,g0=o;
    const close=()=>{w3.mergeCells(o,1,o,6);Object.assign(w3.getCell(o,1),{value:'Subtotal '+cmap[k0].name,font:{bold:true,size:10},alignment:{horizontal:'right'}});
      for(let i=1;i<=7;i++){const x=w3.getCell(o,i);x.border=box;x.fill=fill('FFEFEBDD')}
      const x=w3.getCell(o,7);x.value={formula:'SUM(G'+g0+':G'+(o-1)+')',result:cmap[k0].ong};x.numFmt=NF;x.font={bold:true,size:10};x.alignment={horizontal:'right'};ot.push('G'+o);o++};
    ongList.forEach(p=>{const k=clientKey(p);if(k0!==null&&k!==k0){close();g0=o}k0=k;
      const d=String(p.tanggal||'').split('-'),dt=d.length===3?new Date(Date.UTC(+d[0],+d[1]-1,+d[2])):null;
      [++n,cmap[k].name,dt,p.no,p.supplier,jenisOf(p),calc(p).ongkir].forEach((v,i)=>{const x=w3.getCell(o,i+1);x.value=v;x.border=box;x.font={size:10};x.alignment={horizontal:i===0||i===2||i===5?'center':i===6?'right':'left',vertical:'middle'};if(i===2)x.numFmt='dd/mm/yyyy';if(i===6)x.numFmt=NF});o++});
    close();o++}
  w3.mergeCells(o,1,o,6);Object.assign(w3.getCell(o,1),{value:'TOTAL ONGKOS KIRIM '+bl.toUpperCase()+tag,font:{bold:true,size:11,color:{argb:'FFFFFFFF'}},alignment:{horizontal:'right'}});
  for(let i=1;i<=7;i++){const x=w3.getCell(o,i);x.fill=fill('FF4A442A');x.border=box}
  const og=w3.getCell(o,7);og.value=ot.length?{formula:ot.join('+'),result:T.ong}:0;og.numFmt=NF;og.font={bold:true,size:11,color:{argb:'FFFFFFFF'}};og.alignment={horizontal:'right'};
  wb.views=[{activeTab:0}];
  const buf=await wb.xlsx.writeBuffer();
  return {name:'Rekap-Pembelian-'+m+(ck?'-'+cname.replace(/[^\w-]+/g,'_').slice(0,40):'')+'.xlsx',blob:new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
}
async function doCSV(btn){ btn.disabled = true; try { const r = await rekapXLSX(); await saveFile(r.name, r.blob); } catch(e){ console.error(e); toast(e && e.code === 'declined' ? 'Unduhan dibatalkan.' : e && e.code ? 'Unduhan tidak tersedia di tampilan ini.' : 'Gagal membuat file Excel. Periksa koneksi internet lalu coba lagi.'); } btn.disabled = false; }
/* ----- pengaturan (admin) ----- */
function roleSelect(uid, cur){
  return '<select data-role="'+esc(uid)+'"><option value="">Belum ditetapkan</option><option value="purchasing"'+(cur==='purchasing'?' selected':'')+'>'+esc(PURCH)+'</option>'+
    jab().map(l => '<option value="'+esc(l.id)+'"'+(cur===l.id?' selected':'')+'>'+esc(l.title)+'</option>').join('')+'</select>';
}
function usersHTML(){
  return '<table><tbody>'+Object.keys(S.users).map(id => { const u = S.users[id];
    return '<tr><td><b style="font-weight:500">'+esc(u.name||'(tanpa nama)')+'</b>'+(id===S.me.id?' <span style="color:var(--ink2)">· Anda</span>':'')+'<br><span style="font-size:11.5px;color:var(--ink2)">'+esc(u.email||'')+'</span></td><td style="width:45%">'+roleSelect(id, u.role||'')+'</td><td style="width:1%;white-space:nowrap">'+(id===S.cfg.adminUid?'<span class="st disetujui">Admin</span>':'<button class="btn sm" data-act="mkadmin" data-uid="'+esc(id)+'">Jadikan admin</button>')+'</td></tr>'; }).join('')+'</tbody></table>';
}
function renderUsers(){ const b = $('#usersBox'); if(b && !b.contains(document.activeElement)) b.innerHTML = usersHTML(); }
function setHTML(){
  // Satu tabel aturan nominal; key = 'rules' (Material) atau 'rulesInv' (Inventaris).
  const table = (key, title, note) => { const R = W[key];
    const modeSel = (ri, j) => { const cur = (R[ri].modes||{})[j.id] || 'none';
      return '<select data-k="'+key+'" data-rm="'+ri+'" data-j="'+esc(j.id)+'">'+[['approve','Menyetujui'],['know','Mengetahui'],['none','—']].map(o => '<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select>'; };
    // Keterangan rentang tiap baris, supaya jelas nominal mana yang dicakup ("Sampai" = batas atas).
    const span = ri => { const m = R[ri].max, hi = m == null ? Infinity : num(m);
      const lows = R.map(r => r.max == null ? Infinity : num(r.max)).filter(v => v < hi), lo = lows.length ? Math.max(...lows) : null;
      return (lo == null ? 'Rp 0' : 'di atas Rp ' + fnum(lo)) + (hi === Infinity ? ' dan seterusnya' : ' s.d. Rp ' + fnum(hi)); };
    return '<div class="chead" style="margin-top:26px"><h2>'+title+'</h2></div>'+(note ? '<div class="note">'+note+'</div>' : '')+
      '<div class="tw"><table class="mx"><thead><tr><th>Sampai (Rp)</th>'+W.jabatan.map(j => '<th>'+esc(j.title||'—')+'</th>').join('')+'<th></th></tr></thead><tbody>'+
      R.map((r,ri) => '<tr><td><input type="number" min="0" step="any" data-k="'+key+'" data-rmax="'+ri+'" value="'+(r.max==null?'':r.max)+'" placeholder="tanpa batas"><div style="font-size:11px;color:var(--ink2);margin-top:3px;white-space:nowrap">'+span(ri)+'</div></td>'+W.jabatan.map(j => '<td style="vertical-align:top">'+modeSel(ri,j)+'</td>').join('')+'<td><button class="x" data-act="rldel" data-k="'+key+'" data-i="'+ri+'" title="Hapus rentang">×</button></td></tr>').join('')+
      '</tbody></table></div><button class="btn sm" data-act="rladd" data-k="'+key+'" style="margin-top:8px">+ Tambah rentang</button>'; };
  return '<div class="chead"><h2>Jabatan (urutan persetujuan)</h2></div>'+
    W.jabatan.map((l,i) => '<div class="lv"><span>Tingkat '+(i+1)+'</span><input type="text" data-jb="'+i+'" value="'+esc(l.title)+'" maxlength="40" placeholder="Nama jabatan"><button class="x" data-act="jbdel" data-i="'+i+'" title="Hapus">×</button></div>').join('')+
    '<button class="btn sm" data-act="jbadd">+ Tambah jabatan</button>'+
    '<div class="note" style="margin-top:26px">Tiap baris adalah satu rentang nominal. Jabatan <b>Menyetujui</b> harus menekan Setujui secara berurutan sebelum PO bisa diunduh. Jabatan <b>Mengetahui</b> wajib menekan Mengetahui (kapan saja setelah PO diajukan); tanpa itu PO belum bisa diunduh. "Sampai (Rp)" adalah batas atas rentang; rentangnya mulai dari atas batas baris sebelumnya (lihat keterangan di bawah tiap angka). Kosongkan untuk rentang tanpa batas atas.</div>'+
    table('rules', 'Aturan nominal — Material & transaksi lainnya', 'Berlaku untuk semua jenis transaksi selain Inventaris: Material, Upah Tukang Borongan, Upah Buruh Harian, Biaya Fasum, dan Biaya Marketing.')+
    table('rulesInv', 'Aturan nominal — pembelian Inventaris', 'Berlaku untuk PO dengan Jenis transaksi <b>Inventaris</b>. Untuk batas "X ke atas", baris sebelumnya diisi X dikurangi 1 (mis. 24999999 untuk "25 juta ke atas", 99999999 untuk "100 juta ke atas").')+
    '<div class="mfoot" style="justify-content:flex-end;margin-top:22px"><button class="btn p" data-act="setsave">Simpan pengaturan</button></div>';
}
function vSet(){
  if(!isAdmin()) return '<div class="card empty">Jabatan dan aturan persetujuan hanya dapat diubah oleh admin.<br><br><button class="btn" data-act="profile">Ubah profil & tanda tangan saya</button></div>';
  if(!W) W = {jabatan: clone(jab()), rules: clone(rules()), rulesInv: clone(rulesInv())};
  return '<div class="col"><div class="card" id="setBox">'+setHTML()+'</div>'+
    '<div class="card"><div class="chead"><h2>Jabatan pengguna</h2></div><div class="note">Pengguna muncul di sini setelah mendaftar akun. Pilih jabatannya; perubahan langsung tersimpan.</div><div id="usersBox">'+usersHTML()+'</div></div></div>';
}
async function saveSettings(btn){
  if(W.jabatan.some(j => !j.title.trim())) return toast('Nama jabatan tidak boleh kosong.');
  const ids = W.jabatan.map(j => j.id), out = {};
  for(const [key, label] of [['rules','Material & lainnya'], ['rulesInv','Inventaris']]){
    const rs = W[key].map(r => { const m = {}; ids.forEach(id => m[id] = (r.modes||{})[id] || 'none'); return {max: r.max==null||r.max==='' ? null : num(r.max), modes: m}; })
      .sort((a,b) => (a.max==null?Infinity:a.max) - (b.max==null?Infinity:b.max));
    if(rs.some(r => !Object.values(r.modes).includes('approve'))) return toast('Aturan '+label+': setiap rentang perlu minimal satu jabatan yang Menyetujui.');
    if(rs.filter(r => r.max == null).length !== 1) return toast('Aturan '+label+': harus ada tepat satu rentang "tanpa batas" untuk nominal terbesar.');
    if(new Set(rs.map(r => r.max)).size !== rs.length) return toast('Aturan '+label+': ada dua rentang dengan batas yang sama.');
    out[key] = rs;
  }
  btn.disabled = true;
  const ok = await updCfg({jabatan: W.jabatan.map(j => ({id:j.id, title:j.title.trim()})), rules: out.rules, rulesInv: out.rulesInv});
  btn.disabled = false;
  if(ok){ W = null; toast('Pengaturan tersimpan. Berlaku untuk PO yang diajukan mulai sekarang.'); render(); }
}

/* ---------- modal ---------- */
function closeModal(){ $('#modal').innerHTML = ''; pad = null; }
function modal(html, small){ $('#modal').innerHTML = '<div class="ov"><div class="modal'+(small?' s':'')+'">'+html+'</div></div>'; }
function confirmBox(title, text, label, danger, fn){
  modal('<h2>'+esc(title)+'</h2><div class="sub">'+esc(text)+'</div><div class="mfoot"><button class="btn" data-act="close">Batal</button><button class="btn '+(danger?'d solid':'p')+'" id="cfm">'+esc(label)+'</button></div>', true);
  $('#cfm').onclick = async () => { $('#cfm').disabled = true; await fn(); if($('#cfm')) $('#cfm').disabled = false; };
}
function itemRow(it, i){
  return '<tr data-i="'+i+'"><td><input type="text" data-f="nama" value="'+esc(it.nama)+'" placeholder="Uraian / nama barang"></td><td style="width:74px"><input class="n" type="number" min="0" step="any" data-f="qty" value="'+esc(it.qty)+'"></td><td style="width:76px"><input type="text" data-f="satuan" value="'+esc(it.satuan)+'" placeholder="lbr"></td><td style="width:124px"><input class="n" type="number" min="0" step="any" data-f="harga" value="'+esc(it.harga)+'"></td><td style="width:108px"><input class="n" type="number" min="0" step="any" data-f="diskon" value="'+esc(it.diskon)+'"></td><td style="width:118px" class="num" data-j></td><td style="width:130px"><input type="text" data-f="ket" value="'+esc(it.ket)+'"></td><td style="width:34px"><button class="x" data-act="rowdel" title="Hapus baris">×</button></td></tr>';
}
const blankItem = () => ({nama:'', qty:'', satuan:'', harga:'', diskon:'', ket:''});
function openForm(po){
  F = po ? clone(po) : {id:null, no:'', tanggal:today(), project:'', supplier:'', vendor:'', prioritas:'Normal', jenis:'Material', bank:'', rek:'', an:'', items:[blankItem()], ppnPct:0, ongkir:0, catatan:DEF_NOTE, status:'draft'};
  if(!po) F.no = nextNo(F.tanggal);
  F.items = F.items.map(i => ({...i, diskon: num(i.diskon) ? i.diskon : ''}));
  const had = po && (po.approvals||[]).length;
  modal('<h2>'+(po?'Edit':'Form')+' Pengajuan PO</h2><div class="sub">Diisi oleh '+esc(PURCH)+'. Simpan sebagai draft atau langsung ajukan untuk persetujuan.</div>'+
    (had ? '<div class="note warn">PO ini sudah punya persetujuan. Menyimpan perubahan akan mengulang proses persetujuan dari awal.</div>' : '')+
    '<div class="fg"><div><label>No. PO</label><input type="text" id="fNo" maxlength="30" value="'+esc(F.no)+'" title="Terisi otomatis, boleh diubah"></div><div><label>Tanggal</label><input type="date" id="fTgl" value="'+esc(F.tanggal)+'"></div><div><label>Prioritas</label><select id="fPri">'+['Normal','Urgent','Sangat Urgent'].map(p => '<option'+(F.prioritas===p?' selected':'')+'>'+p+'</option>').join('')+'</select></div>'+
    '<div><label>Project</label><input type="text" id="fPro" value="'+esc(F.project)+'" placeholder="Nama project / klien"></div><div><label>Supplier</label><input type="text" id="fSup" value="'+esc(F.supplier)+'" placeholder="Nama supplier"></div><div><label>Vendor <span style="font-weight:400">(opsional)</span></label><input type="text" id="fVen" maxlength="60" list="venList" value="'+esc(F.vendor)+'" placeholder="Nama vendor"><datalist id="venList">'+[...new Set(S.pos.map(p=>String(p.vendor||'').trim()).filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist></div><div><label>Jenis transaksi</label><select id="fJen">'+JENIS.map(j => '<option'+(jenisOf(F)===j?' selected':'')+'>'+j+'</option>').join('')+'</select></div><div><label>Bank supplier</label><input type="text" id="fBank" maxlength="30" value="'+esc(F.bank)+'" placeholder="mis. BCA"></div><div><label>No. rekening supplier</label><input type="text" id="fRek" maxlength="40" inputmode="numeric" value="'+esc(F.rek)+'" placeholder="Tercetak di PO"></div><div><label>Atas nama</label><input type="text" id="fAn" maxlength="60" value="'+esc(F.an)+'" placeholder="Nama pemilik rekening"></div></div>'+
    '<div class="tw"><table class="items" style="min-width:760px"><thead><tr><th>Uraian / nama barang</th><th>Qty</th><th>Satuan</th><th>Harga satuan</th><th>Diskon (Rp)</th><th class="num">Jumlah</th><th>Keterangan</th><th></th></tr></thead><tbody id="fItems">'+F.items.map(itemRow).join('')+'</tbody></table></div>'+
    '<button class="btn sm" data-act="rowadd" style="margin-top:8px">+ Tambah baris</button>'+
    '<div class="tot"><div style="flex:1;min-width:240px"><label>Catatan</label><textarea id="fCat" rows="3">'+esc(F.catatan)+'</textarea><div class="flowhint" id="fFlow"></div></div><div class="sum"><div><span>Subtotal</span><b id="sSub"></b></div><div><span><input type="checkbox" id="fPpn"'+(num(F.ppnPct)?' checked':'')+' style="width:auto"> PPN 11%</span><b id="sPpn"></b></div><div style="align-items:center"><span>Ongkos kirim</span><input class="n" type="number" min="0" step="any" id="fOng" value="'+(num(F.ongkir)||'')+'" placeholder="0" style="width:150px;text-align:right;padding:6px 10px"></div><div class="g"><span>TOTAL</span><span id="sTot"></span></div></div></div>'+
    '<div class="mfoot"><button class="btn" data-act="close">Batal</button><button class="btn" data-act="save" data-s="draft">Simpan draft</button><button class="btn p" data-act="save" data-s="diajukan">Ajukan persetujuan</button></div>');
  sums();
}
function fillRek(){const s=$('#fSup').value.trim().toLowerCase();if(!s||$('#fRek').value.trim())return;const p=sorted().find(x=>x.rek&&String(x.supplier||'').trim().toLowerCase()===s&&x.id!==F.id);if(p){$('#fBank').value=p.bank||'';$('#fRek').value=p.rek||'';$('#fAn').value=p.an||'';toast('Rekening '+p.supplier+' diisi otomatis dari PO sebelumnya.')}}
function readForm(){
  F.no = $('#fNo').value.trim(); F.tanggal = $('#fTgl').value || today(); F.prioritas = $('#fPri').value; F.jenis = $('#fJen').value; F.bank = $('#fBank').value.trim(); F.rek = $('#fRek').value.trim(); F.an = $('#fAn').value.trim(); F.project = $('#fPro').value.trim(); F.supplier = $('#fSup').value.trim(); F.vendor = $('#fVen').value.trim(); F.catatan = $('#fCat').value.trim(); F.ppnPct = $('#fPpn').checked ? 11 : 0; F.ongkir = Math.max(0, num($('#fOng').value));
  F.items = [...document.querySelectorAll('#fItems tr')].map(tr => { const o = {}; tr.querySelectorAll('[data-f]').forEach(i => o[i.dataset.f] = i.value.trim()); return o; });
}
function sums(){
  readForm(); const c = calc(F), f = flowFor(F);
  document.querySelectorAll('#fItems tr').forEach((tr,i) => tr.querySelector('[data-j]').textContent = rp(c.items[i].jumlah));
  $('#sSub').textContent = rp(c.subtotal); $('#sPpn').textContent = rp(c.ppn); $('#sTot').textContent = rp(c.total);
  $('#fFlow').textContent = 'Alur untuk nominal ini — Menyetujui: ' + f.flow.map(l => l.title).join(' → ') + (f.knowers.length ? ' · Mengetahui: ' + f.knowers.map(l => l.title).join(', ') : '');
}
function submitFields(po){ const f = flowFor(po); return {flow: clone(f.flow), knowers: clone(f.knowers), knowIds: f.knowers.map(k => k.id)}; }
async function saveForm(status, btn){
  readForm();
  const items = F.items.filter(i => i.nama).map(i => ({nama:i.nama, qty:num(i.qty), satuan:i.satuan, harga:num(i.harga), diskon:num(i.diskon), ket:i.ket}));
  if(!F.no) return toast('No. PO wajib diisi.');
  if(S.pos.some(p => p.id !== F.id && String(p.no||'').trim().toLowerCase() === F.no.toLowerCase())) return toast('No. PO '+F.no+' sudah dipakai PO lain. Gunakan nomor yang berbeda.');
  if(!F.project || !F.supplier) return toast('Project dan Supplier wajib diisi.');
  if(!items.length) return toast('Isi minimal satu material.');
  if(items.some(i => i.qty <= 0)) return toast('Qty setiap material harus lebih dari 0.');
  const m = me(), now = Date.now(), old = F.id ? memPO(F.id) : null;
  if(!m.name) return toast('Isi nama Anda di profil dulu (klik nama di kanan atas).');
  const d = {no:F.no, tanggal:F.tanggal, project:F.project, supplier:F.supplier, vendor:F.vendor, prioritas:F.prioritas, jenis:F.jenis, bank:F.bank, rek:F.rek, an:F.an, items, ppnPct:F.ppnPct, ongkir:F.ongkir, catatan:F.catatan, status,
    step:0, approvals:[], knows:[], rejected:null, flow:[], knowers:[], knowIds:[],
    createdBy: old ? old.createdBy : S.me.id, createdAt: old ? old.createdAt : now, updatedAt: now,
    createdName: m.name, createdSig: okSig(m.sig) ? m.sig : ''};
  if(status === 'diajukan') Object.assign(d, submitFields(d));
  btn.disabled = true;
  if(await setPO(F.id || rid('p'), d)){ closeModal(); toast(status === 'diajukan' ? d.no+' diajukan ke '+d.flow[0].title+'.' : 'Draft '+d.no+' tersimpan.'); } else btn.disabled = false;
}
function openView(po){
  po = withLiveSigs(po);
  const c = calc(po), fl = poFlow(po), kn = shownKnowers(po), ap = po.approvals||[], ks = po.knows||[];
  const steps = '<div class="step '+(po.status==='draft'?'now':'done')+'"><small>Diajukan oleh</small><b>'+esc(PURCH)+'</b><span>'+esc(po.createdName||'-')+(po.status==='draft'?' · masih draft':'')+'</span>'+(okSig(po.createdSig)&&po.status!=='draft'?'<img src="'+po.createdSig+'" alt="">':'')+'</div>'+
    fl.map((l,i) => { const a = ap.find(x => x.levelId === l.id), rj = po.rejected && po.rejected.levelId === l.id, now = po.status==='diajukan' && (po.step||0) === i;
      return '<div class="step '+(a?'done':rj?'rej':now?'now':'')+'"><small>'+(fl.length===1?'Disetujui oleh':'Approval '+(i+1))+'</small><b>'+esc(l.title)+'</b><span>'+(a?'Disetujui '+esc(a.name)+' · '+tglShort(a.at):rj?'Ditolak '+esc(po.rejected.name)+' · '+tglShort(po.rejected.at):now?'Menunggu persetujuan':'Belum')+'</span>'+(a&&okSig(a.sig)?'<img src="'+a.sig+'" alt="">':'')+'</div>'; }).join('')+
    kn.map(l => { const k = ks.find(x => x.levelId === l.id);
      return '<div class="step '+(k?'done':'')+'"><small>Mengetahui</small><b>'+esc(l.title)+'</b><span>'+(k?'Diketahui '+esc(k.name)+' · '+tglShort(k.at):'Belum')+'</span>'+(k&&okSig(k.sig)?'<img src="'+k.sig+'" alt="">':'')+'</div>'; }).join('');
  const id = esc(po.id); let acts = '<button class="btn" data-act="close">Tutup</button>';
  if(canDelete(po)) acts += '<button class="btn d" data-act="del" data-id="'+id+'">Hapus</button>';
  if(canEdit(po)) acts += '<button class="btn" data-act="edit" data-id="'+id+'">Edit</button>';
  if(isPurch() && po.status === 'draft') acts += '<button class="btn p" data-act="submit" data-id="'+id+'">Ajukan persetujuan</button>';
  if(canApprove(po)) acts += '<button class="btn d" data-act="reject" data-id="'+id+'">Tolak</button><button class="btn p" data-act="approve" data-id="'+id+'">Setujui</button>';
  if(canKnow(po)) acts += '<button class="btn p" data-act="know" data-id="'+id+'">Mengetahui</button>';
  if(done(po)) acts += '<button class="btn p" data-act="pdf" data-id="'+id+'">'+IC.dl+'Unduh PO (PDF)</button>';
  modal('<div class="chead" style="margin:0"><h2>'+esc(po.no)+'</h2>'+stPill(po)+'</div>'+
    '<div class="kv"><div><small>Tanggal</small><b>'+esc(tgl(po.tanggal))+'</b></div><div><small>Project</small><b>'+esc(po.project)+'</b></div><div><small>Supplier</small><b>'+esc(po.supplier)+'</b></div><div><small>Vendor</small><b>'+esc(po.vendor||'-')+'</b></div><div><small>Prioritas</small><b>'+esc(po.prioritas||'-')+'</b></div><div><small>Jenis transaksi</small><b>'+esc(jenisOf(po))+'</b></div><div><small>Rekening supplier</small><b>'+esc(po.rek?[po.bank,po.rek].filter(Boolean).join(' ')+(po.an?' · a.n. '+po.an:''):'-')+'</b></div><div><small>Jumlah item</small><b>'+c.items.length+'</b></div></div>'+
    (po.rejected ? '<div class="note warn"><b>Alasan penolakan:</b> '+esc(po.rejected.reason||'-')+'</div>' : '')+
    '<div class="tw"><table><thead><tr><th>No</th><th>Nama material</th><th class="num">Qty</th><th>Satuan</th><th class="num">Harga satuan</th><th class="num">Diskon</th><th class="num">Jumlah</th><th>Keterangan</th></tr></thead><tbody>'+
    c.items.map((i,n) => '<tr><td>'+(n+1)+'</td><td>'+esc(i.nama)+'</td><td class="num">'+qtyf(i.qty)+'</td><td>'+esc(i.satuan)+'</td><td class="num">'+rp(i.harga)+'</td><td class="num">'+(num(i.diskon)?rp(i.diskon):'-')+'</td><td class="num">'+rp(i.jumlah)+'</td><td>'+esc(i.ket)+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="tot"><div style="flex:1;min-width:220px"><label>Catatan</label>'+esc(po.catatan||'-')+'</div><div class="sum"><div><span>Subtotal</span><b>'+rp(c.subtotal)+'</b></div><div><span>PPN'+(num(po.ppnPct)?' '+num(po.ppnPct)+'%':'')+'</span><b>'+(c.ppn?rp(c.ppn):'-')+'</b></div>'+(c.ongkir?'<div><span>Ongkos kirim</span><b>'+rp(c.ongkir)+'</b></div>':'')+'<div class="g"><span>TOTAL</span><span>'+rp(c.total)+'</span></div></div></div>'+
    '<label style="margin-top:18px">Alur persetujuan</label><div class="steps">'+steps+'</div>'+
    (!done(po) ? '<div class="sub" style="margin:14px 0 0">PO dapat diunduh setelah semua jabatan yang menyetujui menekan Setujui dan semua jabatan yang mengetahui menekan Mengetahui.</div>' : '')+
    '<div class="mfoot">'+acts+'</div>');
}
/* tanda tangan */
function initPad(cv, src){
  const ctx = cv.getContext('2d'); cv.width = 600; cv.height = 250; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  pad = {cv, dirty:false, has:!!src, load(im){
      // Hapus latar: tiap piksel dibandingkan dengan terang latar di sekitarnya, jadi kertas, bayangan,
      // dan pencahayaan tak rata ikut hilang; hanya goresan tinta yang tersisa, lalu dipotong pas dan dipusatkan.
      const sc = Math.min(1, 900/Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width*sc)), h = Math.max(1, Math.round(im.height*sc));
      const oc = document.createElement('canvas'); oc.width = w; oc.height = h; const ox = oc.getContext('2d', {willReadFrequently:true}); ox.drawImage(im, 0, 0, w, h);
      const d = ox.getImageData(0, 0, w, h), a = d.data, n = w*h, L = new Float32Array(n), W1 = w+1;
      for(let i=0;i<n;i++){ const al = a[i*4+3]/255; L[i] = (0.299*a[i*4] + 0.587*a[i*4+1] + 0.114*a[i*4+2])*al + 255*(1-al); }
      const I = new Float64Array(W1*(h+1));
      for(let y=0;y<h;y++){ let row = 0; for(let x=0;x<w;x++){ row += L[y*w+x]; I[(y+1)*W1+x+1] = I[y*W1+x+1] + row; } }
      const r = Math.max(12, Math.round(Math.max(w,h)/7)); let x0 = w, y0 = h, x1 = -1, y1 = -1, cnt = 0;
      for(let y=0;y<h;y++){ const ya = Math.max(0,y-r), yb = Math.min(h,y+r+1);
        for(let x=0;x<w;x++){ const xa = Math.max(0,x-r), xb = Math.min(w,x+r+1);
          const bg = (I[yb*W1+xb] - I[ya*W1+xb] - I[yb*W1+xa] + I[ya*W1+xa]) / ((yb-ya)*(xb-xa));
          const i = y*w+x; let al = ((bg - L[i])/Math.max(bg,1) - 0.12)/0.2; al = al < 0 ? 0 : al > 1 ? 1 : al;
          a[i*4] *= 0.55; a[i*4+1] *= 0.55; a[i*4+2] *= 0.55; a[i*4+3] = Math.round(al*255);
          if(al > 0.6){ cnt++; if(x<x0) x0 = x; if(x>x1) x1 = x; if(y<y0) y0 = y; if(y>y1) y1 = y; } } }
      if(cnt < 40){ toast('Tanda tangan tidak terdeteksi. Pakai foto tinta gelap di atas kertas terang.'); return; }
      ox.putImageData(d, 0, 0);
      const bw = x1-x0+1, bh = y1-y0+1, k = Math.min(576/bw, 226/bh), dw = bw*k, dh = bh*k;
      ctx.clearRect(0, 0, 600, 250); ctx.drawImage(oc, x0, y0, bw, bh, (600-dw)/2, (250-dh)/2, dw, dh); this.has = this.dirty = true; }, clear(){ ctx.clearRect(0,0,600,250); this.has = false; this.dirty = true; }};
  if(src){ const im = new Image(); im.onload = () => ctx.drawImage(im,0,0,600,250); im.src = src; }
  let on = false; const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*600, (e.clientY-r.top)/r.height*250]; };
  cv.onpointerdown = e => { on = true; cv.setPointerCapture(e.pointerId); const [x,y] = pt(e); ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+.1,y+.1); ctx.stroke(); pad.has = pad.dirty = true; };
  cv.onpointermove = e => { if(!on) return; const [x,y] = pt(e); ctx.lineTo(x,y); ctx.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { on = false; };
}
function openProfile(){
  const m = me();
  modal('<h2>Profil saya</h2><div class="sub">Nama dan tanda tangan ini tercetak pada PO yang Anda ajukan, setujui, atau ketahui. Mengganti atau menghapus tanda tangan langsung berlaku di semua PO tersebut.</div>'+
    '<label>Nama (tercetak di PO)</label><input type="text" id="pName" maxlength="60" value="'+esc(m.name)+'" placeholder="mis. Ardiansa">'+
    '<label style="margin-top:14px">Tanda tangan <span style="font-weight:400">— gambar di kotak, atau unggah foto/scan (latar belakangnya dihapus otomatis)</span></label><canvas class="pad" id="pPad"></canvas><input type="file" id="pFile" accept="image/*" hidden>'+
    '<div class="mfoot" style="justify-content:space-between"><span style="display:flex;gap:8px"><button class="btn sm" data-act="padup">Unggah gambar</button><button class="btn sm" data-act="padclear">Hapus</button></span><span style="display:flex;gap:10px"><button class="btn" data-act="close">Batal</button><button class="btn p" data-act="psave">Simpan</button></span></div>', true);
  initPad($('#pPad'), okSig(m.sig) ? m.sig : '');
}
async function saveProfile(btn){
  const name = $('#pName').value.trim(); if(!name) return toast('Nama wajib diisi.');
  const sig = pad.dirty ? (pad.has ? pad.cv.toDataURL('image/png') : '') : (me().sig || '');
  btn.disabled = true; if(await updUser(S.me.id, {name, sig})){ closeModal(); toast('Profil tersimpan.'); } else btn.disabled = false;
}
const stamp = l => ({levelId:l.id, title:l.title, by:S.me.id, name:me().name, sig: okSig(me().sig) ? me().sig : '', at:Date.now()});
function needName(){ if(me().name) return false; toast('Isi nama Anda di profil dulu (klik nama di kanan atas).'); return true; }
function doApprove(po){
  if(needName()) return; const l = curLevel(po), fl = poFlow(po);
  confirmBox('Setujui '+po.no+'?', 'Anda menyetujui sebagai '+l.title+'. Total '+rp(calc(po).total)+' — '+po.supplier+'.', 'Setujui', false, async () => {
    const step = (po.step||0) + 1, fin = step >= fl.length;
    if(await updPO(po.id, {approvals:[...(po.approvals||[]), stamp(l)], step, status: fin ? 'disetujui' : 'diajukan', updatedAt:Date.now()})){
      closeModal(); const w = fin ? pendingKnow({...po, status:'disetujui'}) : []; toast(!fin ? po.no+' disetujui, diteruskan ke '+fl[step].title+'.' : w.length ? po.no+' disetujui. Menunggu diketahui '+w.map(l => l.title).join(', ')+'.' : po.no+' disetujui penuh — PO siap diunduh.'); }
  });
}
function doKnow(po){
  if(needName()) return; const l = (po.knowers||[]).find(k => k.id === myRole());
  confirmBox('Tandai mengetahui '+po.no+'?', 'Nama dan tanda tangan Anda tercetak di kolom Mengetahui ('+l.title+'). Total '+rp(calc(po).total)+'.', 'Mengetahui', false, async () => {
    if(await updPO(po.id, {knows:[...(po.knows||[]), stamp(l)], updatedAt:Date.now()})){ closeModal(); toast(po.no+' ditandai diketahui '+l.title+'.'); }
  });
}
function doReject(po){
  const l = curLevel(po);
  modal('<h2>Tolak '+esc(po.no)+'?</h2><div class="sub">'+esc(PURCH)+' dapat memperbaiki lalu mengajukan ulang.</div><label>Alasan penolakan</label><textarea id="rj" rows="3"></textarea><div class="mfoot"><button class="btn" data-act="close">Batal</button><button class="btn d solid" id="rjb">Tolak PO</button></div>', true);
  $('#rjb').onclick = async () => { const reason = $('#rj').value.trim(); if(!reason) return toast('Tulis alasan penolakan.'); $('#rjb').disabled = true;
    if(await updPO(po.id, {status:'ditolak', rejected:{levelId:l.id, by:S.me.id, name:me().name||l.title, reason, at:Date.now()}, updatedAt:Date.now()})){ closeModal(); toast(po.no+' ditolak.'); } else if($('#rjb')) $('#rjb').disabled = false; };
}
function doSubmit(po){
  if(needName()) return; const f = flowFor(po);
  confirmBox('Ajukan '+po.no+'?', 'PO akan dikirim ke '+f.flow[0].title+' untuk disetujui.', 'Ajukan', false, async () => {
    const d = clone(po); delete d.id;
    Object.assign(d, {status:'diajukan', step:0, approvals:[], knows:[], rejected:null, createdName:me().name, createdSig: okSig(me().sig) ? me().sig : '', updatedAt:Date.now()}, submitFields(po));
    if(await setPO(po.id, d)){ closeModal(); toast(po.no+' diajukan.'); }
  });
}

/* ---------- PDF (format Po_003 di atas kop surat) ---------- */
// Tanda tangan di PO selalu mengikuti profil penandatangan saat ini: diunggah -> langsung tampil,
// dihapus -> kosong. Salinan yang tersimpan di PO hanya dipakai bila akunnya sudah tidak ada.
const liveSig = (uid, snap) => S.users[uid] ? (okSig(S.users[uid].sig) ? S.users[uid].sig : '') : (okSig(snap) ? snap : '');
function withLiveSigs(po){
  return {...po, createdSig: liveSig(po.createdBy, po.createdSig),
    approvals: (po.approvals||[]).map(a => ({...a, sig: liveSig(a.by, a.sig)})),
    knows: (po.knows||[]).map(k => ({...k, sig: liveSig(k.by, k.sig)}))};
}
function buildPDF(po){
  po = withLiveSigs(po);
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4',compress:true}),c=calc(po),fl=poFlow(po);
  const kn=shownKnowers(po),ks=po.knows||[];
  const L=20,R=190,INK=[38,50,56],MUTE=[118,128,132],ACC=[15,138,140],SOFT=[243,246,246],LINE=[218,225,226],WHITE=[255,255,255];
  const bg=()=>doc.addImage(KOP,'JPEG',0,0,210,297,'kop','FAST');
  const font=(st,sz,col)=>{doc.setFont('helvetica',st);doc.setFontSize(sz);doc.setTextColor(col[0],col[1],col[2])};
  const fit=(t,w)=>{t=String(t==null?'':t);if(doc.getTextWidth(t)<=w)return t;while(t.length>1&&doc.getTextWidth(t+'…')>w)t=t.slice(0,-1);return t+'…'};
  const cap=(t,x,y,al)=>{font('bold',6.5,MUTE);doc.text(String(t).toUpperCase(),x,y,al?{align:al}:{charSpace:.3})};
  const hair=(x1,y,x2)=>{doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.2);doc.line(x1,y,x2,y)};
  /* kepala */
  bg();
  font('bold',20,INK);doc.text('PURCHASE ORDER',L,44);
  font('bold',12,ACC);doc.text(String(po.no||''),R,40.5,{align:'right'});
  font('normal',8.5,MUTE);doc.text(tgl(po.tanggal),R,45.3,{align:'right'});
  hair(L,49,R);doc.setDrawColor(ACC[0],ACC[1],ACC[2]);doc.setLineWidth(.9);doc.line(L,49,L+22,49);
  /* kartu info */
  const cy=54,ch=27,cw2=82,rx=R-cw2;
  doc.setFillColor(SOFT[0],SOFT[1],SOFT[2]);doc.roundedRect(L,cy,cw2,ch,2,2,'F');doc.roundedRect(rx,cy,cw2,ch,2,2,'F');
  cap('Supplier',L+5,cy+6.5);font('bold',10.5,INK);doc.text(fit(po.supplier,po.vendor?36:cw2-10),L+5,cy+12.5);
  if(po.vendor){cap('Vendor',L+45,cy+6.5);font('bold',10.5,INK);doc.text(fit(po.vendor,cw2-50),L+45,cy+12.5)}
  if(po.rek){cap('Rekening pembayaran',L+5,cy+18);font('normal',8.5,INK);doc.text(fit([po.bank,po.rek].filter(Boolean).join('  ')+(po.an?'  ·  a.n. '+po.an:''),cw2-10),L+5,cy+22.8)}
  [['Project',po.project,0,0],['Prioritas',po.prioritas||'-',1,0],['Jenis transaksi',jenisOf(po),0,1],['Jumlah item',String(c.items.length),1,1]].forEach(k=>{
    const x=rx+5+k[2]*42,y=cy+6.5+k[3]*11.5;cap(k[0],x,y);font('bold',9,INK);doc.text(fit(k[1],k[2]?30:38),x,y+5)});
  /* tabel */
  const Wc=[8,56,15,15,27,28,21],H=['No',(jenisOf(po)==='Material'||jenisOf(po)==='Inventaris')?'Nama Barang':'Uraian','Qty','Satuan','Harga Satuan','Jumlah','Keterangan'],X=[L];Wc.forEach(w=>X.push(X[X.length-1]+w));
  const AL=['center','left','center','center','right','right','left'],tx=i=>AL[i]==='left'?X[i]+2:AL[i]==='right'?X[i+1]-2:X[i]+Wc[i]/2;
  const head=y=>{doc.setFillColor(INK[0],INK[1],INK[2]);doc.roundedRect(L,y,R-L,8,1.5,1.5,'F');font('bold',7.5,WHITE);H.forEach((h,i)=>doc.text(h,tx(i),y+5.2,{align:AL[i]}));return y+8};
  let y=head(88);
  c.items.forEach((it,i)=>{
    font('normal',8.5,INK);const nm=doc.splitTextToSize(String(it.nama||''),Wc[1]-4).slice(0,2),rh=nm.length>1?10.5:7;
    if(y+rh>262){doc.addPage();bg();font('bold',9,MUTE);doc.text('PURCHASE ORDER  ·  '+po.no+'  (lanjutan)',L,42);y=head(46)}
    if(i%2){doc.setFillColor(SOFT[0],SOFT[1],SOFT[2]);doc.rect(L,y,R-L,rh,'F')}
    const ty=y+4.7,ket=[num(it.diskon)?'Dsc '+fnum(it.diskon):'',it.ket].filter(Boolean).join(' ');
    font('normal',8.5,MUTE);doc.text(String(i+1),tx(0),ty,{align:'center'});
    font('normal',8.5,INK);doc.text(nm,tx(1),ty);doc.text(qtyf(it.qty),tx(2),ty,{align:'center'});doc.text(fit(it.satuan||'',Wc[3]-3),tx(3),ty,{align:'center'});doc.text(fnum(it.harga),tx(4),ty,{align:'right'});
    font('bold',8.5,INK);doc.text(fnum(it.jumlah),tx(5),ty,{align:'right'});
    font('normal',7.5,MUTE);doc.text(fit(ket,Wc[6]-3),tx(6),ty);
    y+=rh;hair(L,y,R)});
  /* total & catatan */
  if(y+78>270){doc.addPage();bg();font('bold',9,MUTE);doc.text('PURCHASE ORDER  ·  '+po.no+'  (lanjutan)',L,42);y=46}
  y+=5;const ty0=y,bx=X[4]-4,vx=R-3;
  [['Subtotal',rp(c.subtotal)],['PPN'+(num(po.ppnPct)?' '+num(po.ppnPct)+'%':''),c.ppn?rp(c.ppn):'-']].concat(c.ongkir?[['Ongkos kirim',rp(c.ongkir)]]:[]).forEach(r=>{font('normal',8.5,MUTE);doc.text(r[0],bx+3,y+3.5);font('normal',8.5,INK);doc.text(r[1],vx,y+3.5,{align:'right'});y+=6});
  y+=1;doc.setFillColor(ACC[0],ACC[1],ACC[2]);doc.roundedRect(bx,y,R-bx,10,2,2,'F');font('bold',8.5,WHITE);doc.text('TOTAL',bx+4,y+6.4);font('bold',12,WHITE);doc.text(rp(c.total),vx,y+6.8,{align:'right'});y+=10;
  cap('Catatan',L,ty0+3.5);font('italic',8,MUTE);doc.text(doc.splitTextToSize(po.catatan||'-',bx-L-10).slice(0,4),L,ty0+8.5);
  /* tanda tangan */
  y+=13;cap('Persetujuan',L,y);hair(L+24,y-1,R);y+=7;
  const cols=[{t:'Diajukan oleh',r:PURCH,n:po.createdName,s:po.createdSig}]
    .concat(fl.map((l,i)=>{const a=(po.approvals||[]).find(x=>x.levelId===l.id)||{};return{t:fl.length===1?'Disetujui oleh':'Approval '+(i+1),r:l.title,n:a.name,s:a.sig,at:a.at,w:'Disetujui'}}))
    .concat(kn.map(l=>{const k=ks.find(x=>x.levelId===l.id)||{};return{t:'Mengetahui',r:l.title,n:k.name,s:k.sig,at:k.at,w:'Diketahui'}}));
  const cw=(R-L)/cols.length,sm=cols.length>4;
  cols.forEach((s,i)=>{const cx=L+i*cw+cw/2,hw=Math.min(cw/2-3,22);
    cap(s.t,cx,y,'center');
    if(okSig(s.s)){const sw=Math.min(36,cw-6),sh=sw*5/12;try{doc.addImage(s.s,'PNG',cx-sw/2,y+2+(17-sh)/2,sw,sh,undefined,'FAST')}catch(e){}}
    else if(s.at){font('italic',6.5,MUTE);doc.text(s.w+' secara digital',cx,y+11,{align:'center'})}
    doc.setDrawColor(INK[0],INK[1],INK[2]);doc.setLineWidth(.3);doc.line(cx-hw,y+21,cx+hw,y+21);
    font('bold',sm?7.5:8.5,INK);doc.text(fit(s.n||'',cw-4),cx,y+25.3,{align:'center'});
    font('normal',sm?6.5:7.5,MUTE);doc.text(fit(s.r,cw-4),cx,y+29.2,{align:'center'});
    if(s.at){font('normal',6.5,MUTE);doc.text(tglShort(s.at),cx,y+32.8,{align:'center'})}});
  return doc;
}
function doPDF(po){
  if(!done(po)) return toast('PO baru bisa diunduh setelah disetujui dan diketahui semua jabatan yang wajib.');
  if(!window.jspdf) return toast('Pembuat PDF gagal dimuat. Muat ulang halaman lalu coba lagi.');
  let blob; try { blob = buildPDF(po).output('blob'); } catch(e){ console.error(e); return toast('Gagal membuat PDF.'); }
  saveFile(String(po.no).replace(/[^\w.-]+/g,'_') + '.pdf', blob).catch(e => toast(e && e.code === 'declined' ? 'Unduhan dibatalkan.' : 'Unduhan tidak tersedia di tampilan ini.'));
}

/* ---------- peristiwa ---------- */
const redrawSet = () => { $('#setBox').innerHTML = setHTML(); };
document.addEventListener('submit', e => { if(e.target.id === 'gateForm'){ e.preventDefault(); gateSubmit(); } });
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if(g){ location.hash = g.dataset.go; return; }
  const b = e.target.closest('[data-act]'); if(!b) return;
  const a = b.dataset.act, po = b.dataset.id ? memPO(b.dataset.id) : null;
  if(b.dataset.id && !po) return toast('PO tidak ditemukan.');
  if(a === 'close') closeModal();
  else if(a === 'gswitch'){ S.gate = S.gate === 'login' ? 'daftar' : 'login'; render(); }
  else if(a === 'greset'){ const em = $('#gEmail').value.trim(); if(!em) return toast('Isi email Anda dulu.'); auth.sendPasswordResetEmail(em).then(() => toast('Tautan atur ulang kata sandi dikirim ke '+em+'.')).catch(er => toast(AUTH_MSG[er.code] || 'Gagal mengirim tautan.')); }
  else if(a === 'logout'){ if(auth) auth.signOut(); else toast('Mode demo tidak memakai login.'); }
  else if(a === 'rkc'){ S.rk = b.dataset.k; render(); window.scrollTo(0,0); }
  else if(a === 'rkall'){ S.rk = ''; render(); }
  else if(a === 'golist') location.hash = 'pengajuan';
  else if(a === 'goappr') location.hash = 'persetujuan';
  else if(a === 'new') openForm(null);
  else if(a === 'view') openView(po);
  else if(a === 'edit') openForm(po);
  else if(a === 'del') confirmBox('Hapus '+po.no+'?', 'Pengajuan ini akan dihapus permanen.', 'Hapus', true, async () => { if(await delPO(po.id)){ closeModal(); toast(po.no+' dihapus.'); } });
  else if(a === 'submit') doSubmit(po);
  else if(a === 'approve') doApprove(po);
  else if(a === 'reject') doReject(po);
  else if(a === 'know') doKnow(po);
  else if(a === 'pdf') doPDF(po);
  else if(a === 'save') saveForm(b.dataset.s, b);
  else if(a === 'rowadd'){ readForm(); F.items.push(blankItem()); $('#fItems').innerHTML = F.items.map(itemRow).join(''); sums(); }
  else if(a === 'rowdel'){ readForm(); if(F.items.length > 1){ F.items.splice(+b.closest('tr').dataset.i, 1); $('#fItems').innerHTML = F.items.map(itemRow).join(''); sums(); } }
  else if(a === 'profile') openProfile();
  else if(a === 'padclear'){ if(pad) pad.clear(); }
  else if(a === 'padup') $('#pFile').click();
  else if(a === 'csv') doCSV(b);
  else if(a === 'psave') saveProfile(b);
  else if(a === 'jbadd'){ if(W.jabatan.length >= 6) return toast('Maksimal 6 jabatan.'); const id = rid('j'); W.jabatan.push({id, title:''}); W.rules.concat(W.rulesInv).forEach(r => r.modes[id] = 'none'); redrawSet(); }
  else if(a === 'jbdel'){ if(W.jabatan.length <= 1) return toast('Minimal satu jabatan.'); const j = W.jabatan.splice(+b.dataset.i, 1)[0]; W.rules.concat(W.rulesInv).forEach(r => delete r.modes[j.id]); redrawSet(); }
  else if(a === 'rladd'){ const R = W[b.dataset.k], m = {}; W.jabatan.forEach(j => m[j.id] = 'none'); R.splice(Math.max(R.length-1,0), 0, {max:0, modes:m}); redrawSet(); }
  else if(a === 'rldel'){ const R = W[b.dataset.k]; if(R.length <= 1) return toast('Minimal satu rentang.'); R.splice(+b.dataset.i, 1); redrawSet(); }
  else if(a === 'setsave') saveSettings(b);
  else if(a === 'mkadmin'){ const uid = b.dataset.uid, u = S.users[uid] || {}; confirmBox('Pindahkan admin ke '+(u.name||u.email||'pengguna ini')+'?', 'Admin hanya satu. Setelah dipindahkan, Anda tidak lagi bisa membuka Pengaturan; hanya admin baru yang bisa mengembalikannya.', 'Pindahkan admin', true, async () => { if(await updCfg({adminUid: uid})){ W = null; closeModal(); toast('Admin dipindahkan.'); render(); } }); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if(t.id === 'q'){ S.q = t.value; $('#listBody').innerHTML = poTable(filtered(), true, 'Tidak ada PO yang cocok.'); }
  else if(t.id === 'fNo'){ if(F) F.noEdited = true; }
  else if(t.closest('#fItems') || t.id === 'fPpn' || t.id === 'fOng' || t.id === 'fJen') sums();
  else if(t.dataset.jb != null) W.jabatan[+t.dataset.jb].title = t.value;
  else if(t.dataset.rmax != null) W[t.dataset.k][+t.dataset.rmax].max = t.value === '' ? null : num(t.value);
});
document.addEventListener('change', e => {
  const t = e.target;
  if(t.id === 'pFile'){ const f = t.files[0]; if(!f || !pad) return; const im = new Image(); im.onload = () => { pad.load(im); URL.revokeObjectURL(im.src); }; im.onerror = () => toast('Gambar tidak bisa dibaca. Pakai PNG atau JPG.'); im.src = URL.createObjectURL(f); t.value = ''; }
  else if(t.id === 'fs'){ S.fs = t.value; render(); }
  else if(t.id === 'fJen' && F) sums();
  else if(t.id === 'rm'){ S.rm = t.value; render(); }
  else if(t.id === 'rk'){ S.rk = t.value; render(); }
  else if(t.id === 'fSup') fillRek();
  else if(t.id === 'fTgl' && F && !F.id && !F.noEdited){ $('#fNo').value = F.no = nextNo(t.value || today()); }
  else if(t.dataset.rm != null) W[t.dataset.k][+t.dataset.rm].modes[t.dataset.j] = t.value;
  else if(t.dataset.jb != null || t.dataset.rmax != null) redrawSet();
  else if(t.dataset.role != null) updUser(t.dataset.role, {role: t.value}).then(ok => ok && toast('Jabatan diperbarui.'));
});
init();
