/**
 * Execution Intelligence Suite v5.4 - "Execution Compass"
 * STRICT ISOLATION & EXECUTIVE ANALYTICS
 */

// --- 1. CONFIGURATION & STATE ---
const state = {
    currentSection: 'dashboard',
    context: {
        activeClient: 'Cliente Demo',
        activePeriod: '2026-01'
    },
    clients: {
        'Cliente Demo': {
            config: { costos: 32000, inversion: 6361, lc: 2568 },
            estudios: {
                '2026-01': {
                    marketing: { impresiones: 182710, alcance: 94000, resultados: 344, adSpend: 8986 },
                    operacion: { citasAgendadas: 80, citasAtendidas: 64, procedimientos: 12 },
                    ventas: { ventaTotal: 145000, costos: 0, inversion: 0, leadConnector: 0, pauta: 0 }
                }
            }
        }
    }
};

// --- 2. PERSISTENCE LAYER ---
const PersistenceManager = {
    key: 'ec_suite_data_v5',
    save() {
        localStorage.setItem(this.key, JSON.stringify({
            context: state.context,
            clients: state.clients
        }));
    },
    load() {
        const raw = localStorage.getItem(this.key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.context) state.context = parsed.context;
            if (parsed.clients) state.clients = parsed.clients;
        }
    }
};

// --- 3. DATA ENGINE ---
const DataManager = {
    getClient() { return state.clients[state.context.activeClient] || state.clients['Cliente Demo']; },
    getStudy(period = state.context.activePeriod) {
        const c = this.getClient();
        if (!c.estudios[period]) {
            c.estudios[period] = {
                marketing: { impresiones: 0, alcance: 0, resultados: 0, adSpend: 0 },
                operacion: { citasAgendadas: 0, citasAtendidas: 0, procedimientos: 0 },
                ventas: { ventaTotal: 0, costos: 0, inversion: 0, leadConnector: 0, pauta: 0 }
            };
        }
        return c.estudios[period];
    },
    getPreviousPeriod(current) {
        let [y, m] = current.split('-').map(Number);
        m--; if (m === 0) { m = 12; y--; }
        return `${y}-${String(m).padStart(2, '0')}`;
    },
    getComparisonStudy() {
        const prevPeriod = this.getPreviousPeriod(state.context.activePeriod);
        return this.getClient().estudios[prevPeriod] || null;
    }
};

// --- 4. FINANCIAL ENGINE ---
const FinanceManager = {
    calculate(study, clientConfig) {
        const m = study.marketing;
        const v = study.ventas;
        const pauta = v.pauta || m.adSpend;
        const totalMarketing = pauta + (v.inversion || clientConfig.inversion) + (v.leadConnector || clientConfig.lc);
        const totalCosts = totalMarketing + (v.costos || clientConfig.costos);
        const profit = v.ventaTotal - totalCosts;

        return {
            pauta, totalMarketing, totalCosts, ventaTotal: v.ventaTotal, profit,
            roas: pauta > 0 ? (v.ventaTotal / pauta) : 0,
            roe: totalCosts > 0 ? (profit / totalCosts) : 0,
            assistRate: study.operacion.citasAgendadas > 0 ? (study.operacion.citasAtendidas / study.operacion.citasAgendadas * 100) : 0,
            cpl: m.resultados > 0 ? (pauta / m.resultados) : 0,
            // Métricas crudas para el dashboard
            alcance: m.alcance || 0,
            impresiones: m.impresiones || 0,
            resultados: m.resultados || 0,
            citasAgendadas: study.operacion.citasAgendadas || 0,
            citasAtendidas: study.operacion.citasAtendidas || 0,
            procedimientos: study.operacion.procedimientos || 0
        };
    }
};

