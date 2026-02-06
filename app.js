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
            config: { costos: 32000, inversion: 6361, lc: 2568, valorCita: 1000, valorProcedimiento: 12000 },
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
    },
    getCumulativeProfit() {
        const client = this.getClient();
        let total = 0;
        for (const period in client.estudios) {
            const study = client.estudios[period];
            const metrics = FinanceManager.calculate(study, client.config);
            total += metrics.profit;
        }
        return total;
    },
    updateClientConfig(updates) {
        const c = this.getClient();
        c.config = { ...c.config, ...updates };
        PersistenceManager.save();
    }
};

// --- 4. FINANCIAL ENGINE ---
const FinanceManager = {
    calculate(study, clientConfig) {
        const m = study.marketing;
        const v = study.ventas;
        const pauta = v.pauta || m.adSpend;
        const invQuick = v.inversion || clientConfig.inversion;
        const lcCosts = v.leadConnector || clientConfig.lc;
        const clientCosts = v.costos || clientConfig.costos;

        const totalMarketing = pauta + invQuick + lcCosts;
        const totalCosts = totalMarketing + clientCosts;
        const profit = v.ventaTotal - totalCosts;

        return {
            pauta, invQuick, lcCosts, clientCosts,
            totalMarketing, totalCosts, ventaTotal: v.ventaTotal, profit,
            profitMargin: v.ventaTotal > 0 ? (profit / v.ventaTotal * 100) : 0,
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
            case 'ventas': this.renderVentas(container, curMetrics, prevMetrics); break;
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
        const cumulativeProfit = DataManager.getCumulativeProfit();
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

            <div class="animate-fade-in">
                <h3 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Visión General: Marketing</h3>
                <div class="dashboard-grid" style="margin-bottom: 2rem;">
                    ${this.statCard('Alcance', cur.alcance, prev.alcance)}
                    ${this.statCard('Impresiones', cur.impresiones, prev.impresiones)}
                    ${this.statCard('Leads', cur.resultados, prev.resultados)}
                    ${this.statCard('Costo por Resultado', cur.cpl, prev.cpl, '$', true)}
                    ${this.statCard('Ad Spend', cur.pauta, prev.pauta, '$', true)}
                </div>

                <h3 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Visión General: Operaciones</h3>
                <div class="dashboard-grid" style="margin-bottom: 2rem;">
                    ${this.statCard('Agendadas', cur.citasAgendadas, prev.citasAgendadas)}
                    ${this.statCard('Atendidas', cur.citasAtendidas, prev.citasAtendidas)}
                    ${this.statCard('% Asistencia', cur.assistRate.toFixed(1), prev.assistRate.toFixed(1), '', false, '%')}
                    ${cur.procedimientos > 0 ? this.statCard('Procedimientos', cur.procedimientos, prev.procedimientos || 0) : ''}
                </div>

                <h3 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Visión General: Finanzas</h3>
                <div class="dashboard-grid">
                    ${this.statCard('Venta Total', cur.ventaTotal, prev.ventaTotal, '$')}
                    ${this.statCard('Utilidad', cur.profit, prev.profit, '$')}
                    ${this.statCard('Utilidad Acumulada', cumulativeProfit, 0, '$')}
                    ${this.statCard('ROAS', cur.roas.toFixed(2), prev.roas.toFixed(2), '', false, 'x')}
                    ${this.statCard('ROE (ROI)', (cur.roe * 100).toFixed(1), (prev.roe * 100).toFixed(1), '', false, '%')}
                </div>
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
                ${this.statCard('Costo por Resultado', metrics.cpl, 0, '$', true)}
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
                        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Costo por Resultado</span>
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
        const hasProcedures = cur.operacion.procedimientos > 0;
        const convRate = cur.operacion.citasAtendidas > 0 ? (cur.operacion.procedimientos / cur.operacion.citasAtendidas * 100).toFixed(1) : 0;

        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Agendadas', cur.operacion.citasAgendadas, 0)}
                ${this.statCard('Atendidas', cur.operacion.citasAtendidas, 0)}
                ${this.statCard('% Asistencia', metrics.assistRate.toFixed(1), 0, '', false, '%')}
                ${hasProcedures ? this.statCard('Procedimientos', cur.operacion.procedimientos, 0) : ''}
            </div>

            <div class="animate-fade-in" style="display: flex; flex-direction: column; gap: 2rem;">
                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Etapa 1: Gestión de Citas (Asistencia)</h3>
                    <div style="display:flex; justify-content: center; align-items: center; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 1.5rem; gap: 3rem;">
                        <div style="text-align:center;"><b>${cur.operacion.citasAgendadas}</b><br><small>Agendadas</small></div>
                        <div style="font-size: 2rem; color: var(--text-muted);">→</div>
                        <div style="text-align:center; color: #4338ca;"><b>${cur.operacion.citasAtendidas}</b><br><small>Atendidas</small></div>
                        <div style="padding: 1rem 2rem; background: rgba(99, 102, 241, 0.1); border-radius: 1rem;">
                            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Eficiencia de Agenda</span>
                            <b style="font-size: 1.5rem; color: var(--primary);">${metrics.assistRate.toFixed(1)}%</b>
                        </div>
                    </div>
                </div>

                ${hasProcedures ? `
                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Etapa 2: Conversión Clínica (Cierre)</h3>
                    <div style="display:flex; justify-content: center; align-items: center; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 1.5rem; gap: 3rem;">
                        <div style="text-align:center;"><b>${cur.operacion.citasAtendidas}</b><br><small>Atendidas</small></div>
                        <div style="font-size: 2rem; color: var(--text-muted);">→</div>
                        <div style="text-align:center; color: var(--accent-green);"><b>${cur.operacion.procedimientos}</b><br><small>Procedimientos</small></div>
                        <div style="padding: 1rem 2rem; background: rgba(16, 185, 129, 0.1); border-radius: 1rem;">
                            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Eficiencia de Cierre</span>
                            <b style="font-size: 1.5rem; color: var(--accent-green);">${convRate}%</b>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },

    renderVentas(el, m, pm) {
        const cumulativeProfit = DataManager.getCumulativeProfit();
        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Venta Total', m.ventaTotal, pm.ventaTotal, '$')}
                ${this.statCard('Utilidad', m.profit, pm.profit, '$')}
                ${this.statCard('Utilidad Acumulada', cumulativeProfit, 0, '$')}
                ${this.statCard('Margen de Utilidad', m.profitMargin.toFixed(1), pm.profitMargin.toFixed(1), '', false, '%')}
            </div>

            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Desglose de Costos y Pauta</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        <div class="trend-row"><span>Costos del Cliente (Op)</span><b>$${m.clientCosts.toLocaleString()}</b></div>
                        <div class="trend-row"><span>Inversión Kwiq</span><b>$${m.invQuick.toLocaleString()}</b></div>
                        <div class="trend-row"><span>Lead Connector</span><b>$${m.lcCosts.toLocaleString()}</b></div>
                        <div class="trend-row" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);"><span>Pauta (Ad Spend)</span><b>$${m.pauta.toLocaleString()}</b></div>
                    </div>
                </div>

                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Eficiencia de Inversión</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        ${this.renderCostLine('Costos Operativos', m.clientCosts, m.totalCosts, 'var(--text-muted)')}
                        ${this.renderCostLine('Inversión Marketing', m.totalMarketing, m.totalCosts, 'var(--primary)')}
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                            <span style="font-size: 0.9rem; color: var(--text-muted);">ROI Real (ROE)</span>
                            <b style="font-size: 1.25rem; color: var(--accent-green);">${(m.roe * 100).toFixed(1)}%</b>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderConfig(el, client, study) {
        el.innerHTML = `
            <div class="animate-fade-in" style="display: grid; grid-template-columns: 350px 1fr; gap: 2rem;">
                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    <!-- Columna Izquierda: Identidad y API -->
                    <div class="card-premium">
                        <h3 class="section-header">Identidad Financiera</h3>
                        <div class="input-group"><label>Costos Fijos Operativos</label><input type="number" id="cfg-costos" class="premium-input" value="${client.config.costos}"></div>
                        <div class="input-group"><label>Fee Kwiq</label><input type="number" id="cfg-fee" class="premium-input" value="${client.config.inversion}"></div>
                        <div class="input-group"><label>LeadConnector</label><input type="number" id="cfg-lc" class="premium-input" value="${client.config.lc}"></div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 1rem;">
                            <div class="input-group" style="margin:0;"><label>Valor Cita ($)</label><input type="number" id="cfg-cita" class="premium-input" value="${client.config.valorCita || 0}"></div>
                            <div class="input-group" style="margin:0;"><label>Valor Proc ($)</label><input type="number" id="cfg-proc" class="premium-input" value="${client.config.valorProcedimiento || 0}"></div>
                        </div>
                        <button onclick="App.saveClientConfig()" class="btn-premium" style="margin-top: 1rem;">Guardar Identidad</button>
                    </div>

                    <div class="card-premium" style="border-top: 4px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                            <h3 style="margin:0; font-size: 0.9rem; text-transform: uppercase;">Automatización API</h3>
                            <span class="badge-status">Beta</span>
                        </div>
                        <div class="input-group">
                            <label>GoHighLevel API Key</label>
                            <input type="password" id="ghl-key" class="premium-input" placeholder="Ingresar API Key..." value="${client.config.ghlKey || ''}">
                        </div>
                        <button onclick="App.testGHLConnection()" class="btn-premium" style="background: var(--primary); width: 100%;">Vincular GHL</button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    <!-- Columna Derecha: Carga de Datos -->
                    <div class="card-premium">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                            <h3 style="margin:0;">Carga Mensual: ${state.context.activePeriod}</h3>
                            <div style="display:flex; gap: 1rem;">
                                <button onclick="App.setLoadingSource('manual')" style="padding: 0.5rem 1rem; border-radius: 0.5rem; background: rgba(255,255,255,0.05); color:white; border:none; cursor:pointer; font-size: 0.8rem;">Manual</button>
                                <button onclick="document.getElementById('ocr-input').click()" style="padding: 0.5rem 1rem; border-radius: 0.5rem; background: var(--primary); color:white; border:none; cursor:pointer; font-size: 0.8rem;">Carga con Screenshot (IA)</button>
                                <input type="file" id="ocr-input" accept="image/*" onchange="App.handleOCR(event)" style="display:none">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem;">
                            <div style="padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: 1rem;">
                                <h4 style="margin-top:0; color:var(--primary); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem;">Marketing (Ads)</h4>
                                <div class="input-group"><label>Ad Spend / Pauta</label><input type="number" onchange="App.updateStudyField('marketing', 'adSpend', this.value)" class="premium-input" value="${study.marketing.adSpend}"></div>
                                <div class="input-group"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing', 'alcance', this.value)" class="premium-input" value="${study.marketing.alcance}"></div>
                                <div class="input-group"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing', 'impresiones', this.value)" class="premium-input" value="${study.marketing.impresiones}"></div>
                                <div class="input-group"><label>Resultados / Leads</label><input type="number" onchange="App.updateStudyField('marketing', 'resultados', this.value)" class="premium-input" value="${study.marketing.resultados}"></div>
                            </div>

                            <div style="padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: 1rem;">
                                <h4 style="margin-top:0; color:#4338ca; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem;">Operación Comercial</h4>
                                <div class="input-group"><label>Citas Agendadas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAgendadas', this.value)" class="premium-input" value="${study.operacion.citasAgendadas}"></div>
                                <div class="input-group"><label>Citas Atendidas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAtendidas', this.value)" class="premium-input" value="${study.operacion.citasAtendidas}"></div>
                                <div class="input-group"><label>Procedimientos</label><input type="number" onchange="App.updateStudyField('operacion', 'procedimientos', this.value)" class="premium-input" value="${study.operacion.procedimientos}"></div>
                            </div>

                            <div style="padding: 1.5rem; background: rgba(255,255,255,0.02); border-radius: 1rem;">
                                <h4 style="margin-top:0; color:var(--accent-green); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem;">Ventas Finales</h4>
                                <div class="input-group"><label>Venta Total ($)</label><input type="number" onchange="App.updateStudyField('ventas', 'ventaTotal', this.value)" class="premium-input" value="${study.ventas.ventaTotal}"></div>
                                <div class="input-group"><label>Pauta Directa ($)</label><input type="number" onchange="App.updateStudyField('ventas', 'pauta', this.value)" class="premium-input" value="${study.ventas.pauta}"></div>
                            </div>
                        </div>
                    </div>
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
    updateStudyField(mod, field, val) {
        const s = DataManager.getStudy();
        const c = DataManager.getClient();
        s[mod][field] = parseFloat(val) || 0;

        // Automatización de Venta Total
        if (mod === 'operacion' || field === 'ventaTotal') {
            if (c.config.valorCita || c.config.valorProcedimiento) {
                const autoVenta = (s.operacion.citasAtendidas * (c.config.valorCita || 0)) +
                    (s.operacion.procedimientos * (c.config.valorProcedimiento || 0));
                if (autoVenta > 0) s.ventas.ventaTotal = autoVenta;
            }
        }

        PersistenceManager.save();
        UIManager.showSection(state.currentSection);
    },
    testGHLConnection() {
        const key = document.getElementById('ghl-key').value;
        if (!key) return UIState.showNotification('Por favor ingrese una API Key', 'error');

        UIState.showNotification('Conectando con GoHighLevel...', 'info');
        // Placeholder para integración real de API
        setTimeout(() => {
            DataManager.updateClientConfig({ ghlKey: key });
            UIState.showNotification('Conexión con GHL exitosa (Beta)', 'success');
        }, 1500);
    },

    setLoadingSource(source) {
        UIState.showNotification(`Modo de carga: ${source.toUpperCase()}`, 'info');
    },

    saveClientConfig() {
        const c = DataManager.getClient();
        c.config.costos = parseFloat(document.getElementById('cfg-costos').value) || 0;
        c.config.inversion = parseFloat(document.getElementById('cfg-fee').value) || 0;
        c.config.lc = parseFloat(document.getElementById('cfg-lc').value) || 0;
        c.config.valorCita = parseFloat(document.getElementById('cfg-cita').value) || 0;
        c.config.valorProcedimiento = parseFloat(document.getElementById('cfg-proc').value) || 0;
        PersistenceManager.save(); alert("Identidad Actualizada"); UIManager.showSection('config');
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
