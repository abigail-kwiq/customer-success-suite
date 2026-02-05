/**
 * Execution Intelligence Suite v5.0 - "Consultancy" Architecture
 * Multi-Client, Monthly Studies, and Manual Executive Data Entry.
 */

// --- 1. CONFIGURATION & STATE ---
const state = {
    currentSection: 'dashboard',
    context: {
        activeClient: 'Cliente Demo',
        activePeriod: '2026-01' // YYYY-MM
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
            state.context = parsed.context;
            state.clients = parsed.clients;
        }
    }
};

// --- 3. DATA ENGINE (CONTEXT & COMPARISON) ---
const DataManager = {
    getClient() { return state.clients[state.context.activeClient]; },
    getStudy(period = state.context.activePeriod) {
        const c = this.getClient();
        if (!c.estudios[period]) {
            // New study template
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

// --- 4. BUSINESS LOGIC (FINANCIAL ENGINE) ---
const FinanceManager = {
    calculate(study, clientConfig) {
        const m = study.marketing;
        const v = study.ventas;

        // Use manual override in study if present, otherwise use client defaults
        const pauta = v.pauta || m.adSpend;
        const invKWIQ = v.inversion || clientConfig.inversion;
        const lc = v.leadConnector || clientConfig.lc;
        const opCosts = v.costos || clientConfig.costos;

        const inversionTotal = pauta + invKWIQ + lc;
        const gastosTotales = inversionTotal + opCosts;
        const utilidad = v.ventaTotal - gastosTotales;

        return {
            pauta, invKWIQ, lc, opCosts,
            inversionTotal, gastosTotales, ventaTotal: v.ventaTotal, utilidad,
            roas: pauta > 0 ? (v.ventaTotal / pauta) : 0,
            roe: gastosTotales > 0 ? (utilidad / gastosTotales) : 0,
            tasaAsistencia: study.operacion.citasAgendadas > 0 ? (study.operacion.citasAtendidas / study.operacion.citasAgendadas * 100) : 0,
            cpl: m.resultados > 0 ? (pauta / m.resultados) : 0,
            // Raw metrics for dashboard
            alcance: m.alcance,
            impresiones: m.impresiones,
            resultados: m.resultados,
            citasAgendadas: study.operacion.citasAgendadas,
            citasAtendidas: study.operacion.citasAtendidas,
            procedimientos: study.operacion.procedimientos
        };
    }
};

// --- 5. UI & RENDERING ENGINE ---
const UIManager = {
    showSection(id) {
        state.currentSection = id;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const nav = Array.from(document.querySelectorAll('.nav-item')).find(i => i.getAttribute('onclick')?.includes(id));
        if (nav) nav.classList.add('active');

        const client = DataManager.getClient();
        const curStudy = DataManager.getStudy();
        const prevStudy = DataManager.getComparisonStudy();

        const curMetrics = FinanceManager.calculate(curStudy, client.config);
        const prevMetrics = prevStudy ? FinanceManager.calculate(prevStudy, client.config) : curMetrics;

        // Update header info
        const title = document.getElementById('view-title');
        const subtitle = document.getElementById('view-subtitle');
        title.innerText = this.getSectionTitle(id);
        subtitle.innerText = `${state.context.activeClient} • Periodo: ${state.context.activePeriod}`;

        switch (id) {
            case 'dashboard': this.renderDashboard(curMetrics, prevMetrics); break;
            case 'marketing': this.renderMarketing(curStudy, prevStudy); break;
            case 'operaciones': this.renderOperaciones(curStudy, prevStudy); break;
            case 'ventas': this.renderVentas(curMetrics, curStudy, client.config); break;
            case 'config': this.renderConfig(client); break;
        }

        this.renderContextSelector(); // Add selectors to header if not present
    },

    getSectionTitle(id) {
        const m = { dashboard: 'Dashboard Ejecutivo', marketing: 'Marketing', operaciones: 'Operaciones CRM', ventas: 'Finanzas & ROI', config: 'Consultoría Config' };
        return m[id] || 'Suite';
    },

    renderContextSelector() {
        const header = document.querySelector('.header-actions');
        if (!header) return;

        let clientOptions = Object.keys(state.clients).map(c => `<option value="${c}" ${c === state.context.activeClient ? 'selected' : ''}>${c}</option>`).join('');

        header.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <select onchange="App.setClient(this.value)" class="premium-input" style="padding:0.4rem 0.75rem; width:150px; font-size:0.75rem;">
                    ${clientOptions}
                    <option value="+ NEW">+ Nuevo Cliente</option>
                </select>
                <input type="month" value="${state.context.activePeriod}" onchange="App.setPeriod(this.value)" class="premium-input" style="padding:0.4rem 0.75rem; width:140px; font-size:0.75rem;">
            </div>
        `;
    },

    renderDashboard(cur, prev) {
        const margin = cur.ventaTotal > 0 ? ((cur.utilidad / cur.ventaTotal) * 100).toFixed(1) : 0;
        document.getElementById('content-area').innerHTML = `
            <div class="card-premium animate-fade-in" style="background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%); color: white; padding: 2rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem;">Execution Compass</h2>
                    <p style="opacity: 0.9;">Utilidad Neta: <b>$${cur.utilidad.toLocaleString()}</b> | Margen: <b>${margin}%</b></p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.75rem; opacity: 0.8; text-transform: uppercase;">ROE Histórico</span>
                    <div style="font-size: 1.5rem; font-weight: 800;">${(cur.roe * 100).toFixed(1)}%</div>
                </div>
            </div>

            <div class="animate-fade-in">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Marketing de Resultados</h3>
                <div class="dashboard-grid" style="margin-bottom: 2.5rem;">
                    ${this.statCard('Inversión Ads', cur.pauta, prev.pauta, '$', true)}
                    ${this.statCard('Alcance', cur.alcance, prev.alcance)}
                    ${this.statCard('Impresiones', cur.impresiones, prev.impresiones)}
                    ${this.statCard('Leads (Resultados)', cur.resultados, prev.resultados)}
                    ${this.statCard('Costo por Lead', cur.cpl, prev.cpl, '$', true)}
                </div>

                <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Operaciones & Conversión</h3>
                <div class="dashboard-grid" style="margin-bottom: 2.5rem;">
                    ${this.statCard('Citas Agendadas', cur.citasAgendadas, prev.citasAgendadas)}
                    ${this.statCard('Citas Atendidas', cur.citasAtendidas, prev.citasAtendidas)}
                    ${this.statCard('% Asistencia', parseFloat(cur.tasaAsistencia.toFixed(1)), parseFloat(prev.tasaAsistencia.toFixed(1)), '', false, '%')}
                    ${this.statCard('Procedimientos', cur.procedimientos, prev.procedimientos)}
                </div>

                <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Revenue & Rentabilidad</h3>
                <div class="dashboard-grid" style="margin-bottom: 2.5rem;">
                    ${this.statCard('Venta Total', cur.ventaTotal, prev.ventaTotal, '$')}
                    ${this.statCard('Utilidad Neta', cur.utilidad, prev.utilidad, '$')}
                    ${this.statCard('ROAS', parseFloat(cur.roas.toFixed(2)), parseFloat(prev.roas.toFixed(2)), '', false, 'x')}
                    ${this.statCard('ROE (ROI)', parseFloat((cur.roe * 100).toFixed(1)), parseFloat((prev.roe * 100).toFixed(1)), '', false, '%')}
                </div>
            </div>
        `;
    },

    renderMarketing(cur, prev) {
        document.getElementById('content-area').innerHTML = `
            <div class="config-grid animate-fade-in">
                <div class="card-premium">
                    <div class="section-header"><h3>Carga Manual: Canales</h3></div>
                    <div class="input-group"><label>Inversión Publicitaria ($)</label><input type="number" onchange="App.updateStudyField('marketing', 'adSpend', this.value)" class="premium-input" value="${cur.marketing.adSpend}"></div>
                    <div class="input-group"><label>Resultados (Leads)</label><input type="number" onchange="App.updateStudyField('marketing', 'resultados', this.value)" class="premium-input" value="${cur.marketing.resultados}"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
                        <div class="input-group"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing', 'alcance', this.value)" class="premium-input" value="${cur.marketing.alcance}"></div>
                        <div class="input-group"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing', 'impresiones', this.value)" class="premium-input" value="${cur.marketing.impresiones}"></div>
                    </div>
                </div>
                <div class="card-premium">
                    <div class="section-header"><h3>Soportes & Vision AI</h3></div>
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Alcance Total', cur.alcance, prev.alcance)}
                ${this.statCard('Impresiones', cur.impresiones, prev.impresiones)}
                ${this.statCard('Leads (Resultados)', cur.resultados, prev.resultados)}
                ${this.statCard('Inversión Publicitaria', cur.pauta, prev.pauta, '$', true)}
            </div>

            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 1rem;">Rendimiento de Visibilidad</h3>
                    <div style="height: 200px; display: flex; align-items: flex-end; gap: 1rem; padding-top: 1rem;">
                        <div style="flex: 1; position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                            <div style="width: 100%; background: var(--primary); height: 75%; border-radius: 0.5rem 0.5rem 0 0; opacity: 0.8;"></div>
                            <span style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--text-muted);">Alcance</span>
                        </div>
                        <div style="flex: 1; position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                            <div style="width: 100%; background: #4338ca; height: 100%; border-radius: 0.5rem 0.5rem 0 0;"></div>
                            <span style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--text-muted);">Impresiones</span>
                        </div>
                    </div>
                </div>
                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 1rem;">Eficiencia de Conversión</h3>
                    <div style="padding: 1rem; background: rgba(16,185,129,0.05); border-radius: 0.75rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Costo por Lead (CPL)</span>
                            <b style="color: var(--primary);">$${cur.cpl.toFixed(2)}</b>
                        </div>
                        <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${Math.min((cur.cpl / 50) * 100, 100)}%; height: 100%; background: var(--primary);"></div>
                        </div>
                    </div>
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(67, 56, 202, 0.05); border-radius: 0.75rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">ROAS de Inversión</span>
                            <b style="color: #4338ca;">${cur.roas.toFixed(2)}x</b>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderOperaciones(cur, prev) {
        document.getElementById('content-area').innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Citas Agendadas', cur.citasAgendadas, prev.citasAgendadas)}
                ${this.statCard('Citas Atendidas', cur.citasAtendidas, prev.citasAtendidas)}
                ${this.statCard('% Asistencia', parseFloat(cur.tasaAsistencia.toFixed(1)), parseFloat(prev.tasaAsistencia.toFixed(1)), '', false, '%')}
                ${this.statCard('Procedimientos', cur.procedimientos, prev.procedimientos)}
            </div>
            
            <div class="card-premium animate-fade-in">
                <h3 style="margin-bottom: 1.5rem; font-size: 1rem;">Eficiencia del Embudo Comercial</h3>
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${cur.citasAgendadas}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Agendadas</div>
                    </div>
                    <div style="color: var(--text-muted); font-size: 1.5rem;">→</div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #4338ca;">${cur.citasAtendidas}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Atendidas</div>
                    </div>
                    <div style="color: var(--text-muted); font-size: 1.5rem;">→</div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-green);">${cur.procedimientos}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Procedimientos</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderVentas(metrics, study, config) {
        document.getElementById('content-area').innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Venta Total', metrics.ventaTotal, 0, '$')}
                ${this.statCard('Utilidad Neta', metrics.utilidad, 0, '$')}
                ${this.statCard('ROE (ROI)', parseFloat((metrics.roe * 100).toFixed(1)), 0, '', false, '%')}
                ${this.statCard('Costo Operativo', metrics.opCosts, 0, '$', true)}
            </div>

            <div class="card-premium animate-fade-in">
                <h3 style="margin-bottom: 1.5rem; font-size: 1rem;">Composición de Gastos y Rentabilidad</h3>
                <div style="display: flex; gap: 2rem;">
                    <div style="flex: 2; display: flex; flex-direction: column; gap: 1rem;">
                        <div style="display:flex; justify-content:space-between; font-size: 0.85rem;">
                            <span>Costos Operación</span><b>$${metrics.opCosts.toLocaleString()}</b>
                        </div>
                        <div style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${(metrics.opCosts / metrics.gastosTotales * 100) || 0}%; height: 100%; background: var(--text-muted);"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size: 0.85rem;">
                            <span>Inversión Marketing Total</span><b>$${metrics.inversionTotal.toLocaleString()}</b>
                        </div>
                        <div style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${(metrics.inversionTotal / metrics.gastosTotales * 100) || 0}%; height: 100%; background: var(--primary);"></div>
                        </div>
                    </div>
                    <div style="flex: 1; background: rgba(16,185,129,0.05); border-radius: 1rem; padding: 1.5rem; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Utilidad Neta</span>
                        <div style="font-size: 2rem; font-weight: 800; color: var(--accent-green); margin: 0.5rem 0;">$${metrics.utilidad.toLocaleString()}</div>
                        <span style="font-size: 0.85rem; font-weight: 600;">Margen: ${((metrics.utilidad / (metrics.ventaTotal || 1)) * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderConfig(client) {
        const study = DataManager.getStudy();
        document.getElementById('content-area').innerHTML = `
            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="card-premium">
                    <div class="section-header"><h3>Identidad del Cliente</h3></div>
                    <div class="input-group"><label>Costos Operativos Fijos ($)</label><input type="number" id="c-costos" class="premium-input" value="${client.config.costos}"></div>
                    <div class="input-group" style="margin-top: 1rem;"><label>Inversión KWIQ ($)</label><input type="number" id="c-fee" class="premium-input" value="${client.config.inversion}"></div>
                    <div class="input-group" style="margin-top: 1rem;"><label>LeadConnector ($)</label><input type="number" id="c-lc" class="premium-input" value="${client.config.lc}"></div>
                    <button onclick="App.saveClientConfig()" class="btn-premium" style="margin-top: 1.5rem;">Actualizar Identidad</button>
                    
                    <div class="section-header" style="margin-top: 2.5rem;"><h3>Vision AI & Soportes</h3></div>
                    <div class="ocr-zone" onclick="document.getElementById('m-upload').click()">
                        <ion-icon name="scan-outline"></ion-icon>
                        <p>Analizar Captura de Meta/Ventas</p>
                        <input type="file" id="m-upload" accept="image/*" onchange="App.handleOCR(event)" style="display:none">
                    </div>
                </div>

                <div class="card-premium">
                    <div class="section-header"><h3>Carga de Datos: ${state.context.activePeriod}</h3></div>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">Métricas para el estudio del periodo actual.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="input-group"><label>Venta Total ($)</label><input type="number" onchange="App.updateStudyField('ventas', 'ventaTotal', this.value)" class="premium-input" value="${study.ventas.ventaTotal}"></div>
                        <div class="input-group"><label>Inversión Ads ($)</label><input type="number" onchange="App.updateStudyField('marketing', 'adSpend', this.value)" class="premium-input" value="${study.marketing.adSpend}"></div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="input-group"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing', 'alcance', this.value)" class="premium-input" value="${study.marketing.alcance}"></div>
                        <div class="input-group"><label>Resultados (Leads)</label><input type="number" onchange="App.updateStudyField('marketing', 'resultados', this.value)" class="premium-input" value="${study.marketing.resultados}"></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="input-group"><label>Agendadas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAgendadas', this.value)" class="premium-input" value="${study.operacion.citasAgendadas}"></div>
                        <div class="input-group"><label>Atendidas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAtendidas', this.value)" class="premium-input" value="${study.operacion.citasAtendidas}"></div>
                        <div class="input-group"><label>Procs</label><input type="number" onchange="App.updateStudyField('operacion', 'procedimientos', this.value)" class="premium-input" value="${study.operacion.procedimientos}"></div>
                    </div>
                    
                    <div class="input-group" style="margin-top: 1rem;"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing', 'impresiones', this.value)" class="premium-input" value="${study.marketing.impresiones}"></div>
                </div>
            </div>
        `;
    },

    statCard(title, val, prevVal, prefix = '', invert = false, suffix = '') {
        const diff = val - prevVal;
        let pct = prevVal !== 0 ? ((diff / prevVal) * 100).toFixed(0) : (val > 0 ? 100 : 0);
        const color = (pct >= 0 !== invert) ? 'trend-up' : 'trend-down';
        return `
            <div class="card">
                <div class="card-title">
                    <span>${title}</span>
                    <span class="${color}" style="font-weight:700; font-size:0.75rem;">${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%</span>
                </div>
                <div class="card-value">${prefix}${val.toLocaleString()}${suffix}</div>
            </div>
        `;
    }
};

// --- 6. MAIN APPLICATION CONTROLLER ---
const App = {
    init() {
        PersistenceManager.load();
        UIManager.showSection('dashboard');
    },
    setClient(name) {
        if (name === '+ NEW') {
            const newName = prompt("Nombre del nuevo cliente:");
            if (newName) {
                state.clients[newName] = { config: { costos: 0, inversion: 0, lc: 0 }, estudios: {} };
                state.context.activeClient = newName;
            }
        } else {
            state.context.activeClient = name;
        }
        PersistenceManager.save();
        UIManager.showSection(state.currentSection);
    },
    setPeriod(val) {
        state.context.activePeriod = val;
        PersistenceManager.save();
        UIManager.showSection(state.currentSection);
    },
    updateStudyField(module, field, val) {
        const study = DataManager.getStudy();
        study[module][field] = parseFloat(val) || 0;
        PersistenceManager.save();
        UIManager.showSection(state.currentSection);
    },
    saveClientConfig() {
        const c = DataManager.getClient();
        c.config.costos = parseFloat(document.getElementById('c-costos').value) || 0;
        c.config.inversion = parseFloat(document.getElementById('c-fee').value) || 0;
        c.config.lc = parseFloat(document.getElementById('c-lc').value) || 0;
        PersistenceManager.save();
        alert("Identidad del cliente actualizada.");
        UIManager.showSection('dashboard');
    },
    async handleOCR(event) {
        const file = event.target.files[0]; if (!file) return;
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'spa+eng');
            const clean = text.replace(/([0-9])\s*([.,])\s*([0-9])/g, '$1$2$3');
            const regex = /([\d,.]+)/g;
            let match, nums = [];
            while ((match = regex.exec(clean)) !== null) {
                let val = parseFloat(match[1].replace(/[,.](?=\d{3})/g, '').replace(',', '.'));
                if (!isNaN(val)) nums.push(val);
            }
            alert(`Vision AI detectó ${nums.length} números. Úsalos como referencia para la carga manual.`);
        } catch (e) { console.error(e); }
    }
};

window.onload = () => App.init();
window.showSection = (id) => UIManager.showSection(id);
// Bridge for context selectors injected in HTML
window.App = App;