// --- 5. UI ENGINE ---
const UIManager = {
    showSection(id) {
        console.log(`Rendering Section: ${id}`);
        state.currentSection = id;

        // UI cleanup
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const nav = Array.from(document.querySelectorAll('.nav-item')).find(i => i.getAttribute('onclick')?.includes(id));
        if (nav) nav.classList.add('active');

        const client = DataManager.getClient();
        const curStudy = DataManager.getStudy();
        const prevStudy = DataManager.getComparisonStudy();
        const curMetrics = FinanceManager.calculate(curStudy, client.config);
        const prevMetrics = prevStudy ? FinanceManager.calculate(prevStudy, client.config) : curMetrics;

        document.getElementById('view-title').innerText = this.getSectionTitle(id);
        document.getElementById('view-subtitle').innerText = `${state.context.activeClient} • ${state.context.activePeriod}`;

        const container = document.getElementById('content-area');
        container.innerHTML = ''; // Force Clean

        switch (id) {
            case 'dashboard': this.renderDashboard(container, curMetrics, prevMetrics); break;
            case 'marketing': this.renderMarketing(container, curStudy, prevStudy, curMetrics); break;
            case 'operaciones': this.renderOperaciones(container, curStudy, prevStudy, curMetrics); break;
            case 'ventas': this.renderVentas(container, curMetrics, curStudy, client.config); break;
            case 'config': this.renderConfig(container, client, curStudy); break;
        }
        this.renderContextSelector();
    },

    getSectionTitle(id) {
        const m = { dashboard: 'Compass Dashboard', marketing: 'Análisis Marketing', operaciones: 'Embudo Comercial', ventas: 'Visión Financiera', config: 'Centro de Control' };
        return m[id] || 'Suite';
    },

    renderContextSelector() {
        const header = document.querySelector('.header-actions');
        if (!header) return;
        header.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <select onchange="App.setClient(this.value)" class="premium-input" style="padding:0.4rem; font-size:0.75rem;">
                    ${Object.keys(state.clients).map(c => `<option value="${c}" ${c === state.context.activeClient ? 'selected' : ''}>${c}</option>`).join('')}
                    <option value="+ NEW">+ Nuevo</option>
                </select>
                <input type="month" value="${state.context.activePeriod}" onchange="App.setPeriod(this.value)" class="premium-input" style="padding:0.4rem; font-size:0.75rem;">
            </div>
        `;
    },

    renderDashboard(el, cur, prev) {
        const margin = cur.ventaTotal > 0 ? ((cur.profit / cur.ventaTotal) * 100).toFixed(1) : 0;
        el.innerHTML = `
            <div class="card-premium animate-fade-in" style="background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%); color: white; padding: 2rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem;">Execution Compass</h2>
                    <p style="opacity: 0.9;">Utilidad Neta: <b>$${cur.profit.toLocaleString()}</b> | Margen: <b>${margin}%</b></p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.75rem; opacity: 0.8; text-transform: uppercase;">ROE (ROI)</span>
                    <div style="font-size: 1.75rem; font-weight: 800;">${(cur.roe * 100).toFixed(1)}%</div>
                </div>
            </div>

            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Inversión Ads', cur.pauta, prev.pauta, '$', true)}
                ${this.statCard('Leads Totales', cur.alcance, prev.alcance)}
                ${this.statCard('Venta Bruta', cur.ventaTotal, prev.ventaTotal, '$')}
                ${this.statCard('% Asistencia', cur.assistRate.toFixed(1), prev.assistRate.toFixed(1), '', false, '%')}
            </div>

            <div class="dashboard-grid animate-fade-in">
                ${this.statCard('CPL Promedio', cur.cpl, prev.cpl, '$', true)}
                ${this.statCard('Utilidad Real', cur.profit, prev.profit, '$')}
                ${this.statCard('ROAS Total', cur.roas.toFixed(2), prev.roas.toFixed(2), '', false, 'x')}
            </div>
        `;
    },

    renderMarketing(el, cur, prev, metrics) {
        const m = cur.marketing;
        const pm = prev ? prev.marketing : m;
        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Alcance', m.alcance, pm.alcance)}
                ${this.statCard('Impresiones', m.impresiones, pm.impresiones)}
                ${this.statCard('Leads (Resultados)', m.resultados, pm.resultados)}
                ${this.statCard('Costo / Resultado', metrics.cpl, 0, '$', true)}
                ${this.statCard('Ad Spend', m.adSpend, pm.adSpend, '$', true)}
            </div>

            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem;">
                <div class="card-premium" style="min-height: 400px; display: flex; flex-direction: column;">
                    <h3 style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2rem;">Rendimiento Audiencia e Inversión</h3>
                    <div style="flex: 1; display:flex; align-items: flex-end; justify-content: space-around; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 1.5rem;">
                        ${this.renderChartBar('Alcance', m.alcance, 100000, 'var(--primary)')}
                        ${this.renderChartBar('Impresiones', m.impresiones, 200000, '#4338ca')}
                        ${this.renderChartBar('Venta', cur.ventas.ventaTotal, 200000, '#10b981')}
                    </div>
                </div>
                <div class="card-premium" style="display: flex; flex-direction: column; justify-content: center; gap: 2rem;">
                    <div style="text-align: center;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Retorno ROAS</span>
                        <div style="font-size: 3rem; font-weight: 800; color: #4338ca;">${metrics.roas.toFixed(2)}x</div>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Costo por Lead</span>
                        <div style="font-size: 3rem; font-weight: 800; color: var(--primary);">$${metrics.cpl.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes growUp { from { height: 0; } }
                .chart-bar { animation: growUp 1.5s ease-out; }
            </style>
        `;
    },

    renderOperaciones(el, cur, prev, metrics) {
        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Agendadas', cur.operacion.citasAgendadas, 0)}
                ${this.statCard('Atendidas', cur.operacion.citasAtendidas, 0)}
                ${this.statCard('% Asistencia', metrics.assistRate.toFixed(1), 0, '', false, '%')}
                ${this.statCard('Procedimientos', cur.operacion.procedimientos, 0)}
            </div>
            <div class="card-premium animate-fade-in">
                <h3 style="margin-bottom: 2rem; font-size: 1rem;">Flujo de Conversión Comercial</h3>
                <div style="display:flex; justify-content: space-between; align-items: center; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 1.5rem;">
                    <div style="text-align:center;"><b>${cur.operacion.citasAgendadas}</b><br><small>Agendadas</small></div>
                    <div style="font-size: 2rem; color: var(--text-muted);">→</div>
                    <div style="text-align:center; color: #4338ca;"><b>${cur.operacion.citasAtendidas}</b><br><small>Atendidas</small></div>
                    <div style="font-size: 2rem; color: var(--text-muted);">→</div>
                    <div style="text-align:center; color: var(--accent-green);"><b>${cur.operacion.procedimientos}</b><br><small>Procedimientos</small></div>
                </div>
            </div>
        `;
    },

    renderVentas(el, m, cur, config) {
        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Venta Total', m.ventaTotal, 0, '$')}
                ${this.statCard('Utilidad Bruta', m.profit, 0, '$')}
                ${this.statCard('ROE (ROI)', (m.roe * 100).toFixed(1), 0, '', false, '%')}
                ${this.statCard('Inversión Ads', m.pauta, 0, '$', true)}
            </div>
            <div class="card-premium animate-fade-in">
                <h3 style="margin-bottom: 1.5rem;">Desglose de Costos de Proyecto</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${this.renderCostLine('Personal & Op', cur.ventas.costos || config.costos, m.totalCosts, 'var(--text-muted)')}
                    ${this.renderCostLine('Inversión Marketing', m.totalMarketing, m.totalCosts, 'var(--primary)')}
                </div>
            </div>
        `;
    },

    renderConfig(el, client, study) {
        el.innerHTML = `
            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="card-premium">
                    <h3 class="section-header">Configuración del Cliente</h3>
                    <div class="input-group"><label>Costos Fijos Operativos</label><input type="number" id="cfg-costos" class="premium-input" value="${client.config.costos}"></div>
                    <div class="input-group"><label>Fee KWIQ</label><input type="number" id="cfg-fee" class="premium-input" value="${client.config.inversion}"></div>
                    <div class="input-group"><label>LeadConnector</label><input type="number" id="cfg-lc" class="premium-input" value="${client.config.lc}"></div>
                    <button onclick="App.saveClientConfig()" class="btn-premium" style="margin-top: 1rem;">Guardar Identidad</button>
                    <hr style="margin: 2rem 0; opacity: 0.1;">
                    <h3 class="section-header">Vision AI</h3>
                    <div class="ocr-zone" onclick="document.getElementById('ocr-input').click()">
                        <p>Analizar Captura de Meta/CRM</p>
                        <input type="file" id="ocr-input" accept="image/*" onchange="App.handleOCR(event)" style="display:none">
                    </div>
                </div>
                <div class="card-premium">
                    <h3 class="section-header">Carga Mensual: ${state.context.activePeriod}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="input-group"><label>Venta ($)</label><input type="number" onchange="App.updateStudyField('ventas', 'ventaTotal', this.value)" class="premium-input" value="${study.ventas.ventaTotal}"></div>
                        <div class="input-group"><label>Ad Spend ($)</label><input type="number" onchange="App.updateStudyField('marketing', 'adSpend', this.value)" class="premium-input" value="${study.marketing.adSpend}"></div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="input-group"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing', 'alcance', this.value)" class="premium-input" value="${study.marketing.alcance}"></div>
                        <div class="input-group"><label>Leads</label><input type="number" onchange="App.updateStudyField('marketing', 'resultados', this.value)" class="premium-input" value="${study.marketing.resultados}"></div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="input-group"><label>Agend.</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAgendadas', this.value)" class="premium-input" value="${study.operacion.citasAgendadas}"></div>
                        <div class="input-group"><label>Atend.</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAtendidas', this.value)" class="premium-input" value="${study.operacion.citasAtendidas}"></div>
                        <div class="input-group"><label>Procs</label><input type="number" onchange="App.updateStudyField('operacion', 'procedimientos', this.value)" class="premium-input" value="${study.operacion.procedimientos}"></div>
                    </div>
                    <div class="input-group" style="margin-top: 1rem;"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing', 'impresiones', this.value)" class="premium-input" value="${study.marketing.impresiones}"></div>
                </div>
            </div>
        `;
    },

    statCard(title, val, prevVal, prefix = '', invert = false, suffix = '') {
        const v = parseFloat(val) || 0;
        const pv = parseFloat(prevVal) || 0;
        const diff = v - pv;
        let pct = pv != 0 ? ((diff / pv) * 100).toFixed(0) : (v > 0 ? 100 : 0);
        const color = (pct >= 0 !== invert) ? 'trend-up' : 'trend-down';
        return `<div class="card"><div class="card-title"><span>${title}</span><span class="${color}">${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%</span></div><div class="card-value">${prefix}${v.toLocaleString()}${suffix}</div></div>`;
    },

    renderChartBar(label, val, max, color) {
        const height = Math.min((val / max) * 100, 100);
        return `<div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; width: 60px;"><div class="chart-bar" style="width:100%; background:${color}; height:${height * 2}px; border-radius: 8px; position:relative;"><div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:0.7rem; font-weight:700;">${(val / 1000).toFixed(1)}k</div></div><span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${label}</span></div>`;
    },

    renderCostLine(label, val, total, color) {
        const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
        return `<div><div style="display:flex; justify-content:space-between; font-size: 0.8rem; margin-bottom: 0.25rem;"><span>${label}</span><b>$${val.toLocaleString()} (${pct}%)</b></div><div style="width:100%; height:8px; background: rgba(0,0,0,0.05); border-radius:4px;"><div style="width:${pct}%; height:100%; background:${color}; border-radius:4px;"></div></div></div>`;
    }
};

