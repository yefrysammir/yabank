/* ============================================
   YABANK - Aurora Edition
   ============================================ */

const STORAGE_KEY = 'yabank_aurora_v1';
const AMOUNTS_KEY = 'yabank_amounts_vis';
const SCROLL_KEY = 'yabank_scroll_pos';
const NOTES_KEY = 'yabank_notes_v1';

let currentAddMoreId = null;
let currentCuotaId = null;
let currentDeleteId = null;
let currentEditId = null;
let amountsVisible = true;
let scrollPos = { dashboard: 0, loans: 0, history: 0 };
let currentView = 'dashboard';

/* ---------- PERU TIMEZONE HELPERS ---------- */
function getPeruDateParts() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Lima',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type).value;
    return {
        year: parseInt(get('year')),
        month: parseInt(get('month')),
        day: parseInt(get('day'))
    };
}

function getPeruDateStart() {
    const p = getPeruDateParts();
    return new Date(p.year, p.month - 1, p.day);
}

function getPeruDateStr() {
    const p = getPeruDateParts();
    const y = p.year;
    const m = String(p.month).padStart(2, '0');
    const d = String(p.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(str) {
    if (!str) return new Date(NaN);
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDateToStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/* ---------- DATA ---------- */
function getData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { capital: 0, ganancias: 0, prestamos: [], historial: [], movimientosCapital: [], retiros: [] };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.movimientosCapital)) data.movimientosCapital = [];
    if (!Array.isArray(data.retiros)) data.retiros = [];
    data.prestamos.forEach(p => {
        if (p.montoOriginal === undefined) p.montoOriginal = p.monto;
        if (p.interes === undefined) p.interes = calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
        if (!Array.isArray(p.cuotas)) p.cuotas = [];
        if (!Array.isArray(p.adiciones)) p.adiciones = [];
        if (!Array.isArray(p.ediciones)) p.ediciones = [];
        p.modoCuotas = true; // ALWAYS ON
    });
    data.historial.forEach(h => {
        if (!Array.isArray(h.cuotas)) h.cuotas = [];
        if (h.pagadoEnCuotas === undefined) h.pagadoEnCuotas = h.cuotas.length > 0;
        if (h.montoOriginal === undefined) h.montoOriginal = h.monto;
        if (h.interes === undefined) h.interes = calcInteres(h.montoOriginal, h.tasa, h.fechaPrestamo || h.fechaInicio, h.fechaPago || h.fechaFin);
        if (!Array.isArray(h.adiciones)) h.adiciones = [];
        if (!Array.isArray(h.ediciones)) h.ediciones = [];
    });
    return data;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderAll();
}

function calcInteres(monto, tasa, fi, ff) {
    const d = daysBetween(fi, ff);
    return monto * (tasa / 100) * Math.max(d, 0) / 30;
}

/* ---------- NOTES ---------- */
function getNotes() {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return { capitalEfectivo: '', capitalVirtual: '', nota: '', ultimaEdicion: '' };
    return JSON.parse(raw);
}

function saveNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function showNotesModal() {
    const notes = getNotes();
    document.getElementById('nota-efectivo').value = notes.capitalEfectivo;
    document.getElementById('nota-virtual').value = notes.capitalVirtual;
    document.getElementById('nota-texto').value = notes.nota;
    updateUltimaEdicion(notes.ultimaEdicion);
    openModal('modal-notas');
}

function updateUltimaEdicion(fecha) {
    const el = document.getElementById('notas-ultima-edicion');
    if (!el) return;
    if (fecha) {
        el.textContent = 'Última edición: ' + fmtDate(fecha);
    } else {
        el.textContent = 'Sin ediciones previas';
    }
}

function saveNotesData() {
    const efectivo = document.getElementById('nota-efectivo').value.trim();
    const virtual = document.getElementById('nota-virtual').value.trim();
    const nota = document.getElementById('nota-texto').value.trim();
    const ultimaEdicion = getPeruDateStr();
    const notes = { capitalEfectivo: efectivo, capitalVirtual: virtual, nota, ultimaEdicion };
    saveNotes(notes);
    updateUltimaEdicion(ultimaEdicion);
    toast('Notas guardadas');
}

/* ---------- AMOUNTS VISIBILITY ---------- */
function loadVis() {
    amountsVisible = localStorage.getItem(AMOUNTS_KEY) !== 'false';
    updateEye();
}

function toggleVis() {
    amountsVisible = !amountsVisible;
    localStorage.setItem(AMOUNTS_KEY, amountsVisible);
    updateEye();
    renderAll();
}

function updateEye() {
    const el = document.getElementById('eye-icon');
    if (el) el.textContent = amountsVisible ? 'visibility' : 'visibility_off';
}

function maskMoney(v) {
    return amountsVisible ? fmtMoney(v) : 'S/ ****.**';
}

/* ---------- SCROLL ---------- */
function loadScroll() {
    const s = localStorage.getItem(SCROLL_KEY);
    if (s) scrollPos = JSON.parse(s);
}

function saveScroll(view, pos) {
    scrollPos[view] = pos;
    localStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPos));
}

function getScrollEl(view) {
    const v = document.getElementById('view-' + view);
    return v ? v.querySelector('.view-scroll') : null;
}

function restoreScroll(view) {
    const el = getScrollEl(view);
    if (el) el.scrollTop = scrollPos[view] || 0;
}

/* ---------- VIEW SWITCH ---------- */
function switchView(name) {
    const cur = getScrollEl(currentView);
    if (cur) saveScroll(currentView, cur.scrollTop);

    document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
    const target = document.getElementById('view-' + name);
    if (target) target.classList.add('view-active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));

    const fab = document.getElementById('fab-add');
    if (fab) fab.classList.toggle('show', name === 'loans');

    currentView = name;
    requestAnimationFrame(() => restoreScroll(name));
    renderAll();
}

/* ---------- MODAL ---------- */
function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    // RESET SCROLL TO TOP
    const sheet = m.querySelector('.modal-sheet');
    if (sheet) sheet.scrollTop = 0;
    m.classList.add('show');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
}

function closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
}

/* ---------- TOAST ---------- */
function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------- CHAR COUNTER & VALIDATION ---------- */
function setupCounter(inputId, counterId, max) {
    const inp = document.getElementById(inputId);
    const ctr = document.getElementById(counterId);
    if (!inp || !ctr) return;
    const upd = () => {
        inp.value.length >= max ? ctr.classList.add('at-limit') : ctr.classList.remove('at-limit');
        ctr.textContent = inp.value.length + '/' + max;
    };
    inp.addEventListener('input', upd);
    upd();
}

function enforceNum(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
    el.addEventListener('keypress', function(e) { if (!/[0-9]/.test(String.fromCharCode(e.which))) e.preventDefault(); });
}

/* ---------- INPUT FOCUS -> SCROLL ABOVE KEYBOARD ---------- */
function setupInputFocus(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(inp => {
        inp.addEventListener('focus', () => {
            setTimeout(() => {
                const rect = inp.getBoundingClientRect();
                const sheet = modal.querySelector('.modal-sheet');
                if (!sheet) return;
                const modalRect = sheet.getBoundingClientRect();
                const kbHeight = window.innerHeight * 0.38; // approximate keyboard
                const inpBottom = rect.bottom - modalRect.top + sheet.scrollTop;
                const visibleArea = modalRect.height - kbHeight;
                if (rect.bottom > window.innerHeight - kbHeight + 20) {
                    sheet.scrollTo({ top: inpBottom - visibleArea + 80, behavior: 'smooth' });
                }
            }, 300);
        });
    });
}

