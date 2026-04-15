const SUPABASE_URL = "https://hubwwdbecarttljomhpn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Ynd3ZGJlY2FydHRsam9taHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDg2MTMsImV4cCI6MjA4ODk4NDYxM30.ZQxtB_VobUOt28wIKUPvKsrfx1QhB-cOhgFMzaCmxSo";
const TABLE_NAME = "mk_find_hubwwdbecarttljomhpn_reports";
const STORAGE_BUCKET = "mk-find-hubwwdbecarttljomhpn-media";
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
  gallery: {
    items: [],
    index: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchActive: false,
  },
  compose: {
    kind: "item",
    lat: null,
    lng: null,
    address: "",
    files: [],
    pickerMap: null,
    pickerMarker: null,
  },
};

const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true,
  attributionControl: false,
}).setView(MK_CENTER, 13);

L.control
  .zoom({
    position: "bottomright",
  })
  .addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  subdomains: "abcd",
}).addTo(map);

const userMarkerHalo = L.circleMarker(MK_CENTER, {
  radius: 18,
  fillColor: "#1a73e8",
  color: "#1a73e8",
  weight: 0,
  fillOpacity: 0.14,
});

const userMarker = L.circleMarker(MK_CENTER, {
  radius: 7,
  fillColor: "#1a73e8",
  color: "#ffffff",
  weight: 2.5,
  fillOpacity: 1,
});
let radiusCircle = null;

const els = {
  results: document.getElementById("results"),
  radius: document.getElementById("radius"),
  radiusValue: document.getElementById("radiusValue"),
  chips: [...document.querySelectorAll(".chip")],
  centerBtn: document.getElementById("centerBtn"),
  addBtn: document.getElementById("addBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  notifyBtn: document.getElementById("notifyBtn"),
  galleryModal: document.getElementById("galleryModal"),
  galleryBackdrop: document.getElementById("galleryBackdrop"),
  galleryCloseBtn: document.getElementById("galleryCloseBtn"),
  galleryPrevBtn: document.getElementById("galleryPrevBtn"),
  galleryNextBtn: document.getElementById("galleryNextBtn"),
  galleryStage: document.getElementById("galleryStage"),
  galleryCount: document.getElementById("galleryCount"),
  composeModal: document.getElementById("composeModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  composeForm: document.getElementById("composeForm"),
  closeComposeBtn: document.getElementById("closeComposeBtn"),
  kindChips: [...document.querySelectorAll(".kind-chip")],
  titleInput: document.getElementById("titleInput"),
  detailInput: document.getElementById("detailInput"),
  lastSeenInput: document.getElementById("lastSeenInput"),
  mediaInput: document.getElementById("mediaInput"),
  mediaPreview: document.getElementById("mediaPreview"),
  addressInput: document.getElementById("addressInput"),
  findAddressBtn: document.getElementById("findAddressBtn"),
  pickerMap: document.getElementById("pickerMap"),
  pickedMeta: document.getElementById("pickedMeta"),
  saveComposeBtn: document.getElementById("saveComposeBtn"),
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
    .select("id, kind, title, detail, lat, lng, seen_at, media_urls")
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
  userMarkerHalo.setLatLng(loc).addTo(map);
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
    let marker = state.markers.get(key);
    if (!marker) {
      marker = L.marker([row.lat, row.lng], {
        icon: createReportIcon(row.kind),
      }).addTo(map);

      marker.on("click", () => {
        state.selectedId = key;
        focusListCard(key);
      });

      state.markers.set(key, marker);
    } else {
      marker.setLatLng([row.lat, row.lng]);
      marker.setIcon(createReportIcon(row.kind));
    }

    marker.bindPopup(
      popupMarkup(row)
    );
  });
}

function createReportIcon(kind) {
  const configByKind = {
    item: { color: "#2b6be8", glyph: "item" },
    pet: { color: "#00a66a", glyph: "pet" },
    person: { color: "#f08a24", glyph: "person" },
  };
  const conf = configByKind[kind] || configByKind.item;
  const glyph = glyphPath(conf.glyph);

  const html = `
    <span class="report-pin-shell">
      <svg class="report-pin-svg" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill="${conf.color}" stroke="#ffffff" stroke-width="2"></circle>
        <path d="${glyph}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </span>
  `;

  return L.divIcon({
    className: "report-pin-shell",
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -16],
  });
}

