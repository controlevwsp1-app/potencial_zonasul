// ============================================================
// app.js — CARBANK · Carteira SP
// ============================================================

// ── CREDENCIAIS SUPABASE ──
const SUPA_URL = 'https://yydctmbavkttcvahntco.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZGN0bWJhdmt0dGN2YWhudGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTQ5NjcsImV4cCI6MjA4OTYzMDk2N30.BBmlIOvhC8gN01bMcAmfyMqhkqYWRDeG18aYBacM6kM';

// ── MR META ──
const MR_META = {
  'MR-C1': { nome:'Centro · Bela Vista · Higienópolis',              zona:'Centro',     cor:'#BA7517', bg:'#FAEEDA', txt:'#633806', lat:-23.553, lng:-46.645 },
  'MR-S1': { nome:'Vila Mariana · Saúde · Ipiranga',                 zona:'Zona Sul',   cor:'#1D9E75', bg:'#E1F5EE', txt:'#04342C', lat:-23.587, lng:-46.628 },
  'MR-S2': { nome:'Jabaquara · Cidade Ademar · Pedreira',            zona:'Zona Sul',   cor:'#0F6E56', bg:'#9FE1CB', txt:'#04342C', lat:-23.656, lng:-46.653 },
  'MR-S3': { nome:'Itaim Bibi · Campo Belo · Brooklin',              zona:'Zona Sul',   cor:'#5DCAA5', bg:'#C0EDD8', txt:'#04342C', lat:-23.610, lng:-46.685 },
  'MR-S4': { nome:'Santo Amaro · Interlagos · Chácara Sto. Antônio', zona:'Zona Sul',   cor:'#085041', bg:'#5DCAA5', txt:'#E1F5EE', lat:-23.660, lng:-46.710 },
  'MR-S5': { nome:'Cidade Dutra · Grajaú · Guarapiranga · Socorro',  zona:'Zona Sul',   cor:'#9FE1CB', bg:'#E1F5EE', txt:'#04342C', lat:-23.715, lng:-46.690 },
  'MR-O1': { nome:'Pinheiros · Vila Madalena · Lapa · Perdizes',     zona:'Zona Oeste', cor:'#378ADD', bg:'#E6F1FB', txt:'#042C53', lat:-23.544, lng:-46.705 },
  'MR-O2': { nome:'Butantã · Jaguaré · Vila Leopoldina',             zona:'Zona Oeste', cor:'#185FA5', bg:'#B5D4F4', txt:'#042C53', lat:-23.563, lng:-46.750 },
  'MR-O3': { nome:'Morumbi · Campo Limpo · Capão Redondo · Pirituba',zona:'Zona Oeste', cor:'#0C447C', bg:'#85B7EB', txt:'#E6F1FB', lat:-23.638, lng:-46.760 },
};

// ── STATE ──
let allLojas = [];
let filteredLojas = [];
let mapaInitialized = false;
let mapInstance = null;
let mapMarkers = [];
let sb = null;

// ══════════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════════
function initSupabase() {
  try {
    sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    window.SUPABASE_CLIENT = sb;
    console.log('✅ Supabase inicializado');
    return true;
  } catch(e) {
    console.error('❌ Erro ao inicializar Supabase:', e);
    return false;
  }
}

