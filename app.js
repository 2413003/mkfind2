const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
const TABLE_NAME = "reports";
const MK_CENTER = [52.0406, -0.7594];

const FALLBACK = [
  {
    id: "m1",
    kind: "pet",
    title: "Black cat",
    detail: "Green collar",
    lat: 52.042,
    lng: -0.767,
    seen_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: "m2",
    kind: "item",
    title: "Blue backpack",
    detail: "Campbell Park",
    lat: 52.037,
    lng: -0.742,
    seen_at: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
  },
  {
    id: "m3",
    kind: "person",
    title: "Teen boy",
    detail: "Red jacket",
    lat: 52.052,
    lng: -0.774,
    seen_at: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
];

const state = {
  userLoc: null,
  radiusKm: Number(localStorage.getItem("mkfind.radius") || 8),
  kind: localStorage.getItem("mkfind.kind") || "all",
  rows: [],
  markers: new Map(),
  selectedId: null,
  knownIds: new Set(),
  hasSupabase: SUPABASE_URL.includes(".supabase.co") && !SUPABASE_ANON_KEY.startsWith("YOUR_"),
};

const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true,
}).setView(MK_CENTER, 13);

L.control
  .zoom({
    position: "bottomright",
  })
  .addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const userMarker = L.circleMarker(MK_CENTER, {
  radius: 9,
  fillColor: "#1a73e8",
  color: "#ffffff",
  weight: 3,
  fillOpacity: 0.95,
});
let radiusCircle = null;

const els = {
  results: document.getElementById("results"),
  radius: document.getElementById("radius"),
  radiusValue: document.getElementById("radiusValue"),
  chips: [...document.querySelectorAll(".chip")],
  centerBtn: document.getElementById("centerBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  notifyBtn: document.getElementById("notifyBtn"),
};

els.radius.value = String(state.radiusKm);
setRadiusLabel();
setChipState();
els.notifyBtn.classList.toggle("active", localStorage.getItem("mkfind.notifications") === "on");

const supabase = state.hasSupabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

boot();

async function boot() {
  await locateUser();
  await loadReports();
  paint();
  connectRealtime();
}

async function locateUser() {
  const savedLat = Number(localStorage.getItem("mkfind.lat"));
  const savedLng = Number(localStorage.getItem("mkfind.lng"));
  if (!Number.isNaN(savedLat) && !Number.isNaN(savedLng)) {
    state.userLoc = [savedLat, savedLng];
  }

  if (!navigator.geolocation) {
    setDefaultLoc();
    return;
  }

  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLoc = [pos.coords.latitude, pos.coords.longitude];
        localStorage.setItem("mkfind.lat", String(pos.coords.latitude));
        localStorage.setItem("mkfind.lng", String(pos.coords.longitude));
        resolve();
      },
      () => {
        if (!state.userLoc) setDefaultLoc();
        resolve();
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });
}

function setDefaultLoc() {
  state.userLoc = [...MK_CENTER];
}

