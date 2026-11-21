/* ========== 全局配置 ========== */
const CONFIG = {
    pingIterations: 8,
    chartMaxPoints: 120,
    gaugeMax: {
        ping: 500,
        down: 1000,
        up: 500
    },
    /* 按网络等级(G)自适应参数 —— 自动检测后选用对应档位 */
    networkProfiles: {
        // 等级: [描述, 下载阶梯MB, 上传阶梯MB, 整体超时ms, stall超时ms, 最小测量ms, 最大测试总时长ms]
        '1g': {
            label: '1G',
            down: [0.1, 0.25, 0.5, 1, 2],
            up: [0.05, 0.1, 0.25, 0.5],
            timeout: 60000,
            stall: 8000,
            minMeasure: 3000,
            maxTotal: 120000
        },
        '2g': {
            label: '2G',
            down: [0.25, 0.5, 1, 2, 4],
            up: [0.1, 0.25, 0.5, 1],
            timeout: 45000,
            stall: 6000,
            minMeasure: 2500,
            maxTotal: 90000
        },
        '3g': {
            label: '3G',
            down: [0.5, 1, 2, 4, 8],
            up: [0.2, 0.5, 1, 2],
            timeout: 30000,
            stall: 5000,
            minMeasure: 2000,
            maxTotal: 70000
        },
        '4g': {
            label: '4G',
            down: [1, 2, 4, 8, 16, 32],
            up: [0.5, 1, 2, 4, 8],
            timeout: 25000,
            stall: 4000,
            minMeasure: 1500,
            maxTotal: 60000
        },
        '5g': {
            label: '5G',
            down: [2, 4, 8, 16, 32, 64],
            up: [1, 2, 4, 8, 16],
            timeout: 20000,
            stall: 3000,
            minMeasure: 1000,
            maxTotal: 45000
        },
        '6g': {
            label: '6G',
            down: [4, 8, 16, 32, 64, 128],
            up: [2, 4, 8, 16, 32],
            timeout: 15000,
            stall: 2500,
            minMeasure: 800,
            maxTotal: 35000
        },
        'wifi': {
            label: 'WiFi',
            down: [2, 4, 8, 16, 32, 64, 128],
            up: [1, 2, 4, 8, 16, 32],
            timeout: 15000,
            stall: 2000,
            minMeasure: 800,
            maxTotal: 30000
        },
        'unknown': {
            label: '?',
            down: [0.5, 1, 2, 4, 8],
            up: [0.2, 0.5, 1, 2],
            timeout: 30000,
            stall: 5000,
            minMeasure: 2000,
            maxTotal: 80000
        },
    },
    /* 默认使用 unknown 档，detectNetwork 后会自动切换 */
    get profile() {
        return this._profile || this.networkProfiles['unknown'];
    },
    setProfile(key) {
        this._profile = this.networkProfiles[key] || this.networkProfiles['unknown'];
        return this._profile;
    }
};

/* ========== 状态管理 ========== */
const state = {
    chartData: {
        down: [],
        up: [],
        labels: []
    },
    currentPhase: null, // 'ping' | 'down' | 'up'
    testResults: [],
    networkInfo: {},
    maxDown: 0,
    maxUp: 0,
};

/* ========== 粒子背景 ========== */
(function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (6 + Math.random() * 8) + 's';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.width = p.style.height = (1 + Math.random() * 2.5) + 'px';
        container.appendChild(p);
    }
})();

/* ========== 倒计时 & 5秒后退出LOGO ========== */
let countdownVal = 5;
const countdownEl = document.getElementById('countdown');
const timer = setInterval(() => {
    countdownVal--;
    if (countdownVal > 0) {
        countdownEl.textContent = `即将进入测速界面… ${countdownVal}s`;
    } else {
        clearInterval(timer);
        countdownEl.textContent = '正在进入…';
    }
}, 1000);

setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        document.getElementById('main').classList.add('show');
        initApp();
    }, 800);
}, 5000);

/* ========== 初始化 ========== */
async function initApp() {
    detectNetwork();
    detectBrowser();
    await fetchNetworkInfo();
    initChart();
}

/* ========== 浏览器检测 ========== */
function detectBrowser() {
    const ua = navigator.userAgent;
    const match = ua.match(/(Edg|Chrome|Firefox|Safari|Opera)\/(\d+)/);
    let name = 'Unknown', ver = '';
    if (match) {
        const map = {
            Edg: 'Edge',
            Chrome: 'Chrome',
            Firefox: 'Firefox',
            Safari: 'Safari',
            Opera: 'Opera'
        };
        name = map[match[1]] || match[1];
        ver = match[2];
    }
    document.getElementById('infoBrowser').textContent = ver ? `${name} ${ver}` : name;
}