async function loadLojas() {
  showLoading(true, 'Carregando dados...');
  try {
    const { data, error } = await sb
      .from('lojas')
      .select('*')
      .order('micro_regiao')
      .order('razao_social');
    if (error) throw error;
    allLojas = data || [];
    filteredLojas = [...allLojas];
    console.log(`✅ ${allLojas.length} lojas carregadas`);
    renderAll();
  } catch(e) {
    console.error('❌ Erro ao carregar lojas:', e);
    showToast('Erro ao carregar: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ══════════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════════
function renderAll() {
  const active = allLojas.filter(l => l.ativo !== false);
  document.getElementById('badge-total').textContent = active.length + ' lojas ativas';
  renderDashboard();
  applyTableFilters();
  populateColabFilter();
}

function populateColabFilter() {
  const sel = document.getElementById('f-colab');
  if (!sel) return;
  const colabs = [...new Set(allLojas.map(l => l.colaboradora).filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas colaboradoras</option><option value="__sem__">Sem colaboradora</option>' +
    colabs.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const active = allLojas.filter(l => l.ativo !== false);
  document.getElementById('m-lojas').textContent     = active.length;
  document.getElementById('m-contratos').textContent = active.reduce((s,l) => s + (l.contratos_geral||0), 0).toLocaleString('pt-BR');
  document.getElementById('m-volume').textContent    = fmtBRL(active.reduce((s,l) => s + (l.volume_geral||0), 0));
  document.getElementById('m-colabs').textContent    = new Set(active.map(l => l.colaboradora).filter(Boolean)).size || '—';
  renderMRCards(active);
  renderColabCards(active);
  renderComparativoMR(active);
}

function renderMRCards(active) {
  const container = document.getElementById('mr-cards-dash');
  container.innerHTML = '';
  const maxLojas = Math.max(1, ...Object.keys(MR_META).map(mr => active.filter(l => l.micro_regiao === mr).length));

  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas    = active.filter(l => l.micro_regiao === mr);
    const colabs   = [...new Set(lojas.map(l => l.colaboradora).filter(Boolean))];
    const contratos = lojas.reduce((s,l) => s + (l.contratos_geral||0), 0);
    const volume   = lojas.reduce((s,l) => s + (l.volume_geral||0), 0);
    const pct      = Math.round(lojas.length / maxLojas * 100);

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${meta.cor};">
      <div class="card-header" style="background:${meta.bg};">
        <div>
          <span class="mr-pill" style="background:${meta.cor};">${mr}</span>
          <span class="badge" style="margin-left:6px;background:${meta.bg};color:${meta.txt};border:1px solid ${meta.cor}40;">${meta.zona}</span>
        </div>
        <span style="font-size:11px;color:${meta.txt};">${lojas.length} lojas</span>
      </div>
      <div class="card-body">
        <div style="font-size:12px;font-weight:500;color:var(--gray-800);margin-bottom:10px;">${meta.nome}</div>
        <div class="progress" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${pct}%;background:${meta.cor};"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Contratos</div>
            <div style="font-size:16px;font-weight:700;color:${meta.cor};">${contratos}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Volume</div>
            <div style="font-size:16px;font-weight:700;color:${meta.cor};">${fmtK(volume)}</div>
          </div>
        </div>
        ${colabs.length > 0
          ? `<div style="border-top:1px solid var(--gray-100);padding-top:8px;">
               <div style="font-size:10px;color:var(--gray-600);margin-bottom:4px;">COLABORADORAS</div>
               <div style="display:flex;flex-wrap:wrap;gap:4px;">
                 ${colabs.map(c => `<span style="background:${meta.cor}20;color:${meta.cor};font-size:11px;font-weight:500;padding:2px 7px;border-radius:10px;">${c}</span>`).join('')}
               </div>
             </div>`
          : `<div style="border-top:1px solid var(--gray-100);padding-top:8px;font-size:11px;color:var(--gray-400);">Sem colaboradora atribuída</div>`}
      </div>
    </div>`;
  });
}

function renderColabCards(active) {
  const container = document.getElementById('colab-cards');
  container.innerHTML = '';
  const colabMap = {};
  active.forEach(l => {
    if (!l.colaboradora) return;
    if (!colabMap[l.colaboradora]) colabMap[l.colaboradora] = { lojas:[], contratos:0, volume:0, mrs:new Set() };
    colabMap[l.colaboradora].lojas.push(l);
    colabMap[l.colaboradora].contratos += (l.contratos_geral||0);
    colabMap[l.colaboradora].volume    += (l.volume_geral||0);
    colabMap[l.colaboradora].mrs.add(l.micro_regiao);
  });

  const semColab = active.filter(l => !l.colaboradora).length;

  if (Object.keys(colabMap).length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:13px;">
      Nenhuma colaboradora atribuída ainda.<br>Vá para <strong>Planilha</strong> e preencha a coluna <em>Colaboradora</em>.
    </div>`;
    return;
  }

  const colors = ['#1D9E75','#185FA5','#BA7517','#D85A30','#534AB7','#0F6E56','#0C447C'];
  const sorted = Object.entries(colabMap).sort((a,b) => b[1].volume - a[1].volume);
  const maxVol = sorted[0]?.[1].volume || 1;

  sorted.forEach(([nome, d], i) => {
    const cor = colors[i % colors.length];
    const pct = Math.round(d.volume / maxVol * 100);
    container.innerHTML += `
    <div class="colab-row">
      <div class="colab-avatar" style="background:${cor}20;color:${cor};">${nome.charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div class="colab-name">${nome}</div>
        <div class="colab-sub">${d.lojas.length} lojas · ${[...d.mrs].join(', ')}</div>
        <div class="progress" style="margin-top:5px;">
          <div class="progress-fill" style="width:${pct}%;background:${cor};"></div>
        </div>
      </div>
      <div style="text-align:right;min-width:80px;">
        <div style="font-size:14px;font-weight:700;color:${cor};">${d.contratos}</div>
        <div style="font-size:11px;color:var(--gray-600);">contratos</div>
        <div style="font-size:12px;font-weight:600;color:var(--gray-800);">${fmtK(d.volume)}</div>
      </div>
    </div>`;
  });

  if (semColab > 0) {
    container.innerHTML += `<div style="padding:10px 0;font-size:12px;color:var(--gray-400);">
      + ${semColab} lojas ainda sem colaboradora atribuída
    </div>`;
  }
}

function renderComparativoMR(active) {
  const container = document.getElementById('comparativo-mr');
  container.innerHTML = '';
  const data = Object.entries(MR_META).map(([mr, meta]) => {
    const lojas = active.filter(l => l.micro_regiao === mr);
    return { mr, meta, lojas: lojas.length, volume: lojas.reduce((s,l) => s + (l.volume_geral||0), 0) };
  }).sort((a,b) => b.volume - a.volume);

  const maxVol = data[0]?.volume || 1;
  data.forEach(d => {
    container.innerHTML += `
    <div class="bar-chart-row">
      <div class="bar-chart-label" title="${d.meta.nome}">
        <span class="mr-pill" style="background:${d.meta.cor};font-size:10px;">${d.mr}</span>
        <span style="margin-left:6px;font-size:11px;">${d.lojas} lojas</span>
      </div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(d.volume/maxVol*100)}%;background:${d.meta.cor};"></div>
      </div>
      <div class="bar-chart-val" style="color:${d.meta.cor};">${fmtK(d.volume)}</div>
    </div>`;
  });
}

// ══════════════════════════════════════════════════════════
// PLANILHA / TABELA
// ══════════════════════════════════════════════════════════
let currentPage = 1;
const PAGE_SIZE = 50;
let pendingSaves = {};
let saveTimer = null;

function applyTableFilters() {
  const search = document.getElementById('f-busca')?.value?.toLowerCase() || '';
  const zona   = document.getElementById('f-zona')?.value || '';
  const mr     = document.getElementById('f-mr')?.value || '';
  const colab  = document.getElementById('f-colab')?.value || '';
  const status = document.getElementById('f-status')?.value || '';

  filteredLojas = allLojas.filter(l => {
    if (status === 'ativo'   && l.ativo === false) return false;
    if (status === 'inativo' && l.ativo !== false) return false;
    if (zona  && l.zona !== zona) return false;
    if (mr    && l.micro_regiao !== mr) return false;
    if (colab === '__sem__' && l.colaboradora) return false;
    if (colab && colab !== '__sem__' && l.colaboradora !== colab) return false;
    if (search) {
      const hay = [l.razao_social, l.bairro, l.cnpj, l.colaboradora].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  currentPage = 1;
  renderTable();
  document.getElementById('tbl-count').textContent = `${filteredLojas.length} registros`;
}

function renderTable() {
  const tbody = document.getElementById('lojas-tbody');
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredLojas.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageData.map(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const zonaBadge = l.zona === 'Zona Sul' ? 'badge-sul' : l.zona === 'Zona Oeste' ? 'badge-oeste' : 'badge-centro';
    const inativo = l.ativo === false;
    return `
    <tr class="${inativo ? 'inativo' : ''}" data-id="${l.id}">
      <td style="font-size:11px;color:var(--gray-400);">${l.cnpj||''}</td>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.razao_social||''}">${l.razao_social||''}</td>
      <td>${l.bairro||''}</td>
      <td><span class="badge ${zonaBadge}">${l.zona||''}</span></td>
      <td><span class="mr-pill" style="background:${meta.cor||'#888'};">${l.micro_regiao||'—'}</span></td>
      <td>${porteBadge(l.porte)}</td>
      <td style="text-align:center;font-weight:600;">${l.contratos_geral||0}</td>
      <td style="text-align:right;">${fmtBRL(l.volume_geral)}</td>
      <td>
        <input type="text"
          class="colaboradora-input ${l.colaboradora ? 'preenchido' : ''}"
          value="${l.colaboradora||''}"
          placeholder="Nome..."
          data-id="${l.id}"
          onchange="scheduleColabSave(this)"
          oninput="this.classList.toggle('preenchido', this.value.length > 0)"
        />
      </td>
      <td>
        <button class="btn btn-icon btn-danger btn-sm"
          onclick="confirmarToggle(${l.id})"
          title="${inativo ? 'Reativar' : 'Desativar'}">
          ${inativo ? '↩' : '✕'}
        </button>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = filteredLojas.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const container = document.getElementById('paginacao');
  if (pages <= 1) { container.innerHTML = ''; return; }
  let html = `<span style="font-size:12px;color:var(--gray-600);">Pág. ${currentPage} de ${pages}</span>`;
  if (currentPage > 1)     html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage-1})">← Ant.</button>`;
  if (currentPage < pages) html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage+1})">Próx. →</button>`;
  container.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); window.scrollTo(0, 0); }

// ── SAVE COLABORADORA ──
function scheduleColabSave(input) {
  const id = input.dataset.id;
  pendingSaves[id] = input.value.trim() || null;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, 800);
  const ind = document.getElementById('save-indicator');
  ind.textContent = 'Salvando...';
  ind.style.color = 'var(--amber)';
}

async function flushSaves() {
  const entries = Object.entries(pendingSaves);
  pendingSaves = {};
  if (!entries.length) return;

  for (const [id, colaboradora] of entries) {
    const idx = allLojas.findIndex(l => String(l.id) === String(id));
    if (idx >= 0) allLojas[idx].colaboradora = colaboradora;
    if (sb) {
      const { error } = await sb.from('lojas').update({ colaboradora }).eq('id', id);
      if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
    }
  }

  const ind = document.getElementById('save-indicator');
  ind.textContent = '✓ Salvo';
  ind.style.color = 'var(--verde)';
  setTimeout(() => { ind.textContent = ''; }, 2000);
  renderDashboard();
  if (mapaInitialized) refreshMapa();
}

async function salvarTudo() {
  await flushSaves();
  showToast('Tudo salvo ✓', 'success');
}

// ── ATIVAR / DESATIVAR ──
let pendingToggleId = null;

function confirmarToggle(id) {
  pendingToggleId = id;
  const loja = allLojas.find(l => l.id === id);
  const acao = loja?.ativo === false ? 'reativar' : 'desativar';
  document.getElementById('modal-msg').textContent = `Deseja ${acao} a loja "${loja?.razao_social}"?`;
  const btn = document.getElementById('modal-confirm-btn');
  btn.textContent  = acao === 'reativar' ? 'Sim, reativar' : 'Sim, desativar';
  btn.className    = acao === 'reativar' ? 'btn btn-primary' : 'btn btn-danger';
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function executarToggle() {
  document.getElementById('confirm-modal').classList.add('hidden');
  const idx = allLojas.findIndex(l => l.id === pendingToggleId);
  if (idx < 0) return;
  const novoAtivo = !(allLojas[idx].ativo !== false);
  allLojas[idx].ativo = novoAtivo;
  if (sb) {
    const { error } = await sb.from('lojas').update({ ativo: novoAtivo }).eq('id', pendingToggleId);
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  }
  showToast(novoAtivo ? 'Loja reativada ✓' : 'Loja desativada ✓', 'success');
  applyTableFilters();
  renderDashboard();
}

// ══════════════════════════════════════════════════════════
// MAPA
// ══════════════════════════════════════════════════════════
function initMapa() {
  if (mapaInitialized) return;
  mapaInitialized = true;
  mapInstance = L.map('mapa-container', { zoomControl:true, scrollWheelZoom:true })
    .setView([-23.600, -46.690], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18
  }).addTo(mapInstance);
  refreshMapa();
}

function refreshMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  const active     = allLojas.filter(l => l.ativo !== false);
  const allColabs  = [...new Set(active.map(l => l.colaboradora).filter(Boolean))];
  const palette    = ['#1D9E75','#185FA5','#BA7517','#D85A30','#534AB7','#0F6E56','#0C447C','#B91C1C'];
  const colabColors = {};
  allColabs.forEach((c, i) => { colabColors[c] = palette[i % palette.length]; });

  const filterMR    = document.getElementById('mapa-mr-filter')?.value || '';
  const filterColab = document.getElementById('mapa-colab-filter')?.value || '';
  const toPlot      = active.filter(l =>
    (!filterMR || l.micro_regiao === filterMR) &&
    (!filterColab || l.colaboradora === filterColab)
  );

  // Círculos de área por MR
  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = toPlot.filter(l => l.micro_regiao === mr);
    if (!lojas.length) return;
    const radius = 20 + (lojas.length / Math.max(47, 1)) * 30;
    const circle = L.circleMarker([meta.lat, meta.lng], {
      radius, fillColor: meta.cor, color:'#fff', weight:2.5, opacity:1, fillOpacity:0.18
    }).addTo(mapInstance);
    mapMarkers.push(circle);
  });

  // Pontos individuais
  toPlot.forEach(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const cor  = l.colaboradora ? (colabColors[l.colaboradora] || meta.cor) : meta.cor;
    const jLat = meta.lat + (Math.random() - .5) * 0.06;
    const jLng = meta.lng + (Math.random() - .5) * 0.07;

    const dot = L.circleMarker([jLat, jLng], {
      radius:5, fillColor:cor, color:'#fff', weight:1, opacity:1, fillOpacity:0.85
    }).addTo(mapInstance);

    dot.bindPopup(`
      <div style="font-family:sans-serif;min-width:200px;max-width:260px;">
        <div style="background:${meta.bg||'#eee'};padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">
          <span style="background:${meta.cor||'#888'};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">${l.micro_regiao||'—'}</span>
          <div style="font-size:11px;font-weight:600;color:${meta.txt||'#333'};margin-top:4px;line-height:1.3;">${l.razao_social||''}</div>
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:4px;">${l.bairro||''} · ${l.cep||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">
          <div><span style="color:#888;">Contratos</span><br><strong>${l.contratos_geral||0}</strong></div>
          <div><span style="color:#888;">Volume</span><br><strong>${fmtBRL(l.volume_geral)}</strong></div>
        </div>
        ${l.colaboradora
          ? `<div style="background:${cor}20;color:${cor};font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">👤 ${l.colaboradora}</div>`
          : '<div style="font-size:11px;color:#aaa;">Sem colaboradora</div>'}
      </div>`, { offset:[0,-3] });

    dot.on('mouseover', function(){ this.setStyle({radius:7, weight:2}); });
    dot.on('mouseout',  function(){ this.setStyle({radius:5, weight:1}); });
    mapMarkers.push(dot);
  });

  // Legenda
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    legEl.innerHTML = allColabs.length > 0
      ? allColabs.map(c => `<span style="display:inline-flex;align-items:center;gap:5px;background:${colabColors[c]}18;color:${colabColors[c]};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${colabColors[c]};"></span>${c}</span>`).join('')
      : Object.entries(MR_META).map(([mr,m]) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};color:${m.txt};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${m.cor};"></span>${mr}</span>`).join('');
  }

  // Atualiza select de colaboradoras no mapa
  const mapColabSel = document.getElementById('mapa-colab-filter');
  if (mapColabSel) {
    const cur = mapColabSel.value;
    mapColabSel.innerHTML = '<option value="">Todas colaboradoras</option>' +
      allColabs.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ══════════════════════════════════════════════════════════
function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  if (id === 'mapa') setTimeout(initMapa, 100);
}

