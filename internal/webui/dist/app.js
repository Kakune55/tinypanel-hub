const $ = (id) => document.getElementById(id);
const telemetryListRenderLimit = 100;
const state = {
  adminToken: localStorage.getItem("tp_admin_token") || "",
  userToken: localStorage.getItem("tp_user_token") || "",
  selectedDeviceID: localStorage.getItem("tp_selected_device") || "",
  user: null,
  devices: [],
  todos: [],
  telemetry: [],
  messages: [],
  weather: null,
  snapshot: null
};

function init() {
  $("adminToken").value = state.adminToken;
  $("userToken").value = state.userToken;
  bindEvents();
  renderMessageSummary();
  renderTodoSummary();
  renderSnapshotSummary();
  renderTelemetryTrends();
  checkHealth();
  if (state.userToken) loadMe();
  refreshDevices();
  refreshTodos();
}

function bindEvents() {
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  $("saveTokensBtn").onclick = saveTokens;
  $("createUserBtn").onclick = createUser;
  $("loadMeBtn").onclick = loadMe;
  $("bindDeviceBtn").onclick = bindDevice;
  $("refreshDevicesBtn").onclick = refreshDevices;
  $("renameDeviceBtn").onclick = renameDevice;
  $("deleteDeviceBtn").onclick = deleteDevice;
  $("sendMessageBtn").onclick = sendMessage;
  $("refreshMessagesBtn").onclick = refreshMessages;
  $("createTodoBtn").onclick = createTodo;
  $("refreshTodosBtn").onclick = refreshTodos;
  $("refreshWeatherBtn").onclick = refreshWeather;
  $("refreshSnapshotBtn").onclick = refreshSnapshot;
  $("refreshTelemetryBtn").onclick = refreshTelemetry;
  $("telemetryLimit").onchange = refreshTelemetry;
  $("clearLogBtn").onclick = () => $("rawLog").textContent = "Ready.";
  $("closeTelemetryModalBtn").onclick = closeTelemetryModal;
  $("telemetryModal").onclick = (event) => {
    if (event.target === $("telemetryModal")) closeTelemetryModal();
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTelemetryModal();
  });
}

function switchTab(name) {
  document.querySelectorAll(".tabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === "tab-" + name));
}

function saveTokens() {
  state.adminToken = $("adminToken").value.trim();
  state.userToken = $("userToken").value.trim();
  localStorage.setItem("tp_admin_token", state.adminToken);
  localStorage.setItem("tp_user_token", state.userToken);
  notice("identityNotice", "已保存到浏览器。", "ok");
  updateHero();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...options, headers });
  let data = null;
  if (res.status !== 204) {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  }
  log({ method: options.method || "GET", path, status: res.status, response: data });
  if (!res.ok) {
    const message = data?.error || res.statusText;
    throw new Error(message);
  }
  return data;
}

function adminHeaders() {
  return { Authorization: "Bearer " + $("adminToken").value.trim() };
}

function userHeaders() {
  return { Authorization: "Bearer " + $("userToken").value.trim() };
}

async function checkHealth() {
  try {
    await api("/healthz");
    $("healthDot").classList.add("ok");
  } catch {
    $("healthDot").classList.remove("ok");
  }
}

async function createUser() {
  try {
    const body = {
      name: $("newUserName").value.trim(),
      email: $("newUserEmail").value.trim(),
      api_token: $("newUserToken").value.trim()
    };
    const data = await api("/api/v1/admin/users", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body)
    });
    $("userToken").value = data.api_token;
    saveTokens();
    state.user = data.user;
    notice("identityNotice", "用户已创建并切换。", "ok");
    updateHero();
  } catch (err) {
    notice("identityNotice", err.message, "error");
  }
}

async function loadMe() {
  try {
    const data = await api("/api/v1/me", { headers: userHeaders() });
    state.user = data;
    notice("identityNotice", `当前用户：${data.name || data.id}`, "ok");
    updateHero();
  } catch (err) {
    notice("identityNotice", err.message, "error");
  }
}

async function bindDevice() {
  try {
    const data = await api("/api/v1/devices/bind", {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({
        bind_code: $("bindCode").value.trim(),
        name: $("bindName").value.trim()
      })
    });
    state.selectedDeviceID = data.id;
    localStorage.setItem("tp_selected_device", data.id);
    notice("deviceNotice", "设备已绑定。", "ok");
    await refreshDevices();
  } catch (err) {
    notice("deviceNotice", err.message, "error");
  }
}

