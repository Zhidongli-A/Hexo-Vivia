/**
 * Status 状态监控
 * 从指定 API 获取服务状态数据，渲染卡片式监控面板
 *
 * API 响应格式（由用户提供）：
 * {
 *   "services": [
 *     {
 *       "service_name": "Astrbot",
 *       "records": [
 *         { "status": "Green", "response_time": null, "timestamp": "2026-05-23T06:35:36Z" }
 *       ]
 *     }
 *   ],
 *   "generated_at": "2026-05-24T06:35:36Z"
 * }
 */

// ========== 配置 ==========
const STATUS_CONFIG = {
  // API 地址
  apiUrl: 'https://status.zhidongli.top/api/status',

  // 状态映射：API 返回的状态值 → 内部标识
  statusMap: {
    'Green': 'operational',
    'Red': 'down',
    'Grey': 'unknown',
    'Yellow': 'degraded',
    'Orange': 'degraded'
  },

  // 状态显示标签（中文）
  labels: {
    operational: '正常运行',
    degraded: '性能下降',
    down: '服务中断',
    unknown: '未知'
  },

  // 状态对应的 CSS class 后缀
  classes: {
    operational: 'operational',
    degraded: 'degraded',
    down: 'down',
    unknown: 'unknown'
  }
};

// ========== 工具函数 ==========
function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return month + '/' + day + ' ' + hours + ':' + minutes;
  } catch (e) {
    return isoString || '--';
  }
}

// 将 API 状态值映射为内部标识
function mapStatus(apiStatus) {
  return STATUS_CONFIG.statusMap[apiStatus] || 'unknown';
}

// 从 records 计算在线率
//   Green  → 100%  Red    → 0%
//   Yellow/Orange → 50%  Grey   → 不参与计算
function calcUptime(records) {
  if (!records || records.length === 0) return '--';
  var total = 0;
  var upScore = 0;
  for (var i = 0; i < records.length; i++) {
    var s = records[i].status;
    if (s === 'Green') { upScore += 1; total++; }
    else if (s === 'Yellow' || s === 'Orange') { upScore += 0.5; total++; }
    else if (s === 'Red') { upScore += 0; total++; }
    // Grey 不参与计算
  }
  if (total === 0) return '--';
  var pct = (upScore / total) * 100;
  return pct.toFixed(1) + '%';
}

// ========== 主函数 ==========
async function fetchStatus() {
  const container = document.getElementById('status-container');
  const refreshBtn = document.getElementById('status-refresh-btn');

  if (!container) return;

  if (refreshBtn) refreshBtn.classList.add('loading');

  container.innerHTML = '<div class="status-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在获取状态数据...</div>';

  try {
    const response = await fetch(STATUS_CONFIG.apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    // 页面已切换，停止后续操作
    if (!document.getElementById('status-container')) return;

    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }

    const data = await response.json();

    // 页面已切换，停止后续渲染
    if (!document.getElementById('status-container')) return;

    renderStatus(data);

  } catch (error) {
    console.error('Status fetch error:', error);
    container.innerHTML =
      '<div class="status-loading" style="color: var(--down, #ef4444);">' +
      '<i class="fa-solid fa-triangle-exclamation"></i> 获取状态数据失败<br>' +
      '<small style="color: var(--neut-L50);">' + error.message + '</small>' +
      '</div>';
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('loading');
  }
}

// ========== 渲染 ==========
function renderStatus(data) {
  const container = document.getElementById('status-container');
  var services = data && data.services ? data.services : [];

  if (!services.length) {
    container.innerHTML = '<div class="status-loading">暂无监控服务</div>';
    updateSummary([]);
    return;
  }

  // 更新汇总
  updateSummary(services);

  // 渲染卡片
  container.innerHTML = services.map(function(service, index) {
    // 字段映射
    var name = service.service_name || '未知服务';
    var records = service.records || [];

    // 从最后一条记录计算整体状态
    var lastRecord = records.length > 0 ? records[records.length - 1] : null;
    var overallApiStatus = lastRecord ? lastRecord.status : 'Grey';
    var overallStatus = mapStatus(overallApiStatus);
    var statusClass = STATUS_CONFIG.classes[overallStatus] || 'unknown';
    var statusLabel = STATUS_CONFIG.labels[overallStatus] || '未知';

    // 计算在线率
    var uptime = calcUptime(records);

    // 构建 24 条状态条（取最近 24 条记录）
    var barsHtml = '';
    var recentRecords = records.slice(-24);
    var barCount = recentRecords.length;

    if (barCount === 0) {
      for (var i = 0; i < 24; i++) {
        barsHtml += '<div class="status-card-bar status-card-bar--unknown" title="无数据">' +
          '<div class="status-card-bar-tooltip">无数据</div></div>';
      }
    } else {
      for (var i = 0; i < barCount; i++) {
        var entry = recentRecords[i];
        var entryApiStatus = entry && entry.status ? entry.status : 'Grey';
        var entryStatus = mapStatus(entryApiStatus);
        var entryClass = STATUS_CONFIG.classes[entryStatus] || 'unknown';
        var entryTime = entry && entry.timestamp ? formatTime(entry.timestamp) : '--';
        var entryLabel = STATUS_CONFIG.labels[entryStatus] || '未知';
        barsHtml += '<div class="status-card-bar status-card-bar--' + entryClass + '" title="' + entryTime + '">' +
          '<div class="status-card-bar-tooltip">' + entryTime + ' - ' + entryLabel + '</div></div>';
      }
    }

    var cardAnimationDelay = 'animation-delay: ' + (index * 0.06) + 's;';

    return '' +
      '<div class="status-card" style="' + cardAnimationDelay + '">' +
        '<div class="status-card-header">' +
          '<span class="status-card-name">' + escapeHtml(name) + '</span>' +
          '<span class="status-card-label status-card-label--' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="status-card-bars">' +
          barsHtml +
        '</div>' +
        '<div class="status-card-footer">' +
          '<span class="status-card-uptime"><i class="fa-solid fa-chart-line"></i> 在线率: ' + escapeHtml(uptime) + '</span>' +
        '</div>' +
      '</div>';
  }).join('');
}

// ========== 更新汇总统计 ==========
function updateSummary(services) {
  var operational = 0;
  var degraded = 0;
  var down = 0;

  for (var i = 0; i < services.length; i++) {
    var records = services[i].records || [];
    var lastRecord = records.length > 0 ? records[records.length - 1] : null;
    var apiStatus = lastRecord ? lastRecord.status : 'Grey';
    var status = mapStatus(apiStatus);
    if (status === 'operational') operational++;
    else if (status === 'degraded') degraded++;
    else if (status === 'down') down++;
  }

  var opEl = document.getElementById('status-operational-count');
  var degEl = document.getElementById('status-degraded-count');
  var downEl = document.getElementById('status-down-count');

  if (opEl) opEl.textContent = operational;
  if (degEl) degEl.textContent = degraded;
  if (downEl) downEl.textContent = down;
}

// ========== HTML 转义 ==========
function escapeHtml(text) {
  if (typeof text !== 'string') return String(text || '');
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}