/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   สคริปต์ตรวจว่าหน้านั้นมี element ไหน แล้วทำงานเฉพาะส่วนที่เกี่ยวข้อง
   ========================================================== */

const ORDER_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyAXrUZtu0b_RkT7R8KMhTpT-dkGaTJvciFMpqwLSMD0MbVfxoEHnEYpwh2rGaP2eQe/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWiZWUFTORRUjQ2x16-LxoLdeEZeQFCTy_RjtTJrUuFoFcSBJk-X0nE_n6PkenDM5OdlCurF75MFOo/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

const TYPE_LABEL = { spray: 'น้ำหอมฉีดตัว', rollon: 'โรลออน' };

/* ---------- Helpers ---------- */

// สร้าง element แบบปลอดภัย (ใช้ textContent ไม่ใช้ innerHTML)
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value);
  });
  [].concat(children).forEach(child => child && node.appendChild(child));
  return node;
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH') : String(value);
}

/* ==========================================================
   1) หน้า product.html
   ========================================================== */

let allProducts = [];

function getMoodFromUrl() {
  const mood = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
  return MOODS.some(m => m.key === mood) ? mood : 'all';
}

function buildFilterBar(bar, activeMood) {
  bar.textContent = '';
  MOODS.forEach(({ key, label }) => {
    const btn = el('button', {
      type: 'button',
      class: 'filter-btn' + (key === activeMood ? ' is-active' : ''),
      dataset: key === 'all' ? {} : { mood: key },
      'aria-pressed': String(key === activeMood)
    });
    btn.dataset.filter = key;
    if (key !== 'all') btn.appendChild(el('span', { class: 'dot' }));
    btn.appendChild(document.createTextNode(label));
    btn.addEventListener('click', () => applyFilter(key));
    bar.appendChild(btn);
  });
}

function createCard(product) {
  const orderParams = new URLSearchParams({
    item: `${product.name} ${product.size}`,
    price: product.price
  });

  const media = el('div', { class: 'card__media' }, [
    el('img', {
      src: product.image,
      alt: `${product.name} ${product.size}`,
      loading: 'lazy'
    })
  ]);

  const body = el('div', { class: 'card__body' }, [
    el('span', { class: 'mood-label', text: product.mood.charAt(0).toUpperCase() + product.mood.slice(1) }),
    el('h3', { class: 'card__title', text: product.name }),
    el('p', { class: 'card__meta', text: `${TYPE_LABEL[product.type] || ''} · ${product.size}`.replace(/^ · /, '') })
  ]);

  const price = el('span', { class: 'price', text: formatPrice(product.price) }, [
    el('small', { text: 'บาท' })
  ]);

  const footer = el('div', { class: 'card__footer' }, [
    price,
    el('a', {
      class: 'btn btn--small',
      href: `order.html?${orderParams.toString()}`,
      text: 'สั่งซื้อ'
    })
  ]);

  return el('article', { class: 'card', dataset: { mood: product.mood } }, [media, body, footer]);
}

function renderProducts(mood) {
  const list = document.getElementById('product-list');
  if (!list) return;

  const items = mood === 'all' ? allProducts : allProducts.filter(p => p.mood === mood);
  list.textContent = '';

  if (items.length === 0) {
    list.appendChild(el('p', { class: 'text-center', text: 'ยังไม่มีสินค้าในหมวดนี้' }));
    return;
  }
  items.forEach(p => list.appendChild(createCard(p)));
}

function applyFilter(mood) {
  const bar = document.getElementById('filter-bar');
  if (bar) {
    bar.querySelectorAll('.filter-btn').forEach(btn => {
      const active = btn.dataset.filter === mood;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }
  renderProducts(mood);

  // อัปเดต URL ให้แชร์/รีเฟรชแล้วยังกรองเหมือนเดิม
  const url = new URL(window.location.href);
  if (mood === 'all') url.searchParams.delete('mood');
  else url.searchParams.set('mood', mood);
  history.replaceState(null, '', url);
}

async function initProductPage() {
  const list = document.getElementById('product-list');
  const bar = document.getElementById('filter-bar');
  if (!list) return;

  const initialMood = getMoodFromUrl();
  if (bar) buildFilterBar(bar, initialMood);

  try {
    const res = await fetch('products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProducts = await res.json();
    renderProducts(initialMood);
  } catch (error) {
    console.error(error);
    list.textContent = '';
    list.appendChild(el('p', {
      class: 'text-center',
      text: 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    }));
  }
}

/* ==========================================================
   2) หน้า order.html
   ========================================================== */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // เติมค่าจาก URL ลงทั้งช่อง items และ total ทันที
  const params = new URLSearchParams(window.location.search);
  const itemField = document.getElementById('items');
  const totalField = document.getElementById('total');
  const item = params.get('item');
  const price = params.get('price');
  if (itemField && item) itemField.value = item;
  if (totalField && price) totalField.value = price;

  form.addEventListener('submit', event => {
    event.preventDefault();

    const value = id => {
      const field = document.getElementById(id);
      return field ? field.value.trim() : '';
    };

    const payload = {
      customerName: value('customerName'),
      contact: value('contact'),
      items: value('items'),
      total: value('total'),
      note: value('note')
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ==========================================================
   3) หน้า admin.html
   ========================================================== */

// parse CSV เอง: รองรับ "..." , "" (เครื่องหมายคำพูดซ้อน), และขึ้นบรรทัดใหม่ในเซลล์
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(r => r.some(c => c.trim() !== ''));
}

async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const colCount = 6;
  const showMessage = message => {
    tbody.textContent = '';
    const td = el('td', { colspan: String(colCount), class: 'text-center', text: message });
    tbody.appendChild(el('tr', {}, [td]));
  };

  showMessage('กำลังโหลดข้อมูล...');

  try {
    const res = await fetch(ORDERS_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = parseCSV(await res.text());
    const dataRows = rows.slice(1); // ข้ามแถวหัวตาราง

    if (dataRows.length === 0) {
      showMessage('ยังไม่มีรายการสั่งซื้อ');
      return;
    }

    // Google Sheets ต่อแถวใหม่ไว้ล่างสุด → กลับลำดับให้รายการล่าสุดขึ้นก่อน
    dataRows.reverse();

    tbody.textContent = '';
    dataRows.forEach(r => {
      const tr = document.createElement('tr');
      for (let i = 0; i < colCount; i++) {
        let text = (r[i] || '').trim();
        if (i === 4 && text !== '' && Number.isFinite(Number(text))) {
          text = formatPrice(text); // จำนวนเงินรวม
        }
        tr.appendChild(el('td', { text }));
      }
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
  }
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