// ══════════════════════════════════════════════════════════
// IMPORTAR PLANILHA (CSV / XLSX)
// ══════════════════════════════════════════════════════════
const COLUMN_MAP = {
  'cnpj': 'cnpj',
  'razao social': 'razao_social', 'razão social': 'razao_social', 'razao_social': 'razao_social',
  'nome': 'razao_social', 'empresa': 'razao_social',
  'bairro': 'bairro', 'distrito': 'bairro',
  'cep': 'cep',
  'zona': 'zona',
  'micro regiao': 'micro_regiao', 'micro região': 'micro_regiao', 'micro_regiao': 'micro_regiao',
  'mr': 'micro_regiao',
  'porte': 'porte', 'porte da loja': 'porte', 'classificacao': 'porte', 'classificação': 'porte',
  'contratos geral': 'contratos_geral', 'contratos - geral': 'contratos_geral',
  'contratos_geral': 'contratos_geral', 'contratos': 'contratos_geral',
  'volume geral': 'volume_geral', 'volume - geral': 'volume_geral',
  'volume_geral': 'volume_geral', 'volume': 'volume_geral',
  'contratos carbank': 'contratos_carbank', 'contratos perfil carbank': 'contratos_carbank',
  'contratos_carbank': 'contratos_carbank',
  'volume carbank': 'volume_carbank', 'volume perfil carbank': 'volume_carbank',
  'volume_carbank': 'volume_carbank',
  'status': 'status',
  'cnae': 'cnae',
  'endereco': 'endereco', 'endereço': 'endereco',
  'numero': 'numero', 'nº': 'numero', 'n°': 'numero',
  'cidade': 'cidade',
  'uf': 'uf',
  'filial': 'filial',
  'colaboradora': 'colaboradora', 'consultora': 'colaboradora',
  'consultor': 'colaboradora', 'responsavel': 'colaboradora', 'responsável': 'colaboradora',
  'ativo': 'ativo',
};

let importParsedRows = [];

function abrirImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
  resetImportModal();
}

function fecharImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  resetImportModal();
}

function resetImportModal() {
  importParsedRows = [];
  document.getElementById('import-drop-zone').classList.remove('hidden', 'drag-over');
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-preview-section').classList.add('hidden');
  document.getElementById('import-progress-section').classList.add('hidden');
  document.getElementById('import-btn-confirmar').style.display = 'none';
  document.getElementById('import-status-msg').textContent = '';
  document.getElementById('import-file-name').textContent = '';
}

function setupImportDrop() {
  const zone = document.getElementById('import-drop-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });
  zone.addEventListener('click', () => document.getElementById('import-file-input').click());
  document.getElementById('import-file-input').addEventListener('change', e => {
    if (e.target.files[0]) processImportFile(e.target.files[0]);
  });
}

async function processImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  document.getElementById('import-file-name').textContent = `📄 ${file.name}`;
  document.getElementById('import-status-msg').textContent = '';

  if (ext === 'csv') {
    const text = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsText(file, 'UTF-8');
    });
    parseCSV(text);
  } else if (['xlsx','xls','xlsm'].includes(ext)) {
    await parseXLSX(file);
  } else {
    showImportError('Formato não suportado. Use CSV, XLSX ou XLSM.');
  }
}

function parseCSV(text) {
  const firstLine = text.split('\n')[0];
  let sep = ',';
  if ((firstLine.match(/;/g)||[]).length > (firstLine.match(/,/g)||[]).length) sep = ';';
  else if ((firstLine.match(/\t/g)||[]).length > (firstLine.match(/,/g)||[]).length) sep = '\t';

  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) { showImportError('CSV vazio ou inválido.'); return; }

  const headers = splitCsvLine(lines[0], sep).map(h => h.trim().replace(/^"|"$/g,''));
  const rows = lines.slice(1).map(line => {
    const vals = splitCsvLine(line, sep);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));

  processRawRows(headers, rows);
}

function splitCsvLine(line, sep) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
    else if (ch === sep && !inQ) { result.push(cur); cur=''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

async function parseXLSX(file) {
  if (!window.XLSX) {
    document.getElementById('import-status-msg').textContent = '⏳ Carregando biblioteca...';
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  try {
    const buf = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
    const wb  = XLSX.read(buf, { type:'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    if (raw.length < 2) { showImportError('Planilha vazia ou sem dados.'); return; }

    const headers = raw[0].map(h => String(h).trim());
    const rows = raw.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(row[i]||'').trim(); });
      return obj;
    }).filter(r => Object.values(r).some(v => v));

    processRawRows(headers, rows);
  } catch(e) {
    showImportError('Erro ao ler arquivo: ' + e.message);
  }
}

