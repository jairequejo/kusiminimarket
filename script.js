// ══════════════════════════════════════════════════════
//  CONFIGURACIÓN — ajusta según tu Sheet
// ══════════════════════════════════════════════════════
const SHEET_ID  = "2PACX-1vSmoZF5ZV1lhW6extam9u6Wx58u_M6wW3gXsRi8kDfuy1PXD16mV8KTeSlZwIudWeLs6Z5tYXb6ofoG";
const WA_NUMBER = "51932327885";

// Columnas esperadas en el Sheet (encabezados en fila 1):
//  nombre | categoria | precio | precio_anterior | descuento | imagen_url | emoji | activo | oferta
// Los nombres de columna se normalizan (minúsculas, sin espacios), así que puede tener variaciones.

// ══════════════════════════════════════════════════════
let allProducts = [];
let cart = {};  // { "Nombre producto": { ...product, qty } }
let currentCat = "todos"; // Categoría activa actual

// ── CARGA ──
async function loadSheet() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=1465098498&single=true&output=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const csv = await res.text();
    allProducts = parseCSV(csv);
    render();
  } catch(e) {
    console.error(e);
    const errHTML = `<div class="empty-state">⚠️ No se pudo cargar el inventario.<br><small>Asegúrate de publicar el Sheet como CSV.</small></div>`;
    document.getElementById("offersGrid").innerHTML = errHTML;
    document.getElementById("productsGrid").innerHTML = errHTML;
  }
}