/* ---------- FORMAT ---------- */
function fmtMoney(v) {
    return 'S/ ' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(s) {
    if (!s) return '-';
    const [y, m, d] = s.split('-');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return parseInt(d) + ' de ' + meses[parseInt(m)-1] + ' del ' + y;
}

function getDaysRemaining(ff) {
    const fin = parseDate(ff);
    const hoy = getPeruDateStart();
    return Math.ceil((fin - hoy) / 86400000);
}

function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

/* ===================== RENDER ===================== */
function renderAll() {
    renderDash();
    renderActivos();
    renderHistorial();
}

/* ---------- DASHBOARD ---------- */
function renderDash() {
    const d = getData();
    const prestado = d.prestamos.reduce((s, p) => s + p.monto, 0);
    const vencidos = d.prestamos.filter(p => getDaysRemaining(p.fechaFin) < 0).length;
    const totalOps = d.prestamos.length + d.historial.filter(h => h.type !== 'delete').length;

    const patrimonio = d.capital + prestado;

    setTxt('header-total', maskMoney(patrimonio));

    const compEl = document.getElementById('header-comprometido');
    const compVal = document.getElementById('header-comp-value');
    // FIX: always show capital available
    compEl.classList.add('show');
    compVal.textContent = maskMoney(d.capital);

    setTxt('dash-capital', maskMoney(d.capital));
    setTxt('dash-prestado', maskMoney(prestado));
    setTxt('dash-ganancias', maskMoney(d.ganancias));
    setTxt('dash-vencidos', vencidos);
    setTxt('dash-total-prestamos', totalOps);
}

function setTxt(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
}

/* ---------- ACTIVOS ---------- */
function renderActivos() {
    if (currentView !== 'loans') return;
    const d = getData();
    const search = (document.getElementById('search-activos')?.value || '').toLowerCase();
    const box = document.getElementById('lista-activos');
    if (!box) return;

    let list = d.prestamos.filter(p => !search || p.nombre.toLowerCase().includes(search) || p.dni.includes(search) || p.monto.toString().includes(search));
    list.sort((a, b) => getDaysRemaining(a.fechaFin) - getDaysRemaining(b.fechaFin));

    setTxt('count-activos', list.length);

    if (!list.length) {
        box.innerHTML = emptyHTML('inbox', 'Sin prestamos activos', 'Presiona + para agregar uno');
        return;
    }
    box.innerHTML = list.map(p => loanCard(p)).join('');
}

function loanCard(p) {
    const days = getDaysRemaining(p.fechaFin);
    const interes = p.interes !== undefined ? p.interes : calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
    const total = p.monto + interes;
    const isV = days < 0, isU = days >= 0 && days <= 2, isA = days >= 3 && days <= 15;
    const sClass = isV ? 'vencido' : isU ? 'por-vencer' : isA ? 'alerta-media' : 'al-dia';
    const sTxt = isV ? 'VENCIDO' : days === 0 ? 'Vence hoy' : isU ? `Urgente: ${days}d` : isA ? `Alerta: ${days}d` : `${days} dias rest.`;
    const sBadge = isV ? 'loan-badge-red' : isU ? 'loan-badge-red' : isA ? 'loan-badge-orange' : 'loan-badge-green';
    const tClass = isV ? 'lt-red' : isU ? 'lt-red' : isA ? 'lt-orange' : 'lt-green';
    const tIcon = isV ? 'error' : 'timer';
    const tTxt = isV ? `Vencido hace ${Math.abs(days)} dias` : days === 0 ? 'Vence hoy' : `${days} dias restantes`;
    const tc = (p.cuotas || []).reduce((s, c) => s + c.monto, 0);

    const cuotasHTML = p.cuotas?.length ? `
        <div class="collapse-section show" id="cuotas-${p.id}">
            <div class="collapse-header" data-toggle="cuotas-body-${p.id}">
                <span><span class="material-symbols-outlined" style="font-size:14px">price_check</span> Adelantos (${p.cuotas.length})</span>
                <span class="arrow material-symbols-outlined">expand_more</span>
            </div>
            <div class="collapse-body" id="cuotas-body-${p.id}">
                ${p.cuotas.map((c, i) => `
                    <div class="litem">
                        <div><span class="litem-date">#${i+1} &bull; ${fmtDate(c.fecha)}</span>${c.nota ? `<div class="litem-note">${esc(c.nota)}</div>` : ''}</div>
                        <span class="litem-amt lamt-green">+${maskMoney(c.monto)}</span>
                    </div>`).join('')}
                <div class="lsummary"><span>Total adelantos</span><span>${maskMoney(tc)}</span></div>
            </div>
        </div>` : '';

    const adicHTML = p.adiciones?.length ? `
        <div class="collapse-section show" id="adiciones-${p.id}">
            <div class="collapse-header" data-toggle="adiciones-body-${p.id}">
                <span><span class="material-symbols-outlined" style="font-size:13px">currency_exchange</span> Refinanc. (${p.adiciones.length})</span>
                <span class="arrow material-symbols-outlined">expand_more</span>
            </div>
            <div class="collapse-body" id="adiciones-body-${p.id}">
                ${p.adiciones.map((a, i) => `
                    <div class="litem">
                        <span class="litem-date">#${i+1} &bull; ${fmtDate(a.fecha)}${a.nota ? ' - ' + esc(a.nota) : ''}</span>
                        <span class="litem-amt lamt-violet">+${maskMoney(a.monto)}</span>
                    </div>`).join('')}
            </div>
        </div>` : '';

    const edicHTML = p.ediciones?.length ? `
        <div class="collapse-section show" id="ediciones-${p.id}">
            <div class="collapse-header" data-toggle="ediciones-body-${p.id}">
                <span><span class="material-symbols-outlined" style="font-size:14px">edit_note</span> Cambios (${p.ediciones.length})</span>
                <span class="arrow material-symbols-outlined">expand_more</span>
            </div>
            <div class="collapse-body" id="ediciones-body-${p.id}">
                ${p.ediciones.map((e, i) => `
                    <div class="ed-item">
                        <div class="ed-fecha">#${i+1} &bull; ${fmtDate(e.fecha)}${e.nota ? ' - ' + esc(e.nota) : ''}</div>
                        <div class="ed-cambios">
                            ${e.cambios.map(c => `
                                <div class="ed-cambio">
                                    <span class="ed-campo">${c.campo}:</span>
                                    <span class="ed-antes">${c.anterior}</span>
                                    <span class="ed-flecha">→</span>
                                    <span class="ed-despues">${c.posterior}</span>
                                </div>`).join('')}
                        </div>
                    </div>`).join('')}
            </div>
        </div>` : '';

    return `
    <div class="loan-card ${sClass}" id="loan-${p.id}">
        <div class="loan-head">
            <div class="loan-person">
                <div class="loan-avatar">${p.nombre.charAt(0).toUpperCase()}</div>
                <div class="loan-info">
                    <h3>${esc(p.nombre)} <span class="loan-badge loan-badge-cuotas">Cuotas</span></h3>
                    <div class="dni">DNI: ${p.dni}</div>
                </div>
            </div>
            <span class="loan-badge ${sBadge}">${sTxt}</span>
        </div>
        <div class="loan-body">
            <div class="loan-amounts">
                <div class="lamount"><div class="lamount-label">Capital</div><div class="lamount-value">${maskMoney(p.monto)}</div></div>
                <div class="lamount"><div class="lamount-label">${p.tasa}% TEM</div><div class="lamount-value lamount-accent">${maskMoney(interes)}</div></div>
                <div class="lamount"><div class="lamount-label">A Pagar</div><div class="lamount-value lamount-accent">${maskMoney(total)}</div></div>
            </div>
            <div class="loan-timer ${tClass}"><span class="material-symbols-outlined">${tIcon}</span><span>${tTxt}</span></div>
            <div class="loan-dates">
                <span><span class="material-symbols-outlined">flag</span> ${fmtDate(p.fechaInicio)}</span>
                <span><span class="material-symbols-outlined">flag_check</span> ${fmtDate(p.fechaFin)}</span>
            </div>
            <div class="loan-actions">
                <button class="lact lact-edit" data-action="edit" data-id="${p.id}"><span class="material-symbols-outlined">edit</span></button>
                <button class="lact lact-pay" data-action="pay" data-id="${p.id}"><span class="material-symbols-outlined">paid</span></button>
                <button class="lact lact-add" data-action="addmore" data-id="${p.id}"><span class="material-symbols-outlined">currency_exchange</span></button>
                <button class="lact lact-cuota" data-action="cuota" data-id="${p.id}"><span class="material-symbols-outlined">price_check</span></button>
                <button class="lact lact-billetes" data-action="billetes" data-id="${p.id}"><span class="material-symbols-outlined">payments</span></button>
                <button class="lact lact-delete" data-action="delete" data-id="${p.id}"><span class="material-symbols-outlined">delete</span></button>
            </div>
        </div>
        <div class="billetes-section" id="billetes-${p.id}"><div class="billetes-content">${p.billetes ? esc(p.billetes) : 'No se registraron series'}</div></div>
        ${adicHTML}${cuotasHTML}${edicHTML}
    </div>`;
}

function emptyHTML(icon, title, sub) {
    return `<div class="empty-state"><span class="material-symbols-outlined">${icon}</span><h3>${title}</h3><p>${sub}</p></div>`;
}

/* ---------- HISTORIAL ---------- */
function renderHistorial() {
    if (currentView !== 'history') return;
    const d = getData();
    const search = (document.getElementById('search-historial')?.value || '').toLowerCase();
    const box = document.getElementById('lista-historial');
    if (!box) return;

    let items = [];
    d.historial.forEach(h => {
        if (h.type === 'delete') {
            items.push({ type: 'delete', nombre: h.nombre, dni: h.dni, monto: h.monto, montoOriginal: h.montoOriginal || h.monto, motivo: h.motivo, fechaCreacion: h.fechaCreacion, fechaEliminacion: h.fechaEliminacion, sortDate: h.fechaEliminacion });
        } else {
            items.push({ type: 'loan', nombre: h.nombre, dni: h.dni, monto: h.monto, montoOriginal: h.montoOriginal || h.monto, interes: h.interes || calcInteres(h.montoOriginal || h.monto, h.tasa, h.fechaPrestamo || h.fechaInicio, h.fechaPago || h.fechaFin), tasa: h.tasa, fecha: h.fechaPago, fechaPrestamo: h.fechaPrestamo || h.fechaInicio, diasPlazo: h.diasPlazo, diasTardanza: h.diasTardanza, enPlazo: h.diasTardanza <= h.diasPlazo, cuotas: h.cuotas || [], pagadoEnCuotas: h.pagadoEnCuotas || (h.cuotas && h.cuotas.length > 0), adiciones: h.adiciones || [], ediciones: h.ediciones || [], sortDate: h.fechaPago });
        }
    });
    d.movimientosCapital.forEach(m => items.push({ type: 'capital', nombre: m.motivo || 'Capital', monto: m.monto, fecha: m.fecha, sortDate: m.fecha }));
    d.retiros.forEach(r => items.push({ type: 'retiro', nombre: r.motivo || 'Retiro', monto: r.monto, fecha: r.fecha, sortDate: r.fecha }));

    let filtered = items.filter(h => !search || (h.nombre && h.nombre.toLowerCase().includes(search)) || (h.dni && h.dni.includes(search)) || h.monto.toString().includes(search) || (h.motivo && h.motivo.toLowerCase().includes(search)));
    filtered.sort((a, b) => {
        const da = new Date(a.sortDate + 'T00:00:00').getTime();
        const db = new Date(b.sortDate + 'T00:00:00').getTime();
        if (db !== da) return db - da;
        return a.type === 'loan' ? -1 : 1;
    });

    setTxt('count-historial', filtered.length);
    if (!filtered.length) { box.innerHTML = emptyHTML('history', 'Sin historial', 'Los prestamos pagados apareceran aqui'); return; }
    box.innerHTML = filtered.map(h => histItem(h)).join('');
}

function histItem(h) {
    if (h.type === 'capital') return `
        <div class="hist-item"><div class="hist-info"><h4><span class="material-symbols-outlined" style="color:var(--cyan)">trending_up</span> ${esc(h.nombre)} <span class="bdg bdg-cap">Capital</span></h4><div class="hist-meta">${fmtDate(h.fecha)}</div></div><div class="hist-amt"><div class="hamount" style="color:var(--emerald)">+${maskMoney(h.monto)}</div></div></div>`;
    if (h.type === 'retiro') return `
        <div class="hist-item"><div class="hist-info"><h4><span class="material-symbols-outlined" style="color:var(--rose)">trending_down</span> ${esc(h.nombre)} <span class="bdg bdg-out">Retiro</span></h4><div class="hist-meta">${fmtDate(h.fecha)}</div></div><div class="hist-amt"><div class="hamount" style="color:var(--rose)">-${maskMoney(h.monto)}</div></div></div>`;
    if (h.type === 'delete') return `
        <div class="hist-item hist-item-col"><div style="display:flex;justify-content:space-between;align-items:center"><div class="hist-info"><h4><span class="material-symbols-outlined" style="color:var(--rose)">delete</span> ${esc(h.nombre)} <span class="bdg bdg-del">Eliminado</span></h4><div class="hist-meta">DNI: ${h.dni}</div><div class="hist-meta">Creado: ${fmtDate(h.fechaCreacion)}</div><div class="hist-meta">Eliminado: ${fmtDate(h.fechaEliminacion)}</div><div class="hist-meta">Motivo: ${esc(h.motivo)}</div></div><div class="hist-amt"><div class="hamount" style="color:var(--rose)">${maskMoney(h.monto)}</div><div class="hgain">Devuelto</div></div></div></div>`;

    const tc = h.cuotas.reduce((s, c) => s + c.monto, 0);
    const cuotasH = h.pagadoEnCuotas && h.cuotas.length ? `
        <div class="hist-section"><div class="collapse-header" data-toggle="hist-cu-${h.sortDate}"><span><span class="material-symbols-outlined" style="font-size:14px">price_check</span> Adelantos (${h.cuotas.length})</span><span class="arrow material-symbols-outlined">expand_more</span></div>
        <div class="collapse-body" id="hist-cu-${h.sortDate}">${h.cuotas.map((c, i) => `<div class="litem"><div><span class="litem-date">#${i+1} &bull; ${fmtDate(c.fecha)}</span>${c.nota ? `<div class="litem-note">${esc(c.nota)}</div>` : ''}</div><span class="litem-amt lamt-green">+${maskMoney(c.monto)}</span></div>`).join('')}<div class="lsummary"><span>Total</span><span>${maskMoney(tc)}</span></div></div></div>` : '';
    const adicH = h.adiciones?.length ? `<div class="hist-section"><div class="collapse-header" data-toggle="hist-ad-${h.sortDate}"><span><span class="material-symbols-outlined" style="font-size:13px">currency_exchange</span> Refinanc. (${h.adiciones.length})</span><span class="arrow material-symbols-outlined">expand_more</span></div><div class="collapse-body" id="hist-ad-${h.sortDate}">${h.adiciones.map((a, i) => `<div class="litem"><div><span class="litem-date">#${i+1} &bull; ${fmtDate(a.fecha)}</span>${a.nota ? `<div class="litem-note">${esc(a.nota)}</div>` : ''}</div><span class="litem-amt lamt-violet">+${maskMoney(a.monto)}</span></div>`).join('')}</div></div>` : '';
    const edicH = h.ediciones?.length ? `<div class="hist-section"><div class="collapse-header" data-toggle="hist-ed-${h.sortDate}"><span><span class="material-symbols-outlined" style="font-size:14px">edit_note</span> Cambios (${h.ediciones.length})</span><span class="arrow material-symbols-outlined">expand_more</span></div><div class="collapse-body" id="hist-ed-${h.sortDate}">${h.ediciones.map((e, i) => `<div class="ed-item"><div class="ed-fecha">#${i+1} &bull; ${fmtDate(e.fecha)}${e.nota ? ' - ' + esc(e.nota) : ''}</div><div class="ed-cambios">${e.cambios.map(c => `<div class="ed-cambio"><span class="ed-campo">${c.campo}:</span><span class="ed-antes">${c.anterior}</span><span class="ed-flecha">→</span><span class="ed-despues">${c.posterior}</span></div>`).join('')}</div></div>`).join('')}</div></div>` : '';

    return `<div class="hist-item hist-item-col"><div style="display:flex;justify-content:space-between;align-items:center"><div class="hist-info"><h4><span class="material-symbols-outlined" style="color:var(--emerald)">money_bag</span> ${esc(h.nombre)}<span class="bdg ${h.enPlazo ? 'bdg-ok' : 'bdg-late'}">${h.enPlazo ? 'A tiempo' : 'Retraso'}</span>${h.pagadoEnCuotas ? '<span class="bdg bdg-cuotas">Adelantos</span>' : ''}</h4><div class="hist-meta">DNI: ${h.dni}</div><div class="hist-meta">Inicio: ${fmtDate(h.fechaPrestamo)}</div><div class="hist-meta">Fin: ${fmtDate(h.fecha)}</div><div class="hist-meta">Plazo: ${h.diasPlazo}d &bull; Pagó en: ${h.diasTardanza}d</div></div><div class="hist-amt"><div class="htasa">${h.tasa}% TEM</div><div class="hamount">${maskMoney(h.montoOriginal)}</div><div class="hgain">+${maskMoney(h.interes)}</div></div></div>${adicH}${cuotasH}${edicH}</div>`;
}

/* ===================== ACTIONS ===================== */

function addLoan() {
    const nombre = document.getElementById('add-nombre').value.trim();
    const dni = document.getElementById('add-dni').value.trim();
    const monto = parseFloat(document.getElementById('add-monto').value);
    const tasa = parseFloat(document.getElementById('add-tasa').value) || 20;
    const fechaInicio = document.getElementById('add-fecha-inicio').value;
    const fechaFin = document.getElementById('add-fecha-fin').value;
    const billetes = document.getElementById('add-billetes').value.trim();

    if (!nombre || !dni || !monto || monto <= 0 || !fechaInicio || !fechaFin) { toast('Completa todos los campos'); return; }

    const d = getData();
    if (monto > d.capital) { toast('Capital insuficiente. Tienes: ' + fmtMoney(d.capital)); return; }

    d.prestamos.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        nombre, dni, montoOriginal: monto, monto, tasa,
        interes: calcInteres(monto, tasa, fechaInicio, fechaFin),
        fechaInicio, fechaFin, billetes, cuotas: [], adiciones: [], ediciones: [],
        modoCuotas: true, createdAt: new Date().toISOString()
    });
    d.capital -= monto;
    saveData(d);

    document.getElementById('add-nombre').value = '';
    document.getElementById('add-dni').value = '';
    document.getElementById('add-monto').value = '';
    document.getElementById('add-billetes').value = '';
    closeModal('modal-add');
    toast('Prestamo creado');
}