function processRawRows(headers, rows) {
  const fieldMap = {};
  const unmapped = [];

  headers.forEach(h => {
    const key = h.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 _\-º°]/g, '').trim();
    const mapped = COLUMN_MAP[key] || COLUMN_MAP[h.toLowerCase().trim()];
    if (mapped) fieldMap[h] = mapped;
    else unmapped.push(h);
  });

  importParsedRows = rows.map(row => {
    const obj = { ativo: true };
    Object.entries(fieldMap).forEach(([orig, field]) => {
      let val = row[orig];
      if (field === 'contratos_geral' || field === 'contratos_carbank') {
        val = parseInt(String(val).replace(/\D/g,'')) || 0;
      } else if (field === 'volume_geral' || field === 'volume_carbank') {
        val = parseFloat(String(val).replace(/[^\d,.\-]/g,'').replace(',','.')) || 0;
      } else if (field === 'ativo') {
        val = !['false','0','inativo','não','nao','n'].includes(String(val).toLowerCase());
      }
      if (val !== '' && val !== undefined) obj[field] = val;
    });
    return obj;
  }).filter(r => r.cnpj);

  if (!importParsedRows.length) {
    showImportError('Nenhum registro com CNPJ encontrado. Verifique os cabeçalhos.');
    return;
  }

  showImportPreview(fieldMap, unmapped);
}

function showImportPreview(fieldMap, unmapped) {
  document.getElementById('import-drop-zone').classList.add('hidden');
  document.getElementById('import-preview-section').classList.remove('hidden');

  document.getElementById('import-stat-total').textContent  = importParsedRows.length;
  document.getElementById('import-stat-mapped').textContent = Object.keys(fieldMap).length;
  document.getElementById('import-stat-skip').textContent   = unmapped.length;

  document.getElementById('import-col-map').innerHTML =
    Object.entries(fieldMap).map(([o,f]) => `
      <div class="import-col-row">
        <span class="import-col-orig">${o}</span>
        <span class="import-col-arrow">→</span>
        <span class="import-col-dest">${f}</span>
      </div>`).join('') +
    unmapped.map(u => `
      <div class="import-col-row">
        <span class="import-col-orig">${u}</span>
        <span class="import-col-arrow">→</span>
        <span class="import-col-skip">ignorado</span>
      </div>`).join('');

  const fields = ['cnpj','razao_social','bairro','zona','micro_regiao','contratos_geral','volume_geral'];
  document.getElementById('import-preview-thead').innerHTML =
    '<tr>' + fields.map(f => `<th>${f}</th>`).join('') + '</tr>';
  document.getElementById('import-preview-tbody').innerHTML =
    importParsedRows.slice(0,5).map(r =>
      '<tr>' + fields.map(f => `<td>${r[f]??''}</td>`).join('') + '</tr>'
    ).join('');

  document.getElementById('import-btn-confirmar').style.display = 'inline-flex';
  document.getElementById('import-status-msg').textContent = '';
}

