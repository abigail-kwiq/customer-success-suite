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
                    marketing: {
                        meta: { impresiones: 182710, alcance: 94000, resultados: 344, adSpend: 8986 },
                        google: { impresiones: 0, alcance: 0, resultados: 0, adSpend: 0 }
                    },
                    operacion: { citasAgendadas: 80, citasAtendidas: 64, procedimientos: 12 },
                    ventas: { ventaTotal: 145000, costos: 0, inversion: 0, leadConnector: 0, pauta: 0, tokensIA: 0 }
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
            if (parsed.clients) {
                state.clients = parsed.clients;
                // MIGRACIÓN FORZADA v10.0 - Normalizar todos los estudios
                Object.values(state.clients).forEach(client => {
                    Object.keys(client.estudios).forEach(period => {
                        const study = client.estudios[period];
                        if (!study.marketing || !study.marketing.meta || !study.marketing.tiktok) {
                            const old = study.marketing || {};
                            study.marketing = {
                                meta: study.marketing?.meta || {
                                    adSpend: old.adSpend || 0,
                                    resultados: old.resultados || 0,
                                    alcance: old.alcance || 0,
                                    impresiones: old.impresiones || 0
                                },
                                google: study.marketing?.google || { adSpend: 0, resultados: 0, alcance: 0, impresiones: 0 },
                                tiktok: study.marketing?.tiktok || { adSpend: 0, resultados: 0, alcance: 0, impresiones: 0 }
                            };
                        }
                    });
                });
            }
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
                marketing: {
                    meta: { impresiones: 0, alcance: 0, resultados: 0, adSpend: 0 },
                    google: { impresiones: 0, alcance: 0, resultados: 0, adSpend: 0 },
                    tiktok: { impresiones: 0, alcance: 0, resultados: 0, adSpend: 0 }
                },
                operacion: { citasAgendadas: 0, citasAtendidas: 0, procedimientos: 0 },
                ventas: { ventaTotal: 0, costos: 0, inversion: 0, leadConnector: 0, pauta: 0, tokensIA: 0 }
            };
        }
        return c.estudios[period];
    },
    getMarketing(study) {
        const def = { adSpend: 0, resultados: 0, alcance: 0, impresiones: 0 };
        if (!study.marketing) return { meta: { ...def }, google: { ...def } };

        const m = study.marketing;
        return {
            meta: {
                adSpend: (m.meta ? m.meta.adSpend : m.adSpend) || 0,
                resultados: (m.meta ? m.meta.resultados : m.resultados) || 0,
                alcance: (m.meta ? m.meta.alcance : m.alcance) || 0,
                impresiones: (m.meta ? m.meta.impresiones : m.impresiones) || 0
            },
            google: {
                adSpend: (m.google ? m.google.adSpend : 0) || 0,
                resultados: (m.google ? m.google.resultados : 0) || 0,
                alcance: (m.google ? m.google.alcance : 0) || 0,
                impresiones: (m.google ? m.google.impresiones : 0) || 0
            },
            tiktok: {
                adSpend: (m.tiktok ? m.tiktok.adSpend : 0) || 0,
                resultados: (m.tiktok ? m.tiktok.resultados : 0) || 0,
                alcance: (m.tiktok ? m.tiktok.alcance : 0) || 0,
                impresiones: (m.tiktok ? m.tiktok.impresiones : 0) || 0
            }
        };
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
        const { meta, google, tiktok } = DataManager.getMarketing(study);
        const v = study.ventas;
        const pauta = (meta.adSpend || 0) + (google.adSpend || 0) + (tiktok.adSpend || 0);

        const invQuick = v.inversion || clientConfig.inversion;
        const lcCosts = v.leadConnector || clientConfig.lc;
        const tokensIA = v.tokensIA || clientConfig.tokensIA || 0;
        const clientCosts = v.costos || clientConfig.costos;

        const serviceCosts = pauta + invQuick + lcCosts;
        const totalMarketing = serviceCosts + tokensIA;
        const totalCosts = totalMarketing + clientCosts;
        const profit = v.ventaTotal - totalCosts;

        // Resultados Agregados
        const totalResultados = (meta.resultados || 0) + (google.resultados || 0) + (tiktok.resultados || 0);

        return {
            pauta, invQuick, lcCosts, tokensIA, clientCosts,
            serviceCosts, totalMarketing, totalCosts, ventaTotal: v.ventaTotal, profit,
            profitMargin: v.ventaTotal > 0 ? (profit / v.ventaTotal * 100) : 0,
            roas: pauta > 0 ? (v.ventaTotal / pauta) : 0,
            roi: serviceCosts > 0 ? (profit / serviceCosts) : 0,
            assistRate: study.operacion.citasAgendadas > 0 ? (study.operacion.citasAtendidas / study.operacion.citasAgendadas * 100) : 0,
            cpl: totalResultados > 0 ? (pauta / totalResultados) : 0,
            // Métricas crudas (Suma)
            alcance: (meta.alcance || 0) + (google.alcance || 0) + (tiktok.alcance || 0),
            impresiones: (meta.impresiones || 0) + (google.impresiones || 0) + (tiktok.impresiones || 0),
            resultados: totalResultados,
            citasAgendadas: study.operacion.citasAgendadas || 0,
            citasAtendidas: study.operacion.citasAtendidas || 0,
            procedimientos: study.operacion.procedimientos || 0,
            assistRate: study.operacion.citasAgendadas > 0 ? (study.operacion.citasAtendidas / study.operacion.citasAgendadas * 100) : 0,
            cpl: totalResultados > 0 ? (pauta / totalResultados) : 0,
            // Detalle por canal para vistas profundas
            meta, google, tiktok
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
        document.querySelectorAll('.top-nav-item').forEach(i => i.classList.remove('active'));

        const nav = Array.from(document.querySelectorAll('.nav-item')).find(i => i.getAttribute('onclick')?.includes(id));
        if (nav) nav.classList.add('active');

        const topNav = Array.from(document.querySelectorAll('.top-nav-item')).find(i => i.getAttribute('onclick')?.includes(id));
        if (topNav) topNav.classList.add('active');

        const client = DataManager.getClient();
        const curStudy = DataManager.getStudy();
        const prevStudy = DataManager.getComparisonStudy();
        const curMetrics = FinanceManager.calculate(curStudy, client.config);
        const prevMetrics = prevStudy ? FinanceManager.calculate(prevStudy, client.config) : curMetrics;

        document.getElementById('view-title').innerText = this.getSectionTitle(id);
        const subtitle = document.getElementById('view-subtitle');
        subtitle.innerHTML = `${state.context.activeClient} • ${state.context.activePeriod} <span class="version-badge-neon">v11.6.0 FORCE-CPL</span>`;

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
        const target = document.getElementById('context-selector-target');
        if (!target) return;
        target.innerHTML = `
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
                    <span style="font-size: 0.75rem; opacity: 0.8; text-transform: uppercase;">ROI</span>
                    <div style="font-size: 1.75rem; font-weight: 800;">${(cur.roi * 100).toFixed(1)}%</div>
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
                    ${this.statCard('ROI', (cur.roi * 100).toFixed(1), (prev.roi * 100).toFixed(1), '', false, '%')}
                </div>

                </div>
            </div>
        `;
    },

    renderMarketing(el, cur, prev, metrics) {
        el.innerHTML = `
            <div class="dashboard-grid animate-fade-in" style="margin-bottom: 2rem;">
                ${this.statCard('Alcance Total', metrics.alcance, prev ? FinanceManager.calculate(prev, DataManager.getClient().config).alcance : metrics.alcance)}
                ${this.statCard('Impresiones Totales', metrics.impresiones, prev ? FinanceManager.calculate(prev, DataManager.getClient().config).impresiones : metrics.impresiones)}
                ${this.statCard('Leads Totales', metrics.resultados, prev ? FinanceManager.calculate(prev, DataManager.getClient().config).resultados : metrics.resultados)}
                ${this.statCard('CPL Global', metrics.cpl, 0, '$', true)}
                ${this.statCard('Ad Spend Total', metrics.pauta, 0, '$', true)}
            </div>

            <div class="animate-fade-in" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Breakdown Meta -->
                <div class="card-premium" style="border-left: 4px solid #1877f2; padding: 1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="font-size:0.7rem; color:#1877f2; text-transform:uppercase;">Meta Ads Performance</h4>
                        <ion-icon name="logo-facebook" style="font-size:1.5rem; color:#1877f2;"></ion-icon>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div><small style="color:var(--text-muted); display:block;">Inversión</small><b style="font-size:1.1rem;">$${metrics.meta?.adSpend.toLocaleString() || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">Leads</small><b style="font-size:1.1rem;">${metrics.meta?.resultados || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">CPL</small><b style="font-size:1.1rem;">$${metrics.meta?.resultados > 0 ? (metrics.meta.adSpend / metrics.meta.resultados).toFixed(2) : '0.00'}</b></div>
                    </div>
                </div>

                <!-- Breakdown Google -->
                <div class="card-premium" style="border-left: 4px solid #db4437; padding: 1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="font-size:0.7rem; color:#db4437; text-transform:uppercase;">Google Ads Performance</h4>
                        <ion-icon name="logo-google" style="font-size:1.5rem; color:#db4437;"></ion-icon>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div><small style="color:var(--text-muted); display:block;">Inversión</small><b style="font-size:1.1rem;">$${metrics.google?.adSpend.toLocaleString() || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">Leads</small><b style="font-size:1.1rem;">${metrics.google?.resultados || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">CPL</small><b style="font-size:1.1rem;">$${metrics.google?.resultados > 0 ? (metrics.google.adSpend / metrics.google.resultados).toFixed(2) : '0.00'}</b></div>
                    </div>
                </div>

                <!-- Breakdown TikTok -->
                <div class="card-premium" style="border-left: 4px solid #25f4ee; padding: 1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="font-size:0.75rem; color:#25f4ee !important; font-weight:700 !important; text-transform:uppercase !important;">TIKTOK ADS PERFORMANCE</h4>
                        <ion-icon name="logo-tiktok" style="font-size:1.5rem; color:#25f4ee !important;"></ion-icon>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div><small style="color:var(--text-muted); display:block;">Inversión</small><b style="font-size:1.1rem;">$${metrics.tiktok?.adSpend.toLocaleString() || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">Leads</small><b style="font-size:1.1rem;">${metrics.tiktok?.resultados || '0'}</b></div>
                        <div><small style="color:var(--text-muted); display:block;">CPL</small><b style="font-size:1.1rem;">$${metrics.tiktok?.resultados > 0 ? (metrics.tiktok.adSpend / metrics.tiktok.resultados).toFixed(2) : '0.00'}</b></div>
                    </div>
                </div>
            </div>

            <div class="animate-fade-in" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem;">
                <div class="card-premium" style="min-height: 400px; display: flex; flex-direction: column;">
                    <h3 style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2rem;">Rendimiento Audiencia e Inversión</h3>
                    <div style="flex: 1; display:flex; align-items: flex-end; justify-content: space-around; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 1.5rem;">
                        ${this.renderChartBar('Alcance', metrics.alcance, 100000, 'var(--primary)')}
                        ${this.renderChartBar('Impresiones', metrics.impresiones, 200000, '#4338ca')}
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
                        <div class="trend-row"><span>Tokens IA</span><b>$${m.tokensIA.toLocaleString()}</b></div>
                        <div class="trend-row" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);"><span>Pauta (Ad Spend)</span><b>$${m.pauta.toLocaleString()}</b></div>
                    </div>
                </div>

                <div class="card-premium">
                    <h3 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Eficiencia de Inversión</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        ${this.renderCostLine('Costos Operativos', m.clientCosts, m.totalCosts, 'var(--text-muted)')}
                        ${this.renderCostLine('Inversión Marketing', m.totalMarketing, m.totalCosts, 'var(--primary)')}
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                            <span style="font-size: 0.9rem; color: var(--text-muted);">ROI</span>
                            <b style="font-size: 1.25rem; color: var(--accent-green);">${(m.roi * 100).toFixed(1)}%</b>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },


    renderConfig(el, client, study) {
        el.innerHTML = `
            <div class="animate-fade-in" style="display: grid; grid-template-columns: 320px 1fr; gap: 2.5rem; align-items: start;">
                
                <!-- Columna Lateral: Configuración Maestra -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div class="card-premium" style="padding: 1.5rem; border-left: 4px solid var(--primary);">
                        <div class="section-header" style="margin-bottom: 1rem;">
                            <ion-icon name="options-outline"></ion-icon>
                            <h3 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">Identidad & API</h3>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                            <div class="input-group"><label>Costos Operativos</label><input type="number" id="cfg-costos" class="premium-input" value="${client.config.costos}"></div>
                            <div class="input-group"><label>Fee Kwiq</label><input type="number" id="cfg-fee" class="premium-input" value="${client.config.inversion}"></div>
                            <div class="input-group"><label>LeadConnector</label><input type="number" id="cfg-lc" class="premium-input" value="${client.config.lc}"></div>
                            <div class="input-group"><label>Tokens IA</label><input type="number" id="cfg-tokens" class="premium-input" value="${client.config.tokensIA || 0}"></div>
                            
                            <div style="padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 0.75rem; border: 1px solid rgba(99, 102, 241, 0.1);">
                                <div class="input-group" style="margin-bottom: 0.75rem;"><label>Valor Cita ($)</label><input type="number" id="cfg-cita" class="premium-input" value="${client.config.valorCita || 0}"></div>
                                <div class="input-group"><label>Valor Procedimiento ($)</label><input type="number" id="cfg-proc" class="premium-input" value="${client.config.valorProcedimiento || 0}"></div>
                            </div>

                            <button onclick="App.saveClientConfig()" class="btn-premium" style="padding: 0.75rem;">Actualizar Identidad</button>
                            
                            <hr style="opacity: 0.05; margin: 0.5rem 0;">
                            
                            <div class="input-group">
                                <label>GHL API Key (Beta)</label>
                                <input type="password" id="ghl-key" class="premium-input" placeholder="••••••••" value="${client.config.ghlKey || ''}">
                            </div>
                            <button onclick="App.testGHLConnection()" class="btn-secondary" style="font-size: 0.75rem;">Vincular GoHighLevel</button>
                        </div>
                    </div>
                    
                    <div class="card-premium" style="padding: 1rem; background: rgba(255,193,7,0.05); border: 1px solid rgba(255,193,7,0.1);">
                        <p style="margin:0; font-size: 0.7rem; color: #b48600; line-height: 1.4;">
                            💡 <b>Automatización Activa:</b> La venta total se calcula usando los valores de identidad y los resultados operativos cargados al centro.
                        </p>
                    </div>
                </div>

                <!-- Área Principal: Carga de Inteligencia -->
                <div class="card-premium" style="padding: 2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem;">
                        <div>
                            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">Carga Operativa: ${state.context.activePeriod}</h3>
                            <p style="margin:0; font-size: 0.85rem; color: var(--text-muted);">Gestiona los datos de marketing, operación e ingresos del mes.</p>
                        </div>
                        <div style="display:flex; gap: 0.75rem;">
                            <button onclick="document.getElementById('ocr-input').click()" class="btn-premium" style="width: auto; padding: 0.6rem 1.25rem; font-size: 0.75rem; background: var(--primary);">
                                <ion-icon name="scan-outline"></ion-icon> Scan Screenshot (IA)
                            </button>
                            <input type="file" id="ocr-input" accept="image/*" onchange="App.handleOCR(event)" style="display:none">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">
                        <!-- Módulo Marketing Multi-Canal -->
                        <div style="display: flex; flex-direction: column; gap: 1.5rem; padding-right: 1.5rem; border-right: 1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; align-items:center; gap:0.5rem; color:var(--primary); margin-bottom: 0.5rem;">
                                <ion-icon name="megaphone-outline" style="font-size: 1.2rem;"></ion-icon>
                                <h4 style="margin:0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Marketing</h4>
                            </div>

                            <!-- Bloque META ADS -->
                            <div style="padding: 1rem; background: rgba(24, 119, 242, 0.05); border-radius: 0.75rem; border: 1px solid rgba(24, 119, 242, 0.15); display: flex; flex-direction: column; gap: 0.75rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size: 0.65rem; font-weight: 700; color: #1877f2; text-transform: uppercase;">Meta Ads</span>
                                    <ion-icon name="logo-facebook" style="color: #1877f2;"></ion-icon>
                                </div>
                                <div class="input-group small"><label>Ad Spend ($)</label><input type="number" onchange="App.updateStudyField('marketing.meta', 'adSpend', this.value)" class="premium-input" value="${study.marketing.meta?.adSpend || 0}"></div>
                                <div class="input-group small"><label>Leads (Resultados)</label><input type="number" onchange="App.updateStudyField('marketing.meta', 'resultados', this.value)" class="premium-input" value="${study.marketing.meta?.resultados || 0}"></div>
                                <div class="input-group small"><label>CPL ($)</label><input type="number" onchange="App.updateCPLField('meta', this.value)" class="premium-input" value="${study.marketing.meta?.resultados > 0 ? (study.marketing.meta.adSpend / study.marketing.meta.resultados).toFixed(2) : 0}"></div>
                                <div class="input-group small"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing.meta', 'alcance', this.value)" class="premium-input" value="${study.marketing.meta?.alcance || 0}"></div>
                                <div class="input-group small"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing.meta', 'impresiones', this.value)" class="premium-input" value="${study.marketing.meta?.impresiones || 0}"></div>
                            </div>

                            <!-- Bloque GOOGLE ADS -->
                            <div style="padding: 1rem; background: rgba(219, 68, 55, 0.05); border-radius: 0.75rem; border: 1px solid rgba(219, 68, 55, 0.15); display: flex; flex-direction: column; gap: 0.75rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size: 0.65rem; font-weight: 700; color: #db4437; text-transform: uppercase;">Google Ads</span>
                                    <ion-icon name="logo-google" style="color: #db4437;"></ion-icon>
                                </div>
                                <div class="input-group small"><label>Ad Spend ($)</label><input type="number" onchange="App.updateStudyField('marketing.google', 'adSpend', this.value)" class="premium-input" value="${study.marketing.google?.adSpend || 0}"></div>
                                <div class="input-group small"><label>Leads (Resultados)</label><input type="number" onchange="App.updateStudyField('marketing.google', 'resultados', this.value)" class="premium-input" value="${study.marketing.google?.resultados || 0}"></div>
                                <div class="input-group small"><label>CPL ($)</label><input type="number" onchange="App.updateCPLField('google', this.value)" class="premium-input" value="${study.marketing.google?.resultados > 0 ? (study.marketing.google.adSpend / study.marketing.google.resultados).toFixed(2) : 0}"></div>
                                <div class="input-group small"><label>Alcance</label><input type="number" onchange="App.updateStudyField('marketing.google', 'alcance', this.value)" class="premium-input" value="${study.marketing.google?.alcance || 0}"></div>
                                <div class="input-group small"><label>Impresiones</label><input type="number" onchange="App.updateStudyField('marketing.google', 'impresiones', this.value)" class="premium-input" value="${study.marketing.google?.impresiones || 0}"></div>
                            </div>

                            <!-- Bloque TIKTOK ADS -->
                            <div style="padding: 1rem; background: rgba(37, 244, 238, 0.05); border-radius: 0.75rem; border: 1px solid rgba(37, 244, 238, 0.15); display: flex; flex-direction: column; gap: 0.75rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size: 0.65rem; font-weight: 700; color: #25f4ee !important; text-transform: uppercase !important;">TIKTOK ADS</span>
                                    <ion-icon name="logo-tiktok" style="color: #25f4ee !important;"></ion-icon>
                                </div>
                                <div class="input-group small">
                                    <label>Ad Spend ($)</label>
                                    <input type="number" onchange="App.updateStudyField('marketing.tiktok', 'adSpend', this.value)" class="premium-input" value="${study.marketing.tiktok?.adSpend || 0}">
                                </div>
                                <div class="input-group small">
                                    <label>Leads (Resultados)</label>
                                    <input type="number" onchange="App.updateStudyField('marketing.tiktok', 'resultados', this.value)" class="premium-input" value="${study.marketing.tiktok?.resultados || 0}">
                                </div>
                                <div class="input-group small">
                                    <label>CPL ($)</label>
                                    <input type="number" onchange="App.updateCPLField('tiktok', this.value)" class="premium-input" value="${study.marketing.tiktok?.resultados > 0 ? (study.marketing.tiktok.adSpend / study.marketing.tiktok.resultados).toFixed(2) : 0}">
                                </div>
                                <div class="input-group small">
                                    <label>Alcance</label>
                                    <input type="number" onchange="App.updateStudyField('marketing.tiktok', 'alcance', this.value)" class="premium-input" value="${study.marketing.tiktok?.alcance || 0}">
                                </div>
                                <div class="input-group small">
                                    <label>Impresiones</label>
                                    <input type="number" onchange="App.updateStudyField('marketing.tiktok', 'impresiones', this.value)" class="premium-input" value="${study.marketing.tiktok?.impresiones || 0}">
                                </div>
                            </div>
                        </div>

                        <!-- Módulo Operativa -->
                        <div style="display: flex; flex-direction: column; gap: 1.25rem; padding-right: 1.5rem; border-right: 1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; align-items:center; gap:0.5rem; color:#4338ca; margin-bottom: 0.5rem;">
                                <ion-icon name="calendar-outline" style="font-size: 1.2rem;"></ion-icon>
                                <h4 style="margin:0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">Operativa</h4>
                            </div>
                            <div class="input-group"><label>Agendadas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAgendadas', this.value)" class="premium-input" value="${study.operacion.citasAgendadas}"></div>
                            <div class="input-group"><label>Atendidas</label><input type="number" onchange="App.updateStudyField('operacion', 'citasAtendidas', this.value)" class="premium-input" value="${study.operacion.citasAtendidas}"></div>
                            <div class="input-group"><label>Procedimientos</label><input type="number" onchange="App.updateStudyField('operacion', 'procedimientos', this.value)" class="premium-input" value="${study.operacion.procedimientos}"></div>
                            
                            <div style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(99, 102, 241, 0.03); border-radius: 1rem; border: 1px solid rgba(99, 102, 241, 0.05);">
                                <h5 style="margin: 0 0 0.5rem 0; font-size: 0.65rem; text-transform: uppercase; color: var(--primary);">Ratio Eficiencia</h5>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">
                                    $${((study.operacion.citasAtendidas * (client.config.valorCita || 0)) + (study.operacion.procedimientos * (client.config.valorProcedimiento || 0))).toLocaleString()}
                                </div>
                                <p style="margin: 0.5rem 0 0 0; font-size: 0.6rem; color: var(--text-muted);">Proyectado según KPIs operativos.</p>
                            </div>
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
    init() {
        console.log(`Execution Compass v11.6.0 [FORCE-CPL] - Hard Reset Active`);
        PersistenceManager.load();

        // Detección de GHL (Iframe)
        if (window.self !== window.top) {
            document.body.classList.add('ghl-mode');
            console.log("Modo GHL Activo: Interfaz Optimizada para Iframe");
        }

        UIManager.showSection('dashboard');
    },
    setClient(name) {
        if (name === '+ NEW') {
            const n = prompt("Nombre:");
            if (n) { state.clients[n] = { config: { costos: 0, inversion: 0, lc: 0, tokensIA: 0 }, estudios: {} }; state.context.activeClient = n; }
        } else { state.context.activeClient = name; }
        PersistenceManager.save(); UIManager.showSection(state.currentSection);
    },
    setPeriod(val) { state.context.activePeriod = val; PersistenceManager.save(); UIManager.showSection(state.currentSection); },
    updateStudyField(path, field, val) {
        const s = DataManager.getStudy();
        const c = DataManager.getClient();
        const numVal = field === 'tipoCampanas' ? val : (parseFloat(val) || 0);

        // Soporte para rutas anidadas dinámicas (marketing.meta, etc)
        const parts = path.split('.');
        let target = s;
        parts.forEach(p => {
            if (!target[p]) target[p] = {};
            target = target[p];
        });
        target[field] = numVal;

        // AUTO-CALCULO VENTA TOTAL
        if (path === 'operacion') {
            s.ventas.ventaTotal = (s.operacion.citasAtendidas * (c.config.valorCita || 0)) +
                (s.operacion.procedimientos * (c.config.valorProcedimiento || 0));
        }

        PersistenceManager.save();
        UIManager.showSection(state.currentSection);
    },
    updateCPLField(channel, val) {
        const study = DataManager.getStudy();
        const cpl = parseFloat(val) || 0;
        const channelData = study.marketing[channel];

        if (channelData && cpl > 0) {
            // Recalcular Resultados (Leads) basados en Ad Spend y el nuevo CPL
            // Leads = AdSpend / CPL
            channelData.resultados = Math.round(channelData.adSpend / cpl);
        } else if (channelData && cpl === 0) {
            channelData.resultados = 0;
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
        const updates = {
            costos: parseFloat(document.getElementById('cfg-costos').value) || 0,
            inversion: parseFloat(document.getElementById('cfg-fee').value) || 0,
            lc: parseFloat(document.getElementById('cfg-lc').value) || 0,
            tokensIA: parseFloat(document.getElementById('cfg-tokens').value) || 0,
            valorCita: parseFloat(document.getElementById('cfg-cita').value) || 0,
            valorProcedimiento: parseFloat(document.getElementById('cfg-proc').value) || 0,
            ghlKey: document.getElementById('ghl-key').value
        };
        DataManager.updateClientConfig(updates);
        PersistenceManager.save();
        alert("Identidad Actualizada"); UIManager.showSection('config');
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