// ── PARSEAR CSV ──
function parseCSV(csv) {
  const rows = csv.trim().split(/\r?\n/);
  const rawHeaders = rows[0].split(",").map(h => norm(h.replace(/"/g,"")));
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitLine(rows[i]);
    const obj = {};
    rawHeaders.forEach((h, idx) => { obj[h] = (cols[idx] || "").trim().replace(/^"|"$/g,""); });

    let rawImg = get(obj, ["imagen_url","imagen","image","foto","url_imagen","img"]) || "";
    if (rawImg.includes("drive.google.com/file/d/")) {
      const match = rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) rawImg = `https://lh3.googleusercontent.com/d/${match[1]}`;
    }

    const p = {
      nombre:          get(obj, ["nombre","name","producto","item"]) || "",
      categoria:       get(obj, ["categoria","category","cat","seccion"]) || "General",
      precio:          toFloat(get(obj, ["precio","price","precio_venta","pvp"])),
      precio_anterior: toFloat(get(obj, ["precio_anterior","precio_viejo","old_price","antes"])),
      descuento:       toInt(get(obj, ["descuento","discount","dto","oferta_pct"])),
      imagen_url:      rawImg,
      emoji:           get(obj, ["emoji","icono","icon"]) || "🛍️",
      activo:          norm(get(obj, ["activo","active","disponible","habilitado"]) || "si"),
      oferta:          norm(get(obj, ["oferta","offer","es_oferta","promocion","promo"]) || "no"),
    };

    if (!p.nombre) continue;
    if (p.activo === "no" || p.activo === "false" || p.activo === "0") continue;
    // Auto-detectar oferta si hay descuento o precio anterior mayor
    if (p.descuento > 0 || (p.precio_anterior > 0 && p.precio_anterior > p.precio)) p.oferta = "si";
    products.push(p);
  }
  return products;
}

function get(obj, keys){ for(const k of keys){ if(obj[k] !== undefined && obj[k] !== "") return obj[k]; } return ""; }
function norm(s){ return String(s).toLowerCase().trim().replace(/\s+/g,"_"); }
function toFloat(s) {
  let str = String(s).replace(/S\/\.?/gi, ''); // Quita "S/" o "S/."
  str = str.replace(/,/g, '.'); // Cambia comas a puntos
  str = str.replace(/[^0-9.-]/g, ''); // Deja solo números, puntos y menos
  const parts = str.split('.');
  if (parts.length > 2) { // Si hay varios puntos (miles), deja solo el último como decimal
    str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  return parseFloat(str) || 0;
}
function toInt(s){ return parseInt(String(s).replace(/[^0-9]/g,"")) || 0; }
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function splitLine(line) {
  const r=[]; let cur=""; let q=false;
  for(const c of line){
    if(c==='"'){q=!q;}
    else if(c===','&&!q){r.push(cur);cur="";}
    else cur+=c;
  }
  r.push(cur);
  return r;
}

// ── RENDER ──
function render() {
  buildCatBar();
  const searchInput = document.getElementById("searchInput");
  const query = searchInput ? norm(searchInput.value) : "";

  const offers   = allProducts.filter(p => p.oferta === "si");
  let filtered = currentCat === "todos" ? allProducts : allProducts.filter(p => norm(p.categoria) === norm(currentCat));

  if (query) {
    filtered = filtered.filter(p => norm(p.nombre).includes(query));
  }

  document.getElementById("offersGrid").innerHTML = offers.length
    ? offers.map(p => cardHTML(p)).join("")
    : `<div class="empty-state">😊 Sin ofertas activas hoy</div>`;

  document.getElementById("productsGrid").innerHTML = filtered.length
    ? filtered.map(p => cardHTML(p)).join("")
    : `<div class="empty-state">😊 No se encontraron productos</div>`;
}

function cardHTML(p) {
  const imgHTML = p.imagen_url
    ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy" decoding="async" onerror="this.outerHTML='<span class=ef>${p.emoji}</span>'">`
    : `<span class="ef">${p.emoji}</span>`;

  const priceHTML = (p.precio_anterior > 0 && p.precio_anterior > p.precio)
    ? `<span class="price-old">S/ ${p.precio_anterior.toFixed(2)}</span><span class="price-new">S/ ${p.precio.toFixed(2)}</span>`
    : `<span class="price-normal">S/ ${p.precio.toFixed(2)}</span>`;

  const badge = p.descuento > 0 ? `<div class="offer-pct">-${p.descuento}%</div>` : "";

  // Encode product as JSON attribute safely
  const pData = encodeURIComponent(JSON.stringify(p)).replace(/'/g, "%27");

  return `
  <div class="product-card" style="cursor:pointer;" onclick="openProductModal('${esc(pData)}')">
    <div class="product-img">${imgHTML}${badge}</div>
    <div class="product-info">
      <div class="product-name">${esc(p.nombre)}</div>
      <div class="price-row">${priceHTML}</div>
      <button class="add-btn" onclick="event.stopPropagation(); addToCart(decodeProduct(this),this)" data-p="${esc(pData)}">+ Agregar</button>
    </div>
  </div>`;
}

// ── PRODUCT MODAL ──
function openProductModal(encodedData) {
  const p = JSON.parse(decodeURIComponent(encodedData));
  
  const imgHTML = p.imagen_url
    ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy" decoding="async" onerror="this.outerHTML='<span class=ef>${p.emoji}</span>'">`
    : `<span class="ef">${p.emoji}</span>`;
    
  const priceHTML = (p.precio_anterior > 0 && p.precio_anterior > p.precio)
    ? `<span class="price-old" style="font-size:14px">S/ ${p.precio_anterior.toFixed(2)}</span><span class="price-new" style="font-size:22px">S/ ${p.precio.toFixed(2)}</span>`
    : `<span class="price-normal" style="font-size:22px">S/ ${p.precio.toFixed(2)}</span>`;

  document.getElementById('pmImgWrap').innerHTML = imgHTML;
  document.getElementById('pmCat').innerText = p.categoria || "Producto";
  document.getElementById('pmName').innerText = p.nombre;
  document.getElementById('pmPriceRow').innerHTML = priceHTML;
  document.getElementById('pmDesc').innerText = p.descripcion || "";
  
  const addBtn = document.getElementById('pmAddBtn');
  addBtn.onclick = () => {
    addToCart(p, null);
    closeProductModal();
    // Opcional: mostrar carrito tras agregar
    openCart();
  };

  document.getElementById('productOverlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productOverlay').classList.remove('open');
  document.getElementById('productModal').classList.remove('open');
}

function decodeProduct(btn){ return JSON.parse(decodeURIComponent(btn.dataset.p)); }

// ── CATEGORÍAS ──
const catEmojis = {"bebidas":"🥤","snacks":"🍿","helados":"🍦","dulces":"🍬","alcohol":"🍺","abarrotes":"🛒","limpieza":"🧹","higiene":"🧴","jugos":"🧃","gaseosas":"🥤","cigarros":"🚬","tabaco":"🚬","lacteos":"🥛","panaderia":"🍞","frutas":"🍎","verduras":"🥦"};

function buildCatBar() {
  const bar  = document.getElementById("catBar");
  const done = new Set([...bar.querySelectorAll("[data-cat]")].map(el => norm(el.dataset.cat)));
  const cats = [...new Set(allProducts.map(p => p.categoria).filter(Boolean))];
  cats.forEach(c => {
    if (done.has(norm(c))) return;
    const emoji = catEmojis[norm(c)] || "🏷️";
    const btn = document.createElement("button");
    btn.className = "cat-card";
    btn.dataset.cat = c;
    btn.innerHTML = `<span>${emoji}</span><span>${esc(c)}</span>`;
    btn.onclick = function(){ filterCat(this, c); };
    bar.appendChild(btn);
    done.add(norm(c));
  });
}

function filterCat(el, cat) {
  document.querySelectorAll(".cat-card").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  currentCat = cat;
  render();
  setTimeout(() => document.getElementById("productos").scrollIntoView({behavior:"smooth"}), 50);
}

function searchProducts() {
  render();
}

// ── CARRITO ──
function addToCart(product, btn) {
  const key = product.nombre;
  if (!cart[key]) cart[key] = { ...product, qty: 0 };
  cart[key].qty++;
  updateBadge();
  btn.textContent = "✓ Listo!";
  btn.classList.add("added");
  setTimeout(() => { btn.textContent = "+ Agregar"; btn.classList.remove("added"); }, 1300);
}

function changeQty(key, delta) {
  if (!cart[key]) return;
  cart[key].qty = Math.max(0, cart[key].qty + delta);
  if (cart[key].qty === 0) delete cart[key];
  updateBadge();
  renderDrawer();
}

function updateBadge() {
  const total = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cartCount");
  badge.textContent = total;
  badge.classList.toggle("hidden", total === 0);
}

function openCart()  { renderDrawer(); document.getElementById("cartOverlay").classList.add("open"); document.getElementById("cartDrawer").classList.add("open"); document.body.style.overflow="hidden"; }
function closeCart() { document.getElementById("cartOverlay").classList.remove("open"); document.getElementById("cartDrawer").classList.remove("open"); document.body.style.overflow=""; }

function renderDrawer() {
  const items = Object.values(cart).filter(i => i.qty > 0);
  const el    = document.getElementById("cartItemsEl");
  const tot   = document.getElementById("cartTotalEl");

  if (!items.length) {
    el.innerHTML = `<div class="cart-empty-msg">😊 Tu carrito está vacío<br><small>¡Agrega algunos productos!</small></div>`;
    tot.textContent = "S/ 0.00";
    return;
  }

  el.innerHTML = items.map(item => {
    const imgH = item.imagen_url
      ? `<img src="${esc(item.imagen_url)}" alt="" onerror="this.outerHTML='${item.emoji}'">`
      : item.emoji;
    // escape key for onclick
    const k = esc(item.nombre).replace(/'/g,"\\'");
    return `
    <div class="cart-item">
      <div class="cart-item-img">${imgH}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.nombre)}</div>
        <div class="cart-item-price">S/ ${(item.precio * item.qty).toFixed(2)} (×${item.qty})</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="changeQty('${k}',-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${k}',1)">+</button>
      </div>
    </div>`;
  }).join("");

  const total = items.reduce((s, i) => s + i.precio * i.qty, 0);
  tot.textContent = `S/ ${total.toFixed(2)}`;
}

function sendWhatsApp() {
  const items = Object.values(cart).filter(i => i.qty > 0);
  if (!items.length) { alert("Agrega productos antes de enviar tu pedido"); return; }
  const total = items.reduce((s, i) => s + i.precio * i.qty, 0);
  
  let msg = "*NUEVO PEDIDO - KUSI MINIMARKET*\n\n";
  msg += "*Detalle del pedido:*\n";
  items.forEach(i => { 
    msg += `- ${i.qty} x ${i.nombre} (S/ ${(i.precio * i.qty).toFixed(2)})\n`; 
  });
  
  msg += `\n*TOTAL A PAGAR: S/ ${total.toFixed(2)}*\n\n`;
  msg += "Dirección de entrega: ";
  
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ── SIDEBAR ──
function openSidebar() {
  document.getElementById("sidebarOverlay").classList.add("open");
  document.getElementById("sidebar").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeSidebar() {
  document.getElementById("sidebarOverlay").classList.remove("open");
  document.getElementById("sidebar").classList.remove("open");
  document.body.style.overflow = "";
}

// ── PDF MODAL ──
let currentPdfRenderTask = null;

async function openPdfModal(url, title) {
  document.getElementById("pdfTitle").innerText = title || "Documento";
  document.getElementById("pdfOpenBtn").href = url;
  document.getElementById("pdfOverlay").classList.add("open");
  document.getElementById("pdfModal").classList.add("open");
  document.body.style.overflow = "hidden";
  
  const container = document.getElementById("pdfRenderContainer");
  container.innerHTML = '<div class="loading-state" style="margin-top:40px"><div class="spinner"></div>Cargando documento...</div>';
  
  try {
    if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js no está cargado");
    
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    const loadingTask = pdfjsLib.getDocument(url);
    currentPdfRenderTask = loadingTask;
    const pdfDoc = await loadingTask.promise;
    
    container.innerHTML = ""; // Limpiar spinner
    
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      container.appendChild(canvas);
      
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }
  } catch (error) {
    console.error("Error cargando PDF:", error);
    container.innerHTML = '<div class="empty-state" style="margin-top:40px">⚠️ No se pudo visualizar el PDF aquí automáticamente.<br><br>Usa el botón superior "Abrir en otra pestaña".</div>';
  }
}

function closePdfModal() {
  document.getElementById("pdfOverlay").classList.remove("open");
  document.getElementById("pdfModal").classList.remove("open");
  document.body.style.overflow = "";
  
  if (currentPdfRenderTask && currentPdfRenderTask.destroy) {
    currentPdfRenderTask.destroy();
  }
  
  setTimeout(() => {
    document.getElementById("pdfRenderContainer").innerHTML = "";
  }, 300);
}

// ── INICIO ──
loadSheet();