async function executarImport() {
  if (!sb) { showImportError('Supabase não configurado.'); return; }
  if (!importParsedRows.length) return;

  document.getElementById('import-btn-confirmar').style.display = 'none';
  document.getElementById('import-preview-section').classList.add('hidden');
  document.getElementById('import-progress-section').classList.remove('hidden');

  const total = importParsedRows.length;
  const BATCH = 50;
  let erros = 0;

  for (let i = 0; i < total; i += BATCH) {
    const batch = importParsedRows.slice(i, i + BATCH);
    const { error } = await sb.from('lojas').upsert(batch, { onConflict: 'cnpj' });
    if (error) { erros++; console.error('Erro no lote:', error); }

    const done = Math.min(i + BATCH, total);
    const pct  = Math.round(done / total * 100);
    document.getElementById('import-progress-bar').style.width = pct + '%';
    document.getElementById('import-progress-label').textContent = `${done} / ${total} registros...`;
  }

  if (erros === 0) {
    document.getElementById('import-progress-label').textContent = `✓ ${total} registros importados!`;
    document.getElementById('import-progress-bar').style.background = 'var(--verde)';
    showToast(`${total} lojas importadas ✓`, 'success');
  } else {
    document.getElementById('import-progress-label').textContent = `Concluído com ${erros} erro(s). Veja o console (F12).`;
  }

  setTimeout(async () => {
    fecharImportModal();
    await loadLojas();
  }, 1800);
}

function showImportError(msg) {
  const el = document.getElementById('import-status-msg');
  el.textContent = '⚠ ' + msg;
  el.style.color = '#B91C1C';
}

// ══════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════
function porteBadge(porte) {
  if (!porte) return '<span style="color:#aaa;font-size:11px;">—</span>';
  const p = porte.trim().toUpperCase();
  const map = { 'F':'#1565C0','E':'#6cd1f0','D':'#26A69A','C':'#66BB6A','B':'#FFA726','A':'#EF5350' };
  const bg = map[p[0]] || '#E0E0E0';
  const color = bg === '#E0E0E0' ? '#555' : '#fff';
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="${porte}">${porte}</span>`;
}

function fmtBRL(n) {
  if (!n) return 'R$ 0';
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 });
}

function fmtK(n) {
  if (!n) return 'R$ 0';
  if (n >= 1e6) return 'R$ ' + (n/1e6).toFixed(1) + 'M';
  return 'R$ ' + (n/1e3).toFixed(0) + 'K';
}

function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function showLoading(show, msg='Carregando dados...') {
  const el = document.getElementById('loading-overlay');
  el.querySelector('span').textContent = msg;
  el.classList.toggle('hidden', !show);
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Carbank iniciando...');

  if (!initSupabase()) {
    showToast('Erro ao conectar ao Supabase', 'error');
    showLoading(false);
    return;
  }

  await loadLojas();
  setupImportDrop();

  ['f-busca','f-zona','f-mr','f-colab','f-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  applyTableFilters);
    document.getElementById(id)?.addEventListener('change', applyTableFilters);
  });

  ['mapa-mr-filter','mapa-colab-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshMapa);
  });
});