function payLoan(id) {
    if (!confirm('Confirmar pago?')) return;
    const d = getData();
    const idx = d.prestamos.findIndex(p => p.id === id);
    if (idx === -1) return;
    const p = d.prestamos[idx];
    const interes = p.interes !== undefined ? p.interes : calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
    const hoy = getPeruDateStr();

    // FIX: interest adds to capital
    d.capital += p.monto + interes;
    d.ganancias += interes;

    d.historial.push({ id: p.id, nombre: p.nombre, dni: p.dni, montoOriginal: p.montoOriginal, monto: p.monto, tasa: p.tasa, interes, fechaPrestamo: p.fechaInicio, fechaPago: hoy, diasPlazo: daysBetween(p.fechaInicio, p.fechaFin), diasTardanza: daysBetween(p.fechaInicio, hoy), billetes: p.billetes, cuotas: [...p.cuotas], adiciones: [...p.adiciones], ediciones: [...p.ediciones], pagadoEnCuotas: p.cuotas.length > 0 });
    d.prestamos.splice(idx, 1);
    saveData(d);
    toast('Pagado. Capital +' + fmtMoney(p.monto + interes));
}

function showEditLoan(id) {
    currentEditId = id;
    const d = getData();
    const p = d.prestamos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('edit-nombre').value = p.nombre;
    document.getElementById('edit-dni').value = p.dni;
    document.getElementById('edit-monto').value = p.monto;
    document.getElementById('edit-tasa').value = p.tasa;
    document.getElementById('edit-fecha-inicio').value = p.fechaInicio;
    document.getElementById('edit-fecha-fin').value = p.fechaFin;
    document.getElementById('edit-nota').value = '';
    openModal('modal-edit');
}