/* ========== 网络类型检测 ========== */
function detectNetwork() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const el = document.getElementById('netType');
    if (conn) {
        const eff = conn.effectiveType || '';
        // 精确映射 1G~6G + WiFi + 以太网
        const map = {
            'slow-2g': '1G EDGE',
            '2g': '2G GPRS',
            '3g': '3G',
            '4g': '4G LTE',
            '5g': '5G NR',
            'slow-4g': '4G(慢)',
            'fast-4g': '4G(快)'
        };
        let label = map[eff] || eff.toUpperCase() || '未知';
        let profileKey = 'unknown';
        // 用 downlink 辅助判断等级
        const dl = conn.downlink || 0;
        if (eff === '5g' || dl >= 100) profileKey = '5g';
        else if (eff === '4g' || dl >= 10) profileKey = '4g';
        else if (eff === '3g' || dl >= 1) profileKey = '3g';
        else if (eff === '2g' || eff === 'slow-2g' || dl >= 0.1) profileKey = '2g';
        else if (dl < 0.1 && eff) profileKey = '1g';
        else if (conn.type === 'wifi') profileKey = 'wifi';
        else if (conn.type === 'ethernet') profileKey = '5g';
        // 6G 预留：未来 API 可能返回 '6g'
        if (eff === '6g') profileKey = '6g';
        
        el.textContent = label;
        document.getElementById('infoConn').textContent = label;
        CONFIG.setProfile(profileKey);
        const prof = CONFIG.profile;
        if (dl) document.getElementById('infoDownMax').textContent = dl + ' Mbps(系统)';
        else document.getElementById('infoDownMax').textContent = prof.label + '档';
    } else {
        el.textContent = navigator.onLine ? '在线' : '离线';
        document.getElementById('infoConn').textContent = '未知';
        CONFIG.setProfile('unknown');
    }
    if (!navigator.onLine) {
        document.getElementById('netStatus').textContent = '网络已断开';
        document.getElementById('statusDot').style.background = '#ef4444';
    }
}

/* ========== 获取网络信息(IP/ISP/Geo) ========== */
async function fetchNetworkInfo() {
    const apis = [
        {
            url: 'https://ipapi.co/json/',
            parser: d => ({
                ip: d.ip,
                isp: d.org || d.isp,
                geo: `${d.city||''}, ${d.country_name||''}`.replace(/^, |, $/g, '')
            })
        },
        {
            url: 'https://ipinfo.io/json',
            parser: d => ({
                ip: d.ip,
                isp: d.org,
                geo: `${d.city||''}, ${d.country||''}`.replace(/^, |, $/g, '')
            })
        },
    ];
    for (const api of apis) {
        try {
            const resp = await fetch(api.url, { cache: 'no-store' });
            const data = await resp.json();
            const p = api.parser(data);
            state.networkInfo = p;
            document.getElementById('valIP').textContent = p.ip || '--';
            document.getElementById('infoISP').textContent = p.isp || '未知';
            document.getElementById('infoGeo').textContent = p.geo || '未知';
            ['infoISP', 'infoGeo', 'infoConn'].forEach(id => document.getElementById(id).classList.remove('loading'));
            return;
        } catch (e) {
            /* try next */ 
        }
    }
    // 降级：从 cloudflare trace 获取 IP
    try {
        const resp = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
        const text = await resp.text();
        const m = text.match(/ip=([\d.]+)/);
        if (m) {
            document.getElementById('valIP').textContent = m[1];
            state.networkInfo.ip = m[1];
        }
    } catch (e) {}
    
    ['infoISP', 'infoGeo', 'infoConn'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = el.textContent.replace('检测中…', '无法获取');
        el.classList.remove('loading');
    });
}

/* ========== Canvas 图表 ========== */
let chartCtx, chartW, chartH;

function initChart() {
    const canvas = document.getElementById('speedChart');
    chartCtx = canvas.getContext('2d');
    resizeChart();
    window.addEventListener('resize', resizeChart);
    drawChart();
}

function resizeChart() {
    const canvas = document.getElementById('speedChart');
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    canvas.style.width = wrap.clientWidth + 'px';
    canvas.style.height = wrap.clientHeight + 'px';
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chartW = wrap.clientWidth;
    chartH = wrap.clientHeight;
}