function glyphPath(kind) {
  if (kind === "pet") {
    return "M12.2 19.3c1.6 0 2.9-1.3 2.9-2.9S13.8 13.5 12.2 13.5s-2.9 1.3-2.9 2.9 1.3 2.9 2.9 2.9zm11.6 0c1.6 0 2.9-1.3 2.9-2.9s-1.3-2.9-2.9-2.9-2.9 1.3-2.9 2.9 1.3 2.9 2.9 2.9zM18 13.2c1.4 0 2.5-1.1 2.5-2.5S19.4 8.2 18 8.2s-2.5 1.1-2.5 2.5 1.1 2.5 2.5 2.5zm0 14.6c-3.5 0-6.4-2-6.4-4.5 0-2.1 2.3-3.8 4.1-2.3 1 .8 1.5 1.2 2.3 1.2s1.3-.4 2.3-1.2c1.8-1.5 4.1.2 4.1 2.3 0 2.5-2.9 4.5-6.4 4.5z";
  }
  if (kind === "person") {
    return "M18 11.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zm0 8.6c2.7 0 5 1.7 5.8 4.1.2.8-.4 1.5-1.2 1.5H13.4c-.8 0-1.4-.7-1.2-1.5.8-2.4 3.1-4.1 5.8-4.1z";
  }
  return "M13.3 11.2h9.4c.8 0 1.4.6 1.4 1.4v10.8c0 .8-.6 1.4-1.4 1.4h-9.4c-.8 0-1.4-.6-1.4-1.4V12.6c0-.8.6-1.4 1.4-1.4zm2.2 3.2h5m-5 3h5m-5 3h3.8";
}