function saveEditLoan() {
    const nombre = document.getElementById('edit-nombre').value.trim();
    const dni = document.getElementById('edit-dni').value.trim();
    const monto = parseFloat(document.getElementById('edit-monto').value);
    const tasa = parseFloat(document.getElementById('edit-tasa').value);
    const fi = document.getElementById('edit-fecha-inicio').value;
    const ff = document.getElementById('edit-fecha-fin').value;
    const nota = document.getElementById('edit-nota').value.trim();

    if (!nombre || !dni || !monto || monto <= 0 || !fi || !ff || isNaN(tasa)) { toast('Completa todos los campos'); return; }

    const d = getData();
    const p = d.prestamos.find(x => x.id === currentEditId);
    if (!p) return;

    const cambios = [];
    if (p.nombre !== nombre) cambios.push({ campo: 'Nombre', anterior: p.nombre, posterior: nombre });
    if (p.dni !== dni) cambios.push({ campo: 'DNI', anterior: p.dni, posterior: dni });
    if (p.monto !== monto) cambios.push({ campo: 'Monto', anterior: fmtMoney(p.monto), posterior: fmtMoney(monto) });
    if (p.tasa !== tasa) cambios.push({ campo: 'Interes', anterior: p.tasa + '%', posterior: tasa + '%' });
    if (p.fechaInicio !== fi) cambios.push({ campo: 'Inicio', anterior: fmtDate(p.fechaInicio), posterior: fmtDate(fi) });
    if (p.fechaFin !== ff) cambios.push({ campo: 'Fin', anterior: fmtDate(p.fechaFin), posterior: fmtDate(ff) });

    if (!cambios.length) { toast('Sin cambios'); closeModal('modal-edit'); return; }

    p.ediciones.push({ fecha: getPeruDateStr(), nota, cambios, createdAt: new Date().toISOString() });
    const ma = p.monto;
    p.nombre = nombre; p.dni = dni; p.monto = monto; p.montoOriginal = monto; p.tasa = tasa; p.fechaInicio = fi; p.fechaFin = ff;
    p.interes = calcInteres(p.montoOriginal, p.tasa, fi, ff);
    if (monto !== ma) d.capital += ma - monto;
    saveData(d);
    closeModal('modal-edit');
    toast('Actualizado. ' + cambios.length + ' cambio(s)');
}