// --- 6. CONTROLLER ---
const App = {
    init() { PersistenceManager.load(); UIManager.showSection('dashboard'); },
    setClient(name) {
        if (name === '+ NEW') {
            const n = prompt("Nombre:");
            if (n) { state.clients[n] = { config: { costos: 0, inversion: 0, lc: 0 }, estudios: {} }; state.context.activeClient = n; }
        } else { state.context.activeClient = name; }
        PersistenceManager.save(); UIManager.showSection(state.currentSection);
    },
    setPeriod(val) { state.context.activePeriod = val; PersistenceManager.save(); UIManager.showSection(state.currentSection); },
    updateStudyField(mod, field, val) { const s = DataManager.getStudy(); s[mod][field] = parseFloat(val) || 0; PersistenceManager.save(); UIManager.showSection(state.currentSection); },
    saveClientConfig() {
        const c = DataManager.getClient();
        c.config.costos = parseFloat(document.getElementById('cfg-costos').value) || 0;
        c.config.inversion = parseFloat(document.getElementById('cfg-fee').value) || 0;
        c.config.lc = parseFloat(document.getElementById('cfg-lc').value) || 0;
        PersistenceManager.save(); alert("Identidad Actualizada"); UIManager.showSection('dashboard');
    },
    async handleOCR(e) {
        const file = e.target.files[0]; if (!file) return;
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'spa+eng');
            alert("Vision AI analizó la imagen. Datos detectados listos para referencia.");
            console.log("OCR Output:", text);
        } catch (e) { console.error(e); }
    }
};

window.onload = () => App.init();
window.showSection = (id) => UIManager.showSection(id);
window.App = App;