function renderList(rows) {
  if (!rows.length) {
    els.results.innerHTML = '<li class="empty">No matches</li>';
    return;
  }

  els.results.innerHTML = rows
    .map((row) => {
      const ago = timeAgo(row.seen_at);
      const media = getMediaUrls(row);
      const mediaBlock = media.length
        ? `<div class="result-media">${mediaTag(media[0])}</div><button class="media-open" data-media-id="${clean(String(row.id))}" type="button">Media</button>`
        : "";
      return `
        <li class="result" data-id="${clean(String(row.id))}">
          <div class="row">
            <span class="tag">${iconFor(row.kind)} ${clean(row.kind)}</span>
            <span class="badge">${row.distanceKm.toFixed(1)} km</span>
          </div>
          <div class="title">${clean(row.title)}</div>
          <div class="meta">${clean(row.detail || "")} · ${ago}</div>
          ${mediaBlock}
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

  [...document.querySelectorAll(".media-open")].forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.mediaId;
      const row = rows.find((x) => String(x.id) === id);
      if (!row) return;
      openGallery(getMediaUrls(row), 0);
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

function popupMarkup(row) {
  const media = getMediaUrls(row);
  const mediaBtn = media.length
    ? `<br><button type="button" class="media-open popup-media-open" data-popup-media-id="${clean(String(row.id))}">Media</button>`
    : "";
  return `<strong>${clean(row.title)}</strong><br>${clean(row.detail || "")}<br>${row.distanceKm.toFixed(1)} km${mediaBtn}`;
}

function getMediaUrls(row) {
  if (Array.isArray(row.media_urls)) return row.media_urls.filter(Boolean);
  if (!row.media_urls) return [];
  if (typeof row.media_urls === "string") {
    try {
      const parsed = JSON.parse(row.media_urls);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_err) {
      return [];
    }
  }
  return [];
}

function mediaTag(url) {
  const lower = String(url).toLowerCase();
  const isVideo = /\.(mp4|mov|webm|ogg)(\?|$)/.test(lower);
  return isVideo ? `<video src="${clean(url)}" muted playsinline></video>` : `<img src="${clean(url)}" alt="">`;
}

function openGallery(items, index = 0) {
  if (!items.length) return;
  state.gallery.items = items;
  state.gallery.index = Math.max(0, Math.min(index, items.length - 1));
  els.galleryModal.classList.remove("hidden");
  els.galleryModal.setAttribute("aria-hidden", "false");
  renderGallery();
}

function closeGallery() {
  els.galleryModal.classList.add("hidden");
  els.galleryModal.setAttribute("aria-hidden", "true");
  els.galleryStage.innerHTML = "";
}

function stepGallery(dir) {
  if (!state.gallery.items.length) return;
  const max = state.gallery.items.length - 1;
  state.gallery.index = (state.gallery.index + dir + state.gallery.items.length) % (max + 1);
  renderGallery();
}

function renderGallery() {
  const items = state.gallery.items;
  if (!items.length) return;
  const url = items[state.gallery.index];
  els.galleryStage.innerHTML = mediaTag(url);
  els.galleryCount.textContent = `${state.gallery.index + 1} / ${items.length}`;
}

function onGalleryTouchStart(ev) {
  const touch = ev.changedTouches?.[0];
  if (!touch) return;
  state.gallery.touchStartX = touch.clientX;
  state.gallery.touchStartY = touch.clientY;
  state.gallery.touchActive = true;
}

function onGalleryTouchEnd(ev) {
  if (!state.gallery.touchActive) return;
  state.gallery.touchActive = false;
  const touch = ev.changedTouches?.[0];
  if (!touch) return;

  const dx = touch.clientX - state.gallery.touchStartX;
  const dy = touch.clientY - state.gallery.touchStartY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < 42 || absX < absY * 1.2) return;
  if (dx < 0) stepGallery(1);
  else stepGallery(-1);
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

function toInputDate(isoDate) {
  const date = isoDate ? new Date(isoDate) : new Date();
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function openCompose() {
  const loc = state.userLoc || MK_CENTER;
  state.compose.kind = "item";
  state.compose.lat = Number(loc[0]);
  state.compose.lng = Number(loc[1]);
  state.compose.address = "";
  state.compose.files = [];

  els.composeForm.reset();
  els.lastSeenInput.value = toInputDate();
  els.addressInput.value = "";
  els.mediaPreview.innerHTML = "";
  setComposeKindUI();
  updatePickedMeta();
  els.composeModal.classList.remove("hidden");
  els.composeModal.setAttribute("aria-hidden", "false");

  if (!state.compose.pickerMap) {
    state.compose.pickerMap = L.map("pickerMap", {
      zoomControl: false,
      attributionControl: false,
    }).setView(loc, 14);
    L.control.zoom({ position: "bottomright" }).addTo(state.compose.pickerMap);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(state.compose.pickerMap);

    state.compose.pickerMap.on("click", (ev) => {
      setComposePoint(ev.latlng.lat, ev.latlng.lng, true);
    });
  } else {
    state.compose.pickerMap.setView(loc, 14);
  }
  setTimeout(() => state.compose.pickerMap?.invalidateSize(), 40);

  setComposePoint(state.compose.lat, state.compose.lng, false);
}

function closeCompose() {
  els.composeModal.classList.add("hidden");
  els.composeModal.setAttribute("aria-hidden", "true");
}

function setComposeKindUI() {
  els.kindChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.kind === state.compose.kind);
  });
}

function setComposePoint(lat, lng, animate) {
  state.compose.lat = Number(lat);
  state.compose.lng = Number(lng);
  const point = [state.compose.lat, state.compose.lng];

  if (!state.compose.pickerMarker) {
    state.compose.pickerMarker = L.circleMarker(point, {
      radius: 8,
      fillColor: "#1a73e8",
      fillOpacity: 0.95,
      color: "#fff",
      weight: 2,
    }).addTo(state.compose.pickerMap);
  } else {
    state.compose.pickerMarker.setLatLng(point);
  }

  if (animate) {
    state.compose.pickerMap.flyTo(point, Math.max(state.compose.pickerMap.getZoom(), 15), {
      duration: 0.4,
    });
  }
  updatePickedMeta();
}

function updatePickedMeta() {
  if (state.compose.lat == null || state.compose.lng == null) {
    els.pickedMeta.textContent = "Tap map to set last seen";
    return;
  }
  els.pickedMeta.textContent = `${state.compose.lat.toFixed(5)}, ${state.compose.lng.toFixed(5)}`;
}

function renderMediaPreview(files) {
  if (!files.length) {
    els.mediaPreview.innerHTML = "";
    return;
  }
  const nodes = files
    .slice(0, 8)
    .map((file) => {
      const isVideo = file.type.startsWith("video/");
      const url = URL.createObjectURL(file);
      return `<div class="media-chip">${isVideo ? `<video src="${url}" muted></video>` : `<img src="${url}" alt="">`}</div>`;
    })
    .join("");
  els.mediaPreview.innerHTML = nodes;
}

async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query + ", Milton Keynes")}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Lookup failed");
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) throw new Error("No result");
  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    label: data[0].display_name || query,
  };
}

async function uploadMedia(files) {
  if (!supabase || !files.length) return [];
  const urls = [];
  for (const file of files) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) continue;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

async function createReport(payload) {
  if (!supabase) {
    const local = {
      id: `local-${Date.now()}`,
      kind: payload.kind,
      title: payload.title,
      detail: payload.detail,
      lat: payload.lat,
      lng: payload.lng,
      seen_at: payload.seen_at,
      address: payload.address || "",
      media_urls: payload.media_urls || [],
    };
    state.rows = [local, ...state.rows];
    paint();
    return true;
  }

  const { error } = await supabase.from(TABLE_NAME).insert(payload);
  if (error) {
    // Compatibility fallback if optional columns are not added yet.
    const fallbackPayload = {
      kind: payload.kind,
      title: payload.title,
      detail: payload.detail,
      lat: payload.lat,
      lng: payload.lng,
      seen_at: payload.seen_at,
    };
    const { error: fallbackError } = await supabase.from(TABLE_NAME).insert(fallbackPayload);
    if (fallbackError) return false;
  }
  await loadReports();
  paint();
  return true;
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
els.galleryBackdrop.addEventListener("click", closeGallery);
els.galleryCloseBtn.addEventListener("click", closeGallery);
els.galleryPrevBtn.addEventListener("click", () => stepGallery(-1));
els.galleryNextBtn.addEventListener("click", () => stepGallery(1));
els.galleryStage.addEventListener("touchstart", onGalleryTouchStart, { passive: true });
els.galleryStage.addEventListener("touchend", onGalleryTouchEnd, { passive: true });
els.galleryStage.addEventListener("touchcancel", () => {
  state.gallery.touchActive = false;
});
els.addBtn.addEventListener("click", openCompose);
els.modalBackdrop.addEventListener("click", closeCompose);
els.closeComposeBtn.addEventListener("click", closeCompose);

els.kindChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.compose.kind = chip.dataset.kind;
    setComposeKindUI();
  });
});

els.mediaInput.addEventListener("change", () => {
  state.compose.files = [...(els.mediaInput.files || [])].slice(0, 8);
  renderMediaPreview(state.compose.files);
});

els.findAddressBtn.addEventListener("click", async () => {
  const query = els.addressInput.value.trim();
  if (!query) return;
  const oldText = els.findAddressBtn.textContent;
  els.findAddressBtn.textContent = "...";
  try {
    const result = await geocodeAddress(query);
    state.compose.address = result.label;
    setComposePoint(result.lat, result.lng, true);
  } catch (_err) {
    els.pickedMeta.textContent = "Address not found";
  } finally {
    els.findAddressBtn.textContent = oldText;
  }
});

els.composeForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const title = els.titleInput.value.trim();
  if (!title || state.compose.lat == null || state.compose.lng == null) return;

  els.saveComposeBtn.disabled = true;
  const initialSaveText = els.saveComposeBtn.textContent;
  els.saveComposeBtn.textContent = "...";

  try {
    const mediaUrls = await uploadMedia(state.compose.files);
    const payload = {
      kind: state.compose.kind,
      title,
      detail: els.detailInput.value.trim() || null,
      lat: state.compose.lat,
      lng: state.compose.lng,
      seen_at: els.lastSeenInput.value ? new Date(els.lastSeenInput.value).toISOString() : new Date().toISOString(),
      address: state.compose.address || els.addressInput.value.trim() || null,
      media_urls: mediaUrls,
    };

    const ok = await createReport(payload);
    if (ok) closeCompose();
    else els.pickedMeta.textContent = "Save failed";
  } finally {
    els.saveComposeBtn.disabled = false;
    els.saveComposeBtn.textContent = initialSaveText;
  }
});

map.on("popupopen", () => {
  const btn = document.querySelector(".popup-media-open");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const row = state.rows.find((x) => String(x.id) === String(btn.dataset.popupMediaId));
    if (!row) return;
    openGallery(getMediaUrls(row), 0);
  });
});

document.addEventListener("keydown", (ev) => {
  if (els.galleryModal.classList.contains("hidden")) return;
  if (ev.key === "Escape") closeGallery();
  if (ev.key === "ArrowLeft") stepGallery(-1);
  if (ev.key === "ArrowRight") stepGallery(1);
});