function showDeleteLoan(id) {
    currentDeleteId = id;
    const d = getData();
    const p = d.prestamos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('delete-monto').textContent = fmtMoney(p.monto);
    document.getElementById('delete-motivo').value = '';
    openModal('modal-delete');
}

function confirmDelete() {
    const motivo = document.getElementById('delete-motivo').value.trim();
    if (!motivo) { toast('Ingresa un motivo'); return; }
    const d = getData();
    const idx = d.prestamos.findIndex(p => p.id === currentDeleteId);
    if (idx === -1) return;
    const p = d.prestamos[idx];
    const hoy = getPeruDateStr();
    d.capital += p.monto;
    d.historial.push({ id: p.id, type: 'delete', nombre: p.nombre, dni: p.dni, montoOriginal: p.montoOriginal, monto: p.monto, tasa: p.tasa, interes: 0, fechaCreacion: p.fechaInicio, fechaEliminacion: hoy, motivo, billetes: p.billetes, cuotas: [...p.cuotas], adiciones: [...p.adiciones], ediciones: [...p.ediciones] });
    const dev = p.monto;
    d.prestamos.splice(idx, 1);
    saveData(d);
    closeModal('modal-delete');
    toast('Eliminado. ' + fmtMoney(dev) + ' devuelto');
}

function showAddMore(id) {
    currentAddMoreId = id;
    const d = getData();
    const p = d.prestamos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('more-fecha-fin').value = p.fechaFin;
    document.getElementById('more-monto').value = '';
    document.getElementById('more-nota').value = '';
    openModal('modal-add-more');
}

function addMoreLoan() {
    const monto = parseFloat(document.getElementById('more-monto').value);
    const nff = document.getElementById('more-fecha-fin').value;
    const nota = document.getElementById('more-nota').value.trim();
    if (!monto || monto <= 0) { toast('Monto invalido'); return; }
    const d = getData();
    const p = d.prestamos.find(x => x.id === currentAddMoreId);
    if (!p) return;
    if (monto > d.capital) { toast('Sin capital. Disponible: ' + fmtMoney(d.capital)); return; }
    p.adiciones.push({ monto, fecha: getPeruDateStr(), nota, createdAt: new Date().toISOString() });
    p.montoOriginal += monto; p.monto += monto;
    if (nff) p.fechaFin = nff;
    p.interes = calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
    d.capital -= monto;
    saveData(d);
    closeModal('modal-add-more');
    toast('Agregado. Total: ' + fmtMoney(p.monto));
}

function toggleBilletes(id) {
    const el = document.getElementById('billetes-' + id);
    if (el) el.classList.toggle('show');
}

function showAddCuota(id) {
    currentCuotaId = id;
    const d = getData();
    const p = d.prestamos.find(x => x.id === id);
    if (!p) return;
    const hoy = getPeruDateStr();
    document.getElementById('cuota-fecha').value = hoy;
    document.getElementById('cuota-monto').value = '';
    document.getElementById('cuota-nota').value = '';
    const ia = p.interes !== undefined ? p.interes : calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
    document.getElementById('cuota-info').innerHTML = `<span class="info-label">Saldo:</span> <span class="info-value cuota-n">${fmtMoney(p.monto)}</span><br><span class="info-label">Interés fijo:</span> <span class="info-value cuota-n">${fmtMoney(ia)}</span>`;
    openModal('modal-add-cuota');
}