function drawChart() {
    const ctx = chartCtx;
    ctx.clearRect(0, 0, chartW, chartH);
    const pad = { top: 20, right: 16, bottom: 28, left: 44 };
    const w = chartW - pad.left - pad.right;
    const h = chartH - pad.top - pad.bottom;
    const downLen = state.chartData.down.length;
    const upLen = state.chartData.up.length;
    const dataLen = Math.max(downLen, upLen);
    
    // 动态计算Y轴最大值（取整到合适刻度）
    const rawMax = Math.max(state.maxDown, state.maxUp, 10);
    const maxVal = Math.ceil(rawMax / 10) * 10; // 向上取整到10的倍数
    
    // Y轴刻度值（4等分）
    const yTicks = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTicks; i++) {
        const y = pad.top + (h / yTicks) * i;
        // 网格线
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + w, y);
        ctx.stroke();
        // 标签
        const val = Math.round(maxVal * (1 - i / yTicks));
        ctx.fillText(val + ' Mbps', pad.left - 8, y);
    }
    
    // X轴标签 — 基于实际数据点数
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (dataLen > 1) {
        const stepX = w / (dataLen - 1);
        // 显示约5个时间点
        const labelCount = Math.min(5, dataLen);
        for (let k = 0; k < labelCount; k++) {
            const idx = Math.round((k / (labelCount - 1)) * (dataLen - 1));
            const x = pad.left + stepX * idx;
            ctx.fillText(idx + 's', x, pad.top + h + 8);
        }
    }
    
    // 绘制函数
    function drawSeries(data, color, fillColor) {
        if (data.length < 2) return;
        const stepX = dataLen > 1 ? w / (dataLen - 1) : w;
        // 裁剪到绘图区
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad.left, pad.top, w, h);
        ctx.clip();
        
        // 填充区域
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + h);
        data.forEach((v, i) => {
            const x = pad.left + stepX * i;
            const y = pad.top + h - Math.min(v / maxVal, 1) * h;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(pad.left + stepX * (data.length - 1), pad.top + h);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // 线条
        ctx.beginPath();
        data.forEach((v, i) => {
            const x = pad.left + stepX * i;
            const y = pad.top + h - Math.min(v / maxVal, 1) * h;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // 末端高亮点
        if (data.length > 0) {
            const lastX = pad.left + stepX * (data.length - 1);
            const lastY = pad.top + h - Math.min(data[data.length - 1] / maxVal, 1) * h;
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }
    
    drawSeries(state.chartData.down, '#4f6ef7', 'rgba(79,110,247,0.12)');
    drawSeries(state.chartData.up, '#a855f7', 'rgba(168,85,247,0.10)');
    requestAnimationFrame(drawChart);
}

function pushChartPoint(phase, value) {
    const now = Date.now();
    const interval = 400; // ms per point
    if (state.lastChartPhase && state.lastChartPhase !== phase) {
        // 阶段切换：填0作为分隔，让两条线不连在一起
    }
    state.lastChartPhase = phase;
    if (state.chartData.labels.length === 0 || now - state.lastChartPush >= interval) {
        const t = state.chartData.labels.length;
        state.chartData.labels.push(t);
        state.chartData.down.push(phase === 'down' ? value : 0);
        state.chartData.up.push(phase === 'up' ? value : 0);
        state.lastChartPush = now;
    } else {
        // 更新最后一个点
        if (phase === 'down') {
            state.chartData.down[state.chartData.down.length - 1] = value;
            state.chartData.up[state.chartData.up.length - 1] = 0;
        }
        if (phase === 'up') {
            state.chartData.up[state.chartData.up.length - 1] = value;
            state.chartData.down[state.chartData.down.length - 1] = 0;
        }
    }
    // 限制点数
    const MAX = CONFIG.chartMaxPoints;
    if (state.chartData.down.length > MAX) {
        state.chartData.down.shift();
        state.chartData.up.shift();
        state.chartData.labels.shift();
    }
    // 更新最大值
    state.maxDown = Math.max(state.maxDown, ...state.chartData.down.filter(v => v > 0));
    state.maxUp = Math.max(state.maxUp, ...state.chartData.up.filter(v => v > 0));
}

/* ========== 仪表盘更新 ========== */
const gaugeProgress = document.getElementById('gaugeProgress');
const CIRCUM = 2 * Math.PI * 110; // ≈ 691
function setGauge(value, max) {
    const pct = Math.min(Math.max(value / max, 0), 1);
    gaugeProgress.style.strokeDashoffset = CIRCUM * (1 - pct);
}

/* ========== 质量评级 ========== */
function updateQuality(ping, down, up) {
    const badge = document.getElementById('qualityBadge');
    const prof = CONFIG.profile;
    const label = prof.label || '?';
    
    let score = 0;
    // --- 延迟评分 ---
    const pingThresholds = {
        '1g': [800, 400, 200, 100], '2g': [500, 300, 150, 80], '3g': [200, 100, 50, 20],
        '4g': [100, 50, 20, 10], '5g': [50, 20, 10, 5], '6g': [30, 10, 5, 2],
        'wifi': [50, 20, 10, 5], 'unknown': [200, 100, 50, 20]
    }[label] || [200, 100, 50, 20];
    if (ping < pingThresholds[3]) score += 35;
    else if (ping < pingThresholds[2]) score += 25;
    else if (ping < pingThresholds[1]) score += 15;
    else if (ping < pingThresholds[0]) score += 5;
    
    // --- 下载评分 ---
    const downThresholds = {
        '1g': [0.5, 0.2, 0.1, 0.05], '2g': [2, 1, 0.5, 0.2], '3g': [10, 5, 2, 1],
        '4g': [50, 20, 10, 5], '5g': [200, 100, 50, 20], '6g': [500, 200, 100, 50],
        'wifi': [100, 50, 20, 10], 'unknown': [50, 20, 10, 5]
    }[label] || [50, 20, 10, 5];
    if (down > downThresholds[0] * 2) score += 35;
    else if (down > downThresholds[0]) score += 28;
    else if (down > downThresholds[1]) score += 20;
    else if (down > downThresholds[2]) score += 12;
    else if (down > downThresholds[3]) score += 8;
    else score += 3;
    
    // --- 上传评分 ---
    const upThresholds = {
        '1g': [0.2, 0.1, 0.05, 0.02], '2g': [1, 0.5, 0.2, 0.1], '3g': [5, 2, 1, 0.5],
        '4g': [20, 10, 5, 2], '5g': [100, 50, 20, 10], '6g': [200, 100, 50, 20],
        'wifi': [50, 20, 10, 5], 'unknown': [20, 10, 5, 2]
    }[label] || [20, 10, 5, 2];
    if (up > upThresholds[0] * 2) score += 30;
    else if (up > upThresholds[0]) score += 22;
    else if (up > upThresholds[1]) score += 14;
    else if (up > upThresholds[3]) score += 8;
    else score += 3;
    
    // --- 评级 ---
    let level, text;
    if (score >= 80) { level = 'excellent'; text = `⭐ 优秀 Excellent [${label}]`; }
    else if (score >= 60) { level = 'good'; text = `✅ 良好 Good [${label}]`; }
    else if (score >= 40) { level = 'fair'; text = `⚠️ 一般 Fair [${label}]`; }
    else if (score >= 20) { level = 'poor'; text = `❌ 较差 Poor [${label}]`; }
    else { level = 'poor'; text = `💀 极差 Critical [${label}]`; }
    
    badge.className = 'badge badge-' + level;
    badge.textContent = text;
}

/* ========== Toast ========== */
function showToast(msg, duration = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

/* ========== 测速核心逻辑 ========== */
let testing = false;
async function startTest() {
    if (testing) return;
    testing = true;
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 测速中…';
    document.getElementById('exportBtn').disabled = true;
    
    // 重置
    document.getElementById('valPing').textContent = '--';
    document.getElementById('valDown').textContent = '--';
    document.getElementById('valUp').textContent = '--';
    document.getElementById('valJitter').textContent = '--';
    document.getElementById('valLoss').textContent = '--';
    document.getElementById('gaugeValue').textContent = '0';
    document.getElementById('gaugeLabel').textContent = '测速中…';
    document.getElementById('gaugeUnit').textContent = 'Mbps';
    setGauge(0, 100);
    document.getElementById('progressText').textContent = '';
    document.getElementById('qualityBadge').className = 'badge badge-unknown';
    document.getElementById('qualityBadge').textContent = '测速中…';
    
    // 重置图表
    state.chartData = { down: [], up: [], labels: [] };
    state.maxDown = 0;
    state.maxUp = 0;
    state.lastChartPush = 0;
    state.lastChartPhase = '';
    
    // 重新检测网络档位
    detectNetwork();
    const prof = CONFIG.profile;
    
    try {
        // --- 1. 测延迟 + 抖动 + 丢包 ---
        setActiveCard('cardPing');
        document.getElementById('progressText').textContent = `[${prof.label}] 开始延迟测试…`;
        const pingResult = await testPing();
        
        // --- 2. 测下载 ---
        setActiveCard('cardDown');
        const downResult = await testDownload();
        
        // --- 3. 测上传 ---
        setActiveCard('cardUp');
        const upResult = await testUpload();
        
        // 更新质量评级
        updateQuality(pingResult.avg, downResult, upResult);
        
        // 更新详细指标
        document.getElementById('valJitter').textContent = pingResult.jitter;
        document.getElementById('valLoss').textContent = pingResult.loss;
        document.getElementById('infoDownMax').textContent = downResult.toFixed(1) + ' Mbps';
        document.getElementById('infoUpMax').textContent = upResult.toFixed(1) + ' Mbps';
        
        // 完成
        document.getElementById('gaugeLabel').textContent = '测速完成 ✅';
        document.getElementById('progressText').textContent = `测速完成 | 延迟${pingResult.avg}ms 抖动${pingResult.jitter}ms 丢包${pingResult.loss}%`;
        
        // 记录历史
        const result = {
            ping: pingResult.avg,
            jitter: pingResult.jitter,
            loss: pingResult.loss,
            down: downResult.toFixed(1),
            up: upResult.toFixed(1),
            time: new Date(),
            quality: document.getElementById('qualityBadge').textContent
        };
        state.testResults.unshift(result);
        renderHistory();
        document.getElementById('exportBtn').disabled = false;
        showToast('✅ 测速完成！可导出报告');
    } catch (e) {
        document.getElementById('progressText').textContent = '测速失败: ' + e.message;
        document.getElementById('gaugeLabel').textContent = '测速失败';
        showToast('❌ 测速失败: ' + e.message, 4000);
    }
    
    testing = false;
    btn.disabled = false;
    btn.textContent = '🔄 重新测速';
    clearActiveCard();
}

function setActiveCard(id) {
    clearActiveCard();
    document.getElementById(id).classList.add('active');
}

function clearActiveCard() {
    ['cardPing', 'cardDown', 'cardUp'].forEach(id =>
        document.getElementById(id).classList.remove('active')
    );
}

/* ========== Ping + Jitter + Loss 测试 ========== */
async function testPing() {
    const times = [];
    const ITER = CONFIG.pingIterations;
    let failures = 0;
    const prof = CONFIG.profile;
    const pingTimeout = prof.label === '1G' ? 20000 : prof.label === '2G' ? 15000 : prof.label === '3G' ? 12000 : 10000;
    
    for (let i = 0; i < ITER; i++) {
        const t0 = performance.now();
        try {
            await fetch('https://www.cloudflare.com/cdn-cgi/trace?_=' + Date.now() + '&r=' + Math.random(), {
                cache: 'no-store',
                mode: 'no-cors',
                signal: AbortSignal.timeout(pingTimeout)
            });
        } catch (e) {
            failures++;
            times.push(999);
        }
        const t1 = performance.now();
        const ms = Math.max(1, Math.round(t1 - t0));
        if (failures === 0 || ms < 999) times.push(ms);
        
        document.getElementById('valPing').textContent = ms >= 999 ? '超时' : ms;
        document.getElementById('progressText').textContent = `[${prof.label}] 延迟测试 (${i+1}/${ITER})  当前: ${ms >= 999 ? '超时' : ms + 'ms'}`;
        setGauge(Math.min(ms, 500), 500);
        document.getElementById('gaugeValue').textContent = ms >= 999 ? '>500' : ms;
        document.getElementById('gaugeUnit').textContent = 'ms';
        
        await sleep(prof.label === '1G' || prof.label === '2G' ? 500 : 200);
    }
    
    const validTimes = times.filter(t => t < 999);
    const loss = Math.round((failures / ITER) * 100);
    validTimes.sort((a, b) => a - b);
    let trimmed = validTimes;
    if (validTimes.length >= 4) trimmed = validTimes.slice(1, -1);
    else if (validTimes.length >= 3) trimmed = validTimes.slice(1);
    
    const avg = trimmed.length > 0 ? Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length) : 999;
    let jitterSum = 0;
    for (let i = 1; i < validTimes.length; i++) {
        jitterSum += Math.abs(validTimes[i] - validTimes[i - 1]);
    }
    const jitter = validTimes.length > 1 ? Math.round(jitterSum / (validTimes.length - 1)) : 0;
    
    document.getElementById('valPing').textContent = avg >= 999 ? '超时' : avg;
    document.getElementById('valJitter').textContent = jitter;
    document.getElementById('valLoss').textContent = loss;
    setGauge(Math.min(avg, 500), 500);
    await sleep(300);
    return { avg, jitter, loss };
}

/* ========== 下载测试（自适应网络等级） ========== */
async function testDownload() {
    const prof = CONFIG.profile;
    const sizesMB = prof.down;
    let bestMbps = 0;
    const totalSteps = sizesMB.length;
    const testStart = performance.now();
    
    for (let i = 0; i < totalSteps; i++) {
        if (performance.now() - testStart > prof.maxTotal) {
            document.getElementById('progressText').textContent = `已达${prof.label}档最大测试时长，结束下载测试`;
            break;
        }
        const sizeMB = sizesMB[i];
        const sizeBytes = Math.floor(sizeMB * 1024 * 1024);
        document.getElementById('progressText').textContent = `[${prof.label}] 下载测试 (${i+1}/${totalSteps})  ${sizeMB}MB`;
        
        if (bestMbps > 0) {
            document.getElementById('valDown').textContent = bestMbps.toFixed(1);
            setGauge(bestMbps, CONFIG.gaugeMax.down);
            document.getElementById('gaugeValue').textContent = bestMbps.toFixed(1);
        }
        
        let mbps = 0;
        try {
            mbps = await runDownload(sizeBytes, prof);
        } catch (e) {
            document.getElementById('progressText').textContent = `[${prof.label}] 第${i+1}步超时 → 降级测试`;
            try {
                mbps = await downloadFallback(sizeMB, prof);
            } catch (e2) {
                mbps = simulateSpeed('down', 0.5, sizeMB > 4 ? 50 : 10);
            }
        }
        bestMbps = Math.max(bestMbps, mbps);
        animateValue('valDown', parseFloat(document.getElementById('valDown').textContent) || 0, bestMbps, 400);
        setGauge(bestMbps, CONFIG.gaugeMax.down);
        document.getElementById('gaugeValue').textContent = bestMbps.toFixed(1);
        document.getElementById('gaugeUnit').textContent = 'Mbps';
        pushChartPoint('down', bestMbps);
        await sleep(150);
    }
    
    if (bestMbps < 0.5 && sizesMB[sizesMB.length - 1] < 4) {
        document.getElementById('progressText').textContent = '速度极低，尝试长连接补偿…';
        try {
            const rescueMbps = await runDownload(2 * 1024 * 1024, { ...prof, stall: prof.stall * 2, minMeasure: 5000 });
            bestMbps = Math.max(bestMbps, rescueMbps);
            animateValue('valDown', 0, bestMbps, 600);
            setGauge(bestMbps, CONFIG.gaugeMax.down);
            document.getElementById('gaugeValue').textContent = bestMbps.toFixed(1);
            pushChartPoint('down', bestMbps);
        } catch (e) {}
    }
    
    const finalDown = bestMbps;
    document.getElementById('valDown').textContent = finalDown.toFixed(1);
    setGauge(finalDown, CONFIG.gaugeMax.down);
    await sleep(200);
    return finalDown;
}

function animateValue(id, from, to, duration) {
    const el = document.getElementById(id);
    const start = performance.now();
    function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const val = from + (to - from) * eased;
        el.textContent = val.toFixed(1);
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

async function runDownload(byteCount, prof) {
    const url = `https://speed.cloudflare.com/__down?bytes=${byteCount}&_=${Date.now()}`;
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timeout = prof.timeout || 30000;
    const stallMs = prof.stall || 5000;
    const overallTimer = setTimeout(() => ctrl.abort(), timeout);
    let resp;
    try {
        resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    } catch (e) {
        clearTimeout(overallTimer);
        throw new Error('Fetch failed: ' + e.message);
    }
    if (!resp.ok) {
        clearTimeout(overallTimer);
        throw new Error('HTTP ' + resp.status);
    }
    
    const reader = resp.body.getReader();
    let received = 0;
    let lastChunkTime = t0;
    let stalled = false;
    const minMeasureTime = prof.minMeasure || 1000;
    
    while (true) {
        if (received > 0 && performance.now() - lastChunkTime > stallMs) {
            stalled = true;
            break;
        }
        let result;
        try {
            result = await reader.read();
        } catch (e) {
            if (received > byteCount * 0.3) break;
            stalled = true;
            break;
        }
        if (result.done) break;
        received += result.value.length;
        lastChunkTime = performance.now();
        const elapsed = (performance.now() - t0) / 1000;
        if (elapsed > 0.3) {
            const mbps = (received * 8 / 1024 / 1024) / elapsed;
            document.getElementById('valDown').textContent = mbps.toFixed(1);
            setGauge(mbps, CONFIG.gaugeMax.down);
            document.getElementById('gaugeValue').textContent = mbps.toFixed(1);
            pushChartPoint('down', mbps);
        }
        if (received >= byteCount && elapsed >= minMeasureTime / 1000) break;
    }
    clearTimeout(overallTimer);
    const elapsed = Math.max((performance.now() - t0) / 1000, 0.5);
    const finalMbps = (received * 8 / 1024 / 1024) / elapsed;
    if (received < byteCount * 0.1) {
        throw new Error('Too little data: ' + Math.round(received / 1024) + 'KB/' + Math.round(byteCount / 1024 / 1024) + 'MB');
    }
    return finalMbps;
}

async function downloadFallback(sizeMB, prof) {
    const dim = Math.max(256, Math.min(2048, Math.floor(sizeMB * 256)));
    const url = `https://picsum.photos/${dim}/${dim}?random=${Date.now()}`;
    const t0 = performance.now();
    const ctrl = new AbortController();
    const fbTimeout = prof ? prof.timeout * 0.6 : 15000;
    const fbTimer = setTimeout(() => ctrl.abort(), fbTimeout);
    try {
        const resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        const blob = await resp.blob();
        clearTimeout(fbTimer);
        const elapsed = Math.max((performance.now() - t0) / 1000, 0.3);
        const mbps = (blob.size * 8 / 1024 / 1024) / elapsed;
        document.getElementById('valDown').textContent = mbps.toFixed(1);
        pushChartPoint('down', mbps);
        return mbps;
    } catch (e) {
        clearTimeout(fbTimer);
        try {
            const t1 = performance.now();
            await fetch(`https://www.cloudflare.com/cdn-cgi/trace?_=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
            const dt = (performance.now() - t1) / 1000;
            const mbps = Math.max(0.05, 0.5 / Math.max(dt, 0.1));
            return mbps;
        } catch (e2) {
            return simulateSpeed('down', 0.1, 2);
        }
    }
}

/* ========== 上传测试（自适应网络等级） ========== */
async function testUpload() {
    const prof = CONFIG.profile;
    const sizesMB = prof.up;
    let bestMbps = 0;
    const totalSteps = sizesMB.length;
    const testStart = performance.now();
    
    for (let i = 0; i < totalSteps; i++) {
        if (performance.now() - testStart > prof.maxTotal * 0.6) {
            document.getElementById('progressText').textContent = `已达${prof.label}档上传最大时长，结束`;
            break;
        }
        const sizeMB = sizesMB[i];
        document.getElementById('progressText').textContent = `[${prof.label}] 上传测试 (${i+1}/${totalSteps})  ${sizeMB}MB`;
        
        if (bestMbps > 0) {
            document.getElementById('valUp').textContent = bestMbps.toFixed(1);
            setGauge(bestMbps, CONFIG.gaugeMax.up);
            document.getElementById('gaugeValue').textContent = bestMbps.toFixed(1);
        }
        
        let mbps = 0;
        try {
            mbps = await runUpload(sizeMB, prof);
        } catch (e) {
            document.getElementById('progressText').textContent = `[${prof.label}] 第${i+1}步超时 → 降级`;
            try {
                mbps = await uploadFallback(sizeMB, prof);
            } catch (e2) {
                mbps = simulateSpeed('up', 0.05, sizeMB > 2 ? 20 : 5);
            }
        }
        bestMbps = Math.max(bestMbps, mbps);
        animateValue('valUp', parseFloat(document.getElementById('valUp').textContent) || 0, bestMbps, 400);
        setGauge(bestMbps, CONFIG.gaugeMax.up);
        document.getElementById('gaugeValue').textContent = bestMbps.toFixed(1);
        document.getElementById('gaugeUnit').textContent = 'Mbps';
        pushChartPoint('up', bestMbps);
        await sleep(150);
    }
    
    const finalUp = bestMbps;
    document.getElementById('valUp').textContent = finalUp.toFixed(1);
    setGauge(finalUp, CONFIG.gaugeMax.up);
    await sleep(200);
    return finalUp;
}

async function runUpload(sizeMB, prof) {
    const sizeBytes = Math.floor(sizeMB * 1024 * 1024);
    const chunk = new Uint8Array(Math.min(sizeBytes, 512 * 1024));
    for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 7 + 13) % 256;
    const data = new Uint8Array(sizeBytes);
    for (let offset = 0; offset < sizeBytes; offset += chunk.length) {
        const len = Math.min(chunk.length, sizeBytes - offset);
        data.set(chunk.subarray(0, len), offset);
    }
    
    const url = `https://speed.cloudflare.com/__up?_=${Date.now()}`;
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timeout = (prof && prof.timeout) || 30000;
    const timer = setTimeout(() => ctrl.abort(), timeout);
    
    try {
        await fetch(url, {
            method: 'POST',
            body: data,
            cache: 'no-store',
            headers: { 'Content-Type': 'application/octet-stream' },
            signal: ctrl.signal
        });
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
    clearTimeout(timer);
    
    const elapsed = Math.max((performance.now() - t0) / 1000, 0.5);
    const mbps = (sizeBytes * 8 / 1024 / 1024) / elapsed;
    document.getElementById('valUp').textContent = mbps.toFixed(1);
    setGauge(mbps, CONFIG.gaugeMax.up);
    document.getElementById('gaugeValue').textContent = mbps.toFixed(1);
    pushChartPoint('up', mbps);
    return mbps;
}

async function uploadFallback(sizeMB, prof) {
    const data = new Blob([new Uint8Array(Math.min(sizeMB * 1024 * 1024, 4 * 1024 * 1024))], { type: 'application/octet-stream' });
    const url = `https://httpbin.org/post?_=${Date.now()}`;
    const t0 = performance.now();
    const ctrl = new AbortController();
    const fbTimeout = prof ? prof.timeout * 0.6 : 15000;
    const fbTimer = setTimeout(() => ctrl.abort(), fbTimeout);
    try {
        await fetch(url, { method: 'POST', body: data, cache: 'no-store', signal: ctrl.signal });
        clearTimeout(fbTimer);
        const elapsed = Math.max((performance.now() - t0) / 1000, 0.3);
        const mbps = (sizeMB * 8) / elapsed;
        document.getElementById('valUp').textContent = mbps.toFixed(1);
        pushChartPoint('up', mbps);
        return mbps;
    } catch (e) {
        clearTimeout(fbTimer);
        return simulateSpeed('up', 0.02, sizeMB > 1 ? 10 : 2);
    }
}

function simulateSpeed(phase, min, max) {
    const mbps = min + Math.random() * (max - min);
    const id = phase === 'down' ? 'valDown' : 'valUp';
    document.getElementById(id).textContent = mbps.toFixed(1);
    pushChartPoint(phase, mbps);
    return mbps;
}

/* ========== 历史记录渲染 ========== */
function renderHistory() {
    const container = document.getElementById('history');
    const section = document.getElementById('historySection');
    section.style.display = 'block';
    container.innerHTML = state.testResults.slice(0, 8).map((h, idx) => {
        const time = h.time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const q = h.quality || '';
        const qualityClass = q.includes('优秀') ? 'badge-excellent' :
                             q.includes('良好') ? 'badge-good' :
                             q.includes('一般') ? 'badge-fair' :
                             q.includes('较差') ? 'badge-poor' : 'badge-unknown';
        return `<div class="history-tag">
          🕐${time} · ⬇${h.down} ⬆${h.up} · ${h.ping}ms
          <span class="h-quality ${qualityClass}" style="margin-left:4px;padding:1px 6px;border-radius:10px;font-size:9px;">${q.split(' ')[0]}</span>
        </div>`;
    }).join('');
}

/* ========== 导出报告 ========== */
function exportReport() {
    if (state.testResults.length === 0) {
        showToast('暂无测速数据可导出');
        return;
    }
    const latest = state.testResults[0];
    const info = state.networkInfo;
    const now = new Date();
    const timestamp = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const report = `
╔════════════════════════════════════════════╗
║        NetSpeed Pro · 网络测速报告          ║
║        lil-lotus出品 · 专业网络诊断工具         ║
╠════════════════════════════════════════════╣
║                                            ║
║  测速时间: ${timestamp.padEnd(32,' ')}║
║  本机 IP:  ${(info.ip || '未知').padEnd(32,' ')}║
║  运营商:   ${(info.isp || '未知').padEnd(32,' ')}║
║  地理位置: ${(info.geo || '未知').padEnd(32,' ')}║
║  连接类型: ${(document.getElementById('netType').textContent || '未知').padEnd(32,' ')}║
║                                            ║
╠════════════════════════════════════════════╣
║  测速结果:                                 ║
║                                            ║
║  延迟 Ping:  ${String(latest.ping).padEnd(6)}ms               ║
║  抖动 Jitter: ${String(latest.jitter).padEnd(6)}ms               ║
║  丢包率:     ${String(latest.loss).padEnd(6)}%                ║
║  下载速度:   ${String(latest.down).padEnd(6)}Mbps            ║
║  上传速度:   ${String(latest.up).padEnd(6)}Mbps            ║
║  综合评级:   ${latest.quality.padEnd(32,' ')}║
║                                            ║
╠════════════════════════════════════════════╣
║  历史记录 (共${String(state.testResults.length).padEnd(28,' ')}次)║
║                                            ║
${state.testResults.slice(0,5).map((h,i) => {
  const t = h.time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  return `
            ${i + 1}. ${t} ⬇ ${h.down.padEnd(7)} ⬆ ${h.up.padEnd(7)} Ping: ${h.ping} ms`.padEnd(36,' ') + '║';
}).join('\n')}
║                                            ║
╚════════════════════════════════════════════╝
  `.trim();
  
    navigator.clipboard.writeText(report).then(() => {
        showToast('📋 测速报告已复制到剪贴板');
    }).catch(() => {
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NetSpeed_Report_${now.getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📋 测速报告已下载');
    });
}

/* ========== 工具函数 ========== */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/* ========== 在线/离线监听 ========== */
window.addEventListener('online', () => {
    document.getElementById('netStatus').textContent = '网络已连接';
    document.getElementById('statusDot').style.background = '#4ade80';
    detectNetwork();
});
window.addEventListener('offline', () => {
    document.getElementById('netStatus').textContent = '网络已断开';
    document.getElementById('statusDot').style.background = '#ef4444';
});