async function loadReports() {
  if (!supabase) {
    state.rows = FALLBACK;
    return;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, kind, title, detail, lat, lng, seen_at")
    .order("seen_at", { ascending: false })
    .limit(300);

  if (error || !data) {
    state.rows = FALLBACK;
    state.knownIds = new Set(state.rows.map((row) => String(row.id)));
    return;
  }
  maybeNotifyForNew(data);
  state.rows = data;
}

function paint() {
  const loc = state.userLoc || MK_CENTER;
  userMarker.setLatLng(loc).addTo(map);

  if (radiusCircle) map.removeLayer(radiusCircle);
  radiusCircle = L.circle(loc, {
    radius: state.radiusKm * 1000,
    color: "#1a73e8",
    fillColor: "#1a73e8",
    fillOpacity: 0.08,
    weight: 1.5,
  }).addTo(map);

  const rows = filteredRows();
  renderMarkers(rows);
  renderList(rows);
}

function filteredRows() {
  const [lat, lng] = state.userLoc || MK_CENTER;
  return state.rows
    .filter((row) => state.kind === "all" || row.kind === state.kind)
    .map((row) => ({
      ...row,
      distanceKm: haversine(lat, lng, Number(row.lat), Number(row.lng)),
    }))
    .filter((row) => row.distanceKm <= state.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function renderMarkers(rows) {
  const idsNow = new Set(rows.map((r) => String(r.id)));
  for (const [id, marker] of state.markers.entries()) {
    if (!idsNow.has(id)) {
      map.removeLayer(marker);
      state.markers.delete(id);
    }
  }

  rows.forEach((row) => {
    const key = String(row.id);
    const color = row.kind === "pet" ? "#20a464" : row.kind === "person" ? "#ff8b2d" : "#4f7cff";
    let marker = state.markers.get(key);
    if (!marker) {
      marker = L.circleMarker([row.lat, row.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map);

      marker.on("click", () => {
        state.selectedId = key;
        focusListCard(key);
      });

      state.markers.set(key, marker);
    } else {
      marker.setLatLng([row.lat, row.lng]);
    }

    marker.bindPopup(
      `<strong>${clean(row.title)}</strong><br>${clean(row.detail || "")}<br>${row.distanceKm.toFixed(1)} km`
    );
  });
}

function renderList(rows) {
  if (!rows.length) {
    els.results.innerHTML = '<li class="empty">No matches</li>';
    return;
  }

  els.results.innerHTML = rows
    .map((row) => {
      const ago = timeAgo(row.seen_at);
      return `
        <li class="result" data-id="${clean(String(row.id))}">
          <div class="row">
            <span class="tag">${iconFor(row.kind)} ${clean(row.kind)}</span>
            <span class="badge">${row.distanceKm.toFixed(1)} km</span>
          </div>
          <div class="title">${clean(row.title)}</div>
          <div class="meta">${clean(row.detail || "")} · ${ago}</div>
        </li>
      `;
    })
    .join("");

  [...document.querySelectorAll(".result")].forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const row = rows.find((x) => String(x.id) === id);
      if (!row) return;
      state.selectedId = id;
      map.flyTo([row.lat, row.lng], 15, { duration: 0.6 });
      const marker = state.markers.get(id);
      if (marker) marker.openPopup();
      notifyIfEnabled(row);
    });
  });
}

function focusListCard(id) {
  const target = document.querySelector(`.result[data-id="${CSS.escape(id)}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], {
    duration: 220,
  });
}

function setRadiusLabel() {
  els.radiusValue.textContent = `${state.radiusKm} km`;
}

function setChipState() {
  els.chips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.type === state.kind);
  });
}

function connectRealtime() {
  if (!supabase) return;
  supabase
    .channel("mk-find-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE_NAME },
      async () => {
        await loadReports();
        paint();
      }
    )
    .subscribe();
}

function maybeNotifyForNew(nextRows) {
  const prev = state.knownIds;
  const currentIds = new Set(nextRows.map((row) => String(row.id)));
  state.knownIds = currentIds;

  if (!prev.size) return;

  const newcomers = nextRows.filter((row) => !prev.has(String(row.id)));
  if (!newcomers.length) return;

  const [userLat, userLng] = state.userLoc || MK_CENTER;
  newcomers.forEach((row) => {
    const distanceKm = haversine(userLat, userLng, Number(row.lat), Number(row.lng));
    const kindMatch = state.kind === "all" || row.kind === state.kind;
    if (kindMatch && distanceKm <= state.radiusKm) {
      notifyIfEnabled({ ...row, distanceKm });
    }
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toRad(x) {
  return (x * Math.PI) / 180;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function iconFor(kind) {
  if (kind === "pet") return "🐾";
  if (kind === "person") return "🧍";
  return "🎒";
}

function clean(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    const mapChars = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return mapChars[ch] || ch;
  });
}

async function enableNotifications() {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission();
  localStorage.setItem("mkfind.notifications", permission === "granted" ? "on" : "off");
  els.notifyBtn.classList.toggle("active", permission === "granted");
}

function notifyIfEnabled(row) {
  const enabled = localStorage.getItem("mkfind.notifications") === "on";
  if (!enabled || Notification.permission !== "granted") return;
  new Notification("MK Find", {
    body: `${row.title} · ${row.distanceKm.toFixed(1)} km`,
    tag: `mkfind-${row.id}`,
  });
}

els.radius.addEventListener("input", (e) => {
  state.radiusKm = Number(e.target.value);
  localStorage.setItem("mkfind.radius", String(state.radiusKm));
  setRadiusLabel();
  paint();
});

els.chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.kind = chip.dataset.type;
    localStorage.setItem("mkfind.kind", state.kind);
    setChipState();
    paint();
  });
});

els.centerBtn.addEventListener("click", () => {
  const loc = state.userLoc || MK_CENTER;
  map.flyTo(loc, 14, { duration: 0.5 });
});

els.refreshBtn.addEventListener("click", async () => {
  await loadReports();
  paint();
});

els.notifyBtn.addEventListener("click", enableNotifications);