function addCuota() {
    const monto = parseFloat(document.getElementById('cuota-monto').value);
    const fecha = document.getElementById('cuota-fecha').value;
    const nota = document.getElementById('cuota-nota').value.trim();
    if (!monto || monto <= 0) { toast('Monto invalido'); return; }
    if (!fecha) { toast('Selecciona fecha'); return; }
    const d = getData();
    const p = d.prestamos.find(x => x.id === currentCuotaId);
    if (!p) return;
    if (monto > p.monto) { toast('Excede saldo: ' + fmtMoney(p.monto)); return; }

    p.cuotas.push({ monto, fecha, nota, createdAt: new Date().toISOString() });
    p.monto -= monto;
    d.capital += monto;

    if (p.monto <= 0) {
        const hoy = getPeruDateStr();
        const interes = p.interes !== undefined ? p.interes : calcInteres(p.montoOriginal, p.tasa, p.fechaInicio, p.fechaFin);
        if (p.monto < 0) d.capital += p.monto;
        d.capital += interes;
        d.ganancias += interes;
        d.historial.push({ id: p.id, nombre: p.nombre, dni: p.dni, montoOriginal: p.montoOriginal, monto: 0, tasa: p.tasa, interes, fechaPrestamo: p.fechaInicio, fechaPago: hoy, diasPlazo: daysBetween(p.fechaInicio, p.fechaFin), diasTardanza: daysBetween(p.fechaInicio, hoy), billetes: p.billetes, cuotas: [...p.cuotas], adiciones: [...p.adiciones], ediciones: [...p.ediciones], pagadoEnCuotas: true });
        d.prestamos.splice(d.prestamos.findIndex(x => x.id === p.id), 1);
        saveData(d);
        closeModal('modal-add-cuota');
        toast('Pagado completo. +' + fmtMoney(interes) + ' intereses');
        return;
    }
    saveData(d);
    closeModal('modal-add-cuota');
    toast('Adelanto: ' + fmtMoney(monto) + '. Saldo: ' + fmtMoney(p.monto));
}

function showAddCapitalModal() {
    document.getElementById('capital-monto').value = '';
    document.getElementById('capital-motivo').value = '';
    document.getElementById('capital-fecha').value = getPeruDateStr();
    openModal('modal-add-capital');
}

function addCapital() {
    const monto = parseFloat(document.getElementById('capital-monto').value);
    const motivo = document.getElementById('capital-motivo').value.trim();
    const fecha = document.getElementById('capital-fecha').value;
    if (!monto || monto <= 0) { toast('Monto invalido'); return; }
    if (!motivo) { toast('Ingresa motivo'); return; }
    if (!fecha) { toast('Fecha requerida'); return; }
    const d = getData();
    d.capital += monto;
    d.movimientosCapital.push({ id: Date.now().toString(36), monto, motivo, fecha, createdAt: new Date().toISOString() });
    saveData(d);
    closeModal('modal-add-capital');
    toast('+' + fmtMoney(monto) + ' agregado');
}

function showRetirarModal() {
    document.getElementById('retiro-monto').value = '';
    document.getElementById('retiro-motivo').value = '';
    document.getElementById('retiro-fecha').value = getPeruDateStr();
    openModal('modal-retirar');
}

function retirarDinero() {
    const monto = parseFloat(document.getElementById('retiro-monto').value);
    const motivo = document.getElementById('retiro-motivo').value.trim();
    const fecha = document.getElementById('retiro-fecha').value;
    if (!monto || monto <= 0) { toast('Monto invalido'); return; }
    if (!motivo) { toast('Ingresa motivo'); return; }
    if (!fecha) { toast('Fecha requerida'); return; }
    const d = getData();
    if (monto > d.capital) { toast('Max: ' + fmtMoney(d.capital)); return; }
    d.capital -= monto;
    d.retiros.push({ id: Date.now().toString(36), monto, motivo, fecha, createdAt: new Date().toISOString() });
    saveData(d);
    closeModal('modal-retirar');
    toast('-' + fmtMoney(monto) + ' retirado');
}

function showConfigModal() {
    document.getElementById('config-capital').value = getData().capital;
    openModal('modal-config');
}

function saveCapital() {
    const val = parseFloat(document.getElementById('config-capital').value);
    if (isNaN(val) || val < 0) { toast('Monto invalido'); return; }
    const d = getData();
    d.capital = val;
    saveData(d);
    closeModal('modal-config');
    toast('Capital: ' + fmtMoney(val));
}

function resetAll() {
    if (!confirm('SEGURO? Se borran TODOS los datos.')) return;
    if (!confirm('REALMENTE seguro? No se puede deshacer.')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NOTES_KEY);
    renderAll();
    closeModal('modal-config');
    toast('Todos los datos eliminados');
}

function showExportModal() {
    const data = getData();
    const notes = getNotes();
    document.getElementById('export-json').value = JSON.stringify({ ...data, notas: notes }, null, 2);
    openModal('modal-export');
}

function copyExport() {
    const el = document.getElementById('export-json');
    el.select();
    navigator.clipboard.writeText(el.value).then(() => toast('Copiado')).catch(() => { document.execCommand('copy'); toast('Copiado'); });
}

function downloadExport() {
    const blob = new Blob([document.getElementById('export-json').value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yabank_backup_' + getPeruDateStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Descargado');
}

function importData() {
    try {
        const raw = document.getElementById('import-json').value.trim();
        if (!raw) { toast('Pega JSON primero'); return; }
        const data = JSON.parse(raw);
        if (!data.hasOwnProperty('capital') || !Array.isArray(data.prestamos) || !Array.isArray(data.historial)) throw new Error('Formato invalido');
        if (!confirm('Restaurar? Reemplazara todo.')) return;
        if (!Array.isArray(data.movimientosCapital)) data.movimientosCapital = [];
        if (!Array.isArray(data.retiros)) data.retiros = [];
        if (data.notas) saveNotes(data.notas);
        saveData(data);
        closeModal('modal-export');
        toast('Datos restaurados');
    } catch (e) { toast('JSON invalido: ' + e.message); }
}

function clearSearch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    el.focus();
    if (id === 'search-activos') renderActivos();
    else if (id === 'search-historial') renderHistorial();
    updateSearchClear(id);
}