async function refreshDevices() {
  try {
    if (!$("userToken").value.trim()) return;
    state.devices = await api("/api/v1/devices", { headers: userHeaders() });
    if (!state.selectedDeviceID && state.devices.length) state.selectedDeviceID = state.devices[0].id;
    if (state.selectedDeviceID && !state.devices.some((d) => d.id === state.selectedDeviceID)) {
      state.selectedDeviceID = state.devices[0]?.id || "";
    }
    localStorage.setItem("tp_selected_device", state.selectedDeviceID);
    renderDevices();
    updateHero();
    if (state.selectedDeviceID) {
      refreshMessages();
      refreshTelemetry();
    }
  } catch (err) {
    renderError("devicesList", err.message);
  }
}

function renderDevices() {
  const box = $("devicesList");
  if (!state.devices.length) {
    box.innerHTML = `<div class="empty">暂无设备。先让设备 Hello，再用绑定码绑定。</div>`;
    $("selectedDeviceCard").innerHTML = `<div class="empty">暂无设备，无法显示详情。</div>`;
    return;
  }
  box.innerHTML = state.devices.map((d) => `
      <div class="item">
        <div class="item-row">
          <div>
            <div class="item-title">${escapeHTML(d.name || d.id)}</div>
            <div class="muted mono">${escapeHTML(d.id)}</div>
          </div>
          <button class="${d.id === state.selectedDeviceID ? "accent" : "secondary"}" data-select-device="${escapeAttr(d.id)}">选择</button>
        </div>
        <div class="muted">last seen: ${formatDate(d.last_seen_at)}</div>
      </div>
    `).join("");
  box.querySelectorAll("[data-select-device]").forEach((btn) => {
    btn.onclick = () => {
      state.selectedDeviceID = btn.dataset.selectDevice;
      localStorage.setItem("tp_selected_device", state.selectedDeviceID);
      $("renameDeviceName").value = selectedDevice()?.name || "";
      renderDevices();
      updateHero();
      refreshMessages();
      refreshTelemetry();
    };
  });
  renderSelectedDevice();
}

async function renameDevice() {
  const device = selectedDevice();
  if (!device) return;
  try {
    await api(`/api/v1/devices/${encodeURIComponent(device.id)}`,
      {
        method: "PATCH",
        headers: userHeaders(),
        body: JSON.stringify({ name: $("renameDeviceName").value.trim() })
      });
    await refreshDevices();
  } catch (err) {
    renderError("devicesList", err.message);
  }
}

async function deleteDevice() {
  const device = selectedDevice();
  if (!device) return;
  if (!confirm(`删除设备 ${device.name || device.id}？`)) return;
  try {
    await api(`/api/v1/devices/${encodeURIComponent(device.id)}`, { method: "DELETE", headers: userHeaders() });
    state.selectedDeviceID = "";
    await refreshDevices();
  } catch (err) {
    renderError("devicesList", err.message);
  }
}

async function sendMessage() {
  const device = selectedDevice();
  if (!device) return alert("请先选择设备");
  try {
    await api(`/api/v1/devices/${encodeURIComponent(device.id)}/messages`, {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({
        body: $("messageBody").value.trim(),
        priority: $("messagePriority").value
      })
    });
    $("messageBody").value = "";
    await refreshMessages();
  } catch (err) {
    renderError("messageHistory", err.message);
  }
}

async function refreshMessages() {
  const device = selectedDevice();
  if (!device) {
    state.messages = [];
    renderMessageSummary();
    updateHero();
    return renderEmpty("messageHistory", "请选择设备。");
  }
  try {
    const data = await api(`/api/v1/devices/${encodeURIComponent(device.id)}/messages?limit=50`, { headers: userHeaders() });
    state.messages = data;
    renderMessages("messageHistory", data);
    renderMessageSummary();
    updateHero();
  } catch (err) {
    renderError("messageHistory", err.message);
  }
}

function renderMessages(id, messages) {
  const box = $(id);
  if (!messages || !messages.length) return renderEmpty(id, "暂无消息。");
  box.innerHTML = messages.map((m) => `
      <div class="item">
        <div class="item-row">
          <div class="item-title">${escapeHTML(m.body)}</div>
          <span class="pill">${escapeHTML(m.priority || "normal")}</span>
        </div>
        <div class="muted">#${m.id} ${escapeHTML(m.status || "pending")} · ${formatDate(m.created_at)}</div>
      </div>
    `).join("");
}

async function createTodo() {
  try {
    await api("/api/v1/todos", {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({ text: $("todoText").value.trim(), status: Number($("todoStatus").value) })
    });
    $("todoText").value = "";
    await refreshTodos();
  } catch (err) {
    renderError("todosList", err.message);
  }
}

async function refreshTodos() {
  try {
    if (!$("userToken").value.trim()) return;
    state.todos = await api("/api/v1/todos", { headers: userHeaders() });
    $("metricTodos").textContent = state.todos.length;
    renderTodos();
    renderTodoSummary();
    updateHero();
  } catch (err) {
    renderError("todosList", err.message);
  }
}

function renderTodos() {
  const box = $("todosList");
  if (!state.todos.length) {
    renderTodoSummary();
    return renderEmpty("todosList", "暂无 TODO。");
  }
  box.innerHTML = state.todos.map((t) => `
      <div class="item">
        <div class="item-row">
          <div>
            <div class="item-title">${escapeHTML(t.text)}</div>
            <div class="muted">${todoStatusLabel(t.status)} · version ${t.version} · 更新于 ${formatDate(t.updated_at)}</div>
          </div>
          <select data-todo-status="${t.id}">
            <option value="0" ${t.status === 0 ? "selected" : ""}>未完成</option>
            <option value="1" ${t.status === 1 ? "selected" : ""}>正在完成</option>
            <option value="2" ${t.status === 2 ? "selected" : ""}>已完成</option>
          </select>
        </div>
        <textarea data-todo-text="${t.id}" placeholder="TODO 内容">${escapeHTML(t.text)}</textarea>
        <div class="actions">
          <button class="secondary" data-save-todo="${t.id}" data-version="${t.version}">保存状态</button>
          <button class="danger" data-delete-todo="${t.id}" data-version="${t.version}">删除</button>
        </div>
      </div>
    `).join("");
  box.querySelectorAll("[data-save-todo]").forEach((btn) => {
    btn.onclick = () => updateTodo(Number(btn.dataset.saveTodo), Number(btn.dataset.version));
  });
  box.querySelectorAll("[data-delete-todo]").forEach((btn) => {
    btn.onclick = () => deleteTodo(Number(btn.dataset.deleteTodo), Number(btn.dataset.version));
  });
}

async function updateTodo(id, version) {
  const status = Number(document.querySelector(`[data-todo-status="${id}"]`).value);
  const text = document.querySelector(`[data-todo-text="${id}"]`).value.trim();
  try {
    await api(`/api/v1/todos/${id}`, {
      method: "PATCH",
      headers: userHeaders(),
      body: JSON.stringify({ version, status, text })
    });
    await refreshTodos();
  } catch (err) {
    renderError("todosList", err.message);
  }
}

async function deleteTodo(id, version) {
  try {
    await api(`/api/v1/todos/${id}`, {
      method: "DELETE",
      headers: userHeaders(),
      body: JSON.stringify({ version })
    });
    await refreshTodos();
  } catch (err) {
    renderError("todosList", err.message);
  }
}

async function refreshWeather() {
  try {
    const data = await api("/api/v1/weather", { headers: userHeaders() });
    state.weather = data;
    $("weatherBox").innerHTML = `
        <div class="item">
          <div class="item-row">
            <div>
              <div class="item-title">${escapeHTML(data.condition || "unknown")}</div>
              <div class="muted">${escapeHTML(data.location || "")}</div>
            </div>
            <strong style="font-size:32px">${Number(data.temperature || 0).toFixed(0)}°</strong>
          </div>
          <div class="muted">humidity ${data.humidity ?? "-"} · updated ${formatDate(data.updated_at)}</div>
        </div>
      `;
    renderWeatherForecast();
    updateHero();
  } catch (err) {
    renderError("weatherBox", err.message);
  }
}

async function refreshSnapshot() {
  try {
    const data = await api("/api/v1/snapshot?include=weather,messages,todos,telemetry", { headers: userHeaders() });
    state.snapshot = data;
    $("snapshotRaw").textContent = JSON.stringify(data, null, 2);
    renderSnapshotSummary();
  } catch (err) {
    $("snapshotRaw").textContent = err.message;
  }
}

async function refreshTelemetry() {
  const device = selectedDevice();
  if (!device) {
    state.telemetry = [];
    renderTelemetryTrends();
    updateHero();
    return renderEmpty("telemetryList", "请选择设备。");
  }
  try {
    const limit = Number($("telemetryLimit").value || 288);
    const data = await api(`/api/v1/devices/${encodeURIComponent(device.id)}/telemetry?limit=${limit}`, { headers: userHeaders() });
    state.telemetry = data;
    renderTelemetryTrends();
    if (!data.length) {
      updateHero();
      renderSelectedDevice();
      return renderEmpty("telemetryList", "暂无遥测。");
    }
    const visibleTelemetry = data.slice(0, telemetryListRenderLimit);
    const hiddenCount = Math.max(0, data.length - visibleTelemetry.length);
    $("telemetryList").innerHTML = visibleTelemetry.map((t, index) => `
        <div class="item">
          <div class="item-row">
            <div class="item-title">#${t.id} seq ${t.sequence}</div>
            <div class="item-actions">
              <span class="pill">${formatDate(t.received_at)}</span>
              <button class="icon-button" title="查看详情" data-telemetry-index="${index}">i</button>
            </div>
          </div>
          <div class="muted">battery ${t.power?.battery?.percentage ?? "-"}% · temp ${t.environment?.shtc3?.temperature_c ?? "-"}°C</div>
        </div>
      `).join("") + (hiddenCount > 0 ? `<div class="empty">列表仅显示最近 ${telemetryListRenderLimit} 条，趋势图已使用全部 ${data.length} 条。</div>` : "");
    $("telemetryList").querySelectorAll("[data-telemetry-index]").forEach((btn) => {
      btn.onclick = () => openTelemetryModal(Number(btn.dataset.telemetryIndex));
    });
    renderSelectedDevice();
    updateHero();
  } catch (err) {
    renderError("telemetryList", err.message);
  }
}

function openTelemetryModal(index) {
  const payload = state.telemetry[index] ?? {};
  $("telemetryRaw").textContent = JSON.stringify(payload, null, 2);
  $("telemetryModal").classList.add("active");
  $("telemetryModal").setAttribute("aria-hidden", "false");
}

function closeTelemetryModal() {
  $("telemetryModal").classList.remove("active");
  $("telemetryModal").setAttribute("aria-hidden", "true");
}

function selectedDevice() {
  return state.devices.find((d) => d.id === state.selectedDeviceID) || null;
}

function updateHero() {
  const device = selectedDevice();
  $("metricDevices").textContent = state.devices.length;
  $("metricPending").textContent = String(state.messages.filter((item) => item.status === "pending").length);
  $("metricTodos").textContent = state.todos.length;
  $("heroTitle").textContent = device?.name || device?.id || "未选择设备";
  $("heroDeviceID").textContent = "device: " + (device?.id || "-");
  $("heroBound").textContent = device ? "已绑定" : "未绑定";
  $("heroUser").textContent = "user: " + (state.user?.name || state.user?.id || "-");
  $("overviewTitle").textContent = state.user?.name || "等待接入";
  $("overviewSubtitle").textContent = device
    ? `当前聚焦 ${device.name || device.id}，可以直接发送消息、查看遥测和同步快照。`
    : "保存 token 后即可查看用户、设备、消息和同步状态。";
  $("sidebarLastSeen").textContent = formatRelative(device?.last_seen_at);
  $("sidebarSync").textContent = formatRelative(state.telemetry[0]?.received_at || state.weather?.updated_at);
  if (device) $("renameDeviceName").value = device.name || "";
  renderSelectedDevice();
}

function renderSelectedDevice() {
  const device = selectedDevice();
  if (!device) {
    $("selectedDeviceCard").innerHTML = `<div class="empty">请选择设备。</div>`;
    return;
  }
  const latest = state.telemetry[0];
  $("selectedDeviceCard").innerHTML = `
    <div class="detail-card">
      <div class="detail-head">
        <div>
          <h4 class="detail-title">${escapeHTML(device.name || device.id)}</h4>
          <div class="muted mono">${escapeHTML(device.id)}</div>
        </div>
        <span class="pill">${device.bound_at ? "已绑定" : "未绑定"}</span>
      </div>
      <div class="detail-meta">
        <div class="stat-chip">
          <span>最近在线</span>
          <strong>${formatRelative(device.last_seen_at)}</strong>
        </div>
        <div class="stat-chip">
          <span>待处理消息</span>
          <strong>${state.messages.filter((item) => item.status === "pending").length}</strong>
        </div>
        <div class="stat-chip">
          <span>最近遥测</span>
          <strong>${formatRelative(latest?.received_at)}</strong>
        </div>
      </div>
      <div class="data-points">
        <div class="stat-chip">
          <span>电量</span>
          <strong>${latest?.power?.battery?.percentage != null ? `${Math.round(latest.power.battery.percentage)}%` : "-"}</strong>
        </div>
        <div class="stat-chip">
          <span>温度</span>
          <strong>${latest?.environment?.shtc3?.temperature_c != null ? `${latest.environment.shtc3.temperature_c}°C` : "-"}</strong>
        </div>
        <div class="stat-chip">
          <span>网络</span>
          <strong>${latest?.network?.wifi_connected ? escapeHTML(latest.network.ssid || "Wi-Fi") : "离线"}</strong>
        </div>
        <div class="stat-chip">
          <span>存储</span>
          <strong>${latest?.storage?.sd_card_present ? `${latest.storage.sd_card_used_mb}/${latest.storage.sd_card_total_mb} MB` : "-"}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderMessageSummary() {
  const total = state.messages.length;
  const pending = state.messages.filter((item) => item.status === "pending").length;
  const acked = state.messages.filter((item) => item.status === "acked").length;
  $("messageSummary").innerHTML = `
    <div class="stat-chip"><span>总数</span><strong>${total}</strong></div>
    <div class="stat-chip"><span>待确认</span><strong>${pending}</strong></div>
    <div class="stat-chip"><span>已确认</span><strong>${acked}</strong></div>
  `;
}

function renderTodoSummary() {
  const counts = [0, 0, 0];
  state.todos.forEach((item) => {
    if (counts[item.status] != null) counts[item.status] += 1;
  });
  $("todoSummary").innerHTML = `
    <div class="stat-chip"><span>全部</span><strong>${state.todos.length}</strong></div>
    <div class="stat-chip"><span>未完成</span><strong>${counts[0]}</strong></div>
    <div class="stat-chip"><span>进行中</span><strong>${counts[1]}</strong></div>
    <div class="stat-chip"><span>已完成</span><strong>${counts[2]}</strong></div>
  `;
}

function renderWeatherForecast() {
  const hourly = state.weather?.hourly || [];
  const daily = state.weather?.daily || [];
  const items = hourly.slice(0, 3).map((item) => `
    <div class="forecast-card">
      <strong>${formatClock(item.time)}</strong>
      <div>${escapeHTML(item.condition || "-")}</div>
      <div class="muted">${Number(item.temperature || 0).toFixed(0)}° · 湿度 ${item.humidity ?? "-"}</div>
    </div>
  `).join("") + daily.slice(0, 2).map((item) => `
    <div class="forecast-card">
      <strong>${escapeHTML(item.date || "-")}</strong>
      <div>${escapeHTML(item.condition_day || "-")} / ${escapeHTML(item.condition_night || "-")}</div>
      <div class="muted">${Number(item.temperature_min || 0).toFixed(0)}° - ${Number(item.temperature_max || 0).toFixed(0)}°</div>
    </div>
  `).join("");
  $("weatherForecast").innerHTML = items || "";
}

function renderSnapshotSummary() {
  const snapshot = state.snapshot;
  if (!snapshot) {
    $("snapshotSummary").innerHTML = "";
    return;
  }
  $("snapshotSummary").innerHTML = `
    <div class="stat-chip"><span>消息</span><strong>${snapshot.messages?.length || 0}</strong></div>
    <div class="stat-chip"><span>TODO</span><strong>${snapshot.todos?.length || 0}</strong></div>
    <div class="stat-chip"><span>遥测</span><strong>${snapshot.telemetry?.length || 0}</strong></div>
    <div class="stat-chip"><span>天气</span><strong>${escapeHTML(snapshot.weather?.condition || "-")}</strong></div>
  `;
}

function renderTelemetryTrends() {
  const rows = [...state.telemetry].reverse();
  const latest = state.telemetry[0];
  const battery = rows.map((item) => dataPoint(item, item.power?.battery?.percentage));
  const temperature = rows.map((item) => dataPoint(item, item.environment?.shtc3?.temperature_c));
  const humidity = rows.map((item) => dataPoint(item, item.environment?.shtc3?.humidity_rh));
  const voltage = latest?.power?.battery?.voltage_mv;
  const rssi = latest?.network?.rssi_dbm;
  const heap = latest?.system?.free_heap_bytes;

  $("batteryTrendValue").textContent = latest?.power?.battery?.percentage != null
    ? `${Math.round(latest.power.battery.percentage)}%`
    : "-";
  $("temperatureTrendValue").textContent = latest?.environment?.shtc3?.temperature_c != null
    ? `${latest.environment.shtc3.temperature_c}°C`
    : "-";
  $("humidityTrendValue").textContent = latest?.environment?.shtc3?.humidity_rh != null
    ? `${latest.environment.shtc3.humidity_rh}%`
    : "-";

  $("telemetrySummary").innerHTML = `
    <div class="stat-chip"><span>样本</span><strong>${state.telemetry.length}</strong></div>
    <div class="stat-chip"><span>电压</span><strong>${voltage != null ? `${voltage} mV` : "-"}</strong></div>
    <div class="stat-chip"><span>Wi-Fi</span><strong>${rssi != null ? `${rssi} dBm` : "-"}</strong></div>
    <div class="stat-chip"><span>堆内存</span><strong>${heap != null ? formatBytes(heap) : "-"}</strong></div>
  `;

  $("batteryChart").innerHTML = renderLineChart(battery, {
    color: "#0f7b5f",
    fill: "#0f7b5f",
    suffix: "%",
    fixedMin: 0,
    fixedMax: 100
  });
  $("temperatureChart").innerHTML = renderLineChart(temperature, {
    color: "#c4512d",
    fill: "#c4512d",
    suffix: "°C"
  });
  $("humidityChart").innerHTML = renderLineChart(humidity, {
    color: "#2369a6",
    fill: "#2369a6",
    suffix: "%"
  });
}

function dataPoint(item, value) {
  return {
    value: Number.isFinite(Number(value)) ? Number(value) : null,
    time: item.received_at || item.report_timestamp
  };
}

function renderLineChart(points, options) {
  const valid = points.filter((point) => point.value != null);
  if (valid.length < 2) return `<div class="empty">暂无足够数据。</div>`;

  const width = 520;
  const height = 160;
  const pad = { top: 14, right: 14, bottom: 26, left: 38 };
  const values = valid.map((point) => point.value);
  let min = options.fixedMin ?? Math.min(...values);
  let max = options.fixedMax ?? Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const xStep = valid.length > 1 ? (width - pad.left - pad.right) / (valid.length - 1) : 0;
  const coords = valid.map((point, index) => {
    const x = pad.left + index * xStep;
    const y = pad.top + (1 - (point.value - min) / span) * (height - pad.top - pad.bottom);
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(2)} ${height - pad.bottom} L ${coords[0].x.toFixed(2)} ${height - pad.bottom} Z`;
  const firstTime = formatClock(coords[0].time);
  const lastTime = formatClock(coords[coords.length - 1].time);
  const latest = coords[coords.length - 1];

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="telemetry trend chart">
      <line class="trend-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      <line class="trend-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <text class="trend-label" x="4" y="${pad.top + 4}">${formatMetric(max, options.suffix)}</text>
      <text class="trend-label" x="4" y="${height - pad.bottom + 4}">${formatMetric(min, options.suffix)}</text>
      <text class="trend-label" x="${pad.left}" y="${height - 7}">${escapeHTML(firstTime)}</text>
      <text class="trend-label" x="${width - pad.right}" y="${height - 7}" text-anchor="end">${escapeHTML(lastTime)}</text>
      <path class="trend-area" d="${area}" fill="${options.fill}"></path>
      <path class="trend-line" d="${line}" stroke="${options.color}"></path>
      <circle class="trend-dot" cx="${latest.x.toFixed(2)}" cy="${latest.y.toFixed(2)}" r="4" fill="${options.color}"></circle>
    </svg>
  `;
}

function formatMetric(value, suffix) {
  const precision = Math.abs(value) >= 100 ? 0 : 1;
  return `${Number(value).toFixed(precision)}${suffix || ""}`;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderEmpty(id, text) {
  $(id).innerHTML = `<div class="empty">${escapeHTML(text)}</div>`;
}

function renderError(id, text) {
  $(id).innerHTML = `<div class="notice error">${escapeHTML(text)}</div>`;
}

function notice(id, text, type) {
  const el = $(id);
  el.className = "notice " + (type || "");
  el.textContent = text;
}

function log(value) {
  $("rawLog").textContent = JSON.stringify(value, null, 2);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatClock(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function todoStatusLabel(status) {
  return ["未完成", "正在完成", "已完成"][status] || "未知状态";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/`/g, "&#96;");
}

init();