function updateSearchClear(id) {
    const inp = document.getElementById(id);
    const btn = document.getElementById('clear-' + id);
    if (inp && btn) btn.classList.toggle('visible', inp.value.length > 0);
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
    loadVis();
    loadScroll();
    renderAll();

    // Char counters
    setupCounter('add-nombre', 'counter-nombre', 16);
    setupCounter('add-dni', 'counter-dni', 8);
    setupCounter('add-monto', 'counter-monto', 4);
    setupCounter('add-tasa', 'counter-tasa', 2);
    setupCounter('edit-nombre', 'counter-edit-nombre', 16);
    setupCounter('edit-dni', 'counter-edit-dni', 8);
    setupCounter('edit-monto', 'counter-edit-monto', 4);
    setupCounter('edit-tasa', 'counter-edit-tasa', 2);
    setupCounter('more-monto', 'counter-more-monto', 4);
    setupCounter('cuota-monto', 'counter-cuota-monto', 4);
    setupCounter('capital-monto', 'counter-capital-monto', 4);
    setupCounter('retiro-monto', 'counter-retiro-monto', 4);

    // Numeric enforcement
    ['add-dni','add-monto','add-tasa','edit-dni','edit-monto','edit-tasa','more-monto','cuota-monto','capital-monto','retiro-monto','config-capital','nota-efectivo','nota-virtual'].forEach(enforceNum);

    // Nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', e => { const v = e.currentTarget.dataset.view; if (v) switchView(v); });
    });

    // FAB
    const fab = document.getElementById('fab-add');
    if (fab) {
        fab.addEventListener('click', () => {
            const hoyStr = getPeruDateStr();
            const ff = parseDate(hoyStr);
            ff.setDate(ff.getDate() + 30);
            document.getElementById('add-fecha-inicio').value = hoyStr;
            document.getElementById('add-fecha-fin').value = formatDateToStr(ff);
            openModal('modal-add');
        });
    }

    // Toggle amounts
    document.getElementById('btn-toggle-amounts')?.addEventListener('click', toggleVis);

    // Notes
    document.getElementById('btn-notas')?.addEventListener('click', showNotesModal);
    document.getElementById('btn-guardar-notas')?.addEventListener('click', saveNotesData);

    // Menu
    const menuBtn = document.getElementById('btn-menu');
    const dropdown = document.getElementById('header-dropdown');
    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('show'); });
        document.addEventListener('click', e => { if (!e.target.closest('.header-menu-wrap')) dropdown.classList.remove('show'); });
    }

    // Menu items
    document.getElementById('menu-add-capital')?.addEventListener('click', () => { dropdown.classList.remove('show'); showAddCapitalModal(); });
    document.getElementById('menu-retirar')?.addEventListener('click', () => { dropdown.classList.remove('show'); showRetirarModal(); });
    document.getElementById('menu-export')?.addEventListener('click', () => { dropdown.classList.remove('show'); showExportModal(); });
    document.getElementById('menu-config')?.addEventListener('click', () => { dropdown.classList.remove('show'); showConfigModal(); });

    // Modal close buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });

    // Overlay click
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });

    // Setup input focus scroll for all modals
    ['modal-add','modal-edit','modal-add-more','modal-add-cuota','modal-delete','modal-add-capital','modal-retirar','modal-config','modal-export','modal-notas'].forEach(setupInputFocus);

    // Search
    document.getElementById('search-activos')?.addEventListener('input', () => { renderActivos(); updateSearchClear('search-activos'); });
    document.getElementById('search-historial')?.addEventListener('input', () => { renderHistorial(); updateSearchClear('search-historial'); });
    document.getElementById('clear-search-activos')?.addEventListener('click', () => clearSearch('search-activos'));
    document.getElementById('clear-search-historial')?.addEventListener('click', () => clearSearch('search-historial'));

    // Auto fecha fin
    const fIn = document.getElementById('add-fecha-inicio');
    if (fIn) fIn.addEventListener('change', function() {
        if (this.value) { const f = parseDate(this.value); f.setDate(f.getDate() + 30); document.getElementById('add-fecha-fin').value = formatDateToStr(f); }
    });

    // Action buttons
    document.getElementById('btn-add-loan')?.addEventListener('click', addLoan);
    document.getElementById('btn-save-edit')?.addEventListener('click', saveEditLoan);
    document.getElementById('btn-add-more')?.addEventListener('click', addMoreLoan);
    document.getElementById('btn-add-cuota')?.addEventListener('click', addCuota);
    document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDelete);
    document.getElementById('btn-add-capital')?.addEventListener('click', addCapital);
    document.getElementById('btn-retirar')?.addEventListener('click', retirarDinero);
    document.getElementById('btn-save-capital')?.addEventListener('click', saveCapital);
    document.getElementById('btn-reset-all')?.addEventListener('click', resetAll);
    document.getElementById('btn-copy-export')?.addEventListener('click', copyExport);
    document.getElementById('btn-download-export')?.addEventListener('click', downloadExport);
    document.getElementById('btn-import-data')?.addEventListener('click', importData);

    // Delegated loan actions
    const loansBox = document.getElementById('lista-activos');
    if (loansBox) {
        loansBox.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const act = btn.dataset.action, id = btn.dataset.id;
            switch(act) { case 'edit': showEditLoan(id); break; case 'pay': payLoan(id); break; case 'addmore': showAddMore(id); break; case 'cuota': showAddCuota(id); break; case 'delete': showDeleteLoan(id); break; case 'billetes': toggleBilletes(id); break; }
        });
    }

    // Delegated collapsibles
    document.addEventListener('click', e => {
        const hdr = e.target.closest('.collapse-header');
        if (hdr) {
            const tid = hdr.dataset.toggle;
            if (tid) { hdr.classList.toggle('open'); const body = document.getElementById(tid); if (body) body.classList.toggle('show'); }
        }
    });

    // Scroll tracking per view
    document.querySelectorAll('.view-scroll').forEach(el => {
        const v = el.closest('.view');
        if (v) {
            const name = v.id.replace('view-', '');
            el.addEventListener('scroll', () => saveScroll(name, el.scrollTop));
        }
    });

    // Viewport fix
    function setVH() { document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => setTimeout(setVH, 100));
    setVH();

    // Initial view
    switchView('dashboard');
});