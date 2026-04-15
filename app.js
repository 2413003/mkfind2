const SUPABASE_URL = "https://hubwwdbecarttljomhpn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Ynd3ZGJlY2FydHRsam9taHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDg2MTMsImV4cCI6MjA4ODk4NDYxM30.ZQxtB_VobUOt28wIKUPvKsrfx1QhB-cOhgFMzaCmxSo";
const TABLE_NAME = "mk_find_hubwwdbecarttljomhpn_reports";
const STORAGE_BUCKET = "mk-find-hubwwdbecarttljomhpn-media";
const LISTING_REPORTS_TABLE = "mk_find_hubwwdbecarttljomhpn_listing_reports";
const MK_CENTER = [52.0406, -0.7594];

const FALLBACK = [
  {
    id: "m1",
    kind: "pet",
    post_type: "lost",
    status: "open",
    title: "Black cat",
    detail: "Green collar",
    lat: 52.042,
    lng: -0.767,
    seen_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: "m2",
    kind: "item",
    post_type: "lost",
    status: "open",
    title: "Blue backpack",
    detail: "Campbell Park",
    lat: 52.037,
    lng: -0.742,
    seen_at: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
  },
  {
    id: "m3",
    kind: "person",
    post_type: "lost",
    status: "open",
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
  feedType: localStorage.getItem("mkfind.feedType") || "lost",
  kind: localStorage.getItem("mkfind.kind") || "all",
  status: localStorage.getItem("mkfind.status") || "open",
  sort: localStorage.getItem("mkfind.sort") || "nearest",
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
    postType: "lost",
    lat: null,
    lng: null,
    address: "",
    files: [],
    pickerMap: null,
    pickerMarker: null,
  },
  reportDraft: {
    listingId: null,
    reason: "spam",
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
  brandTitle: document.getElementById("brandTitle"),
  results: document.getElementById("results"),
  radius: document.getElementById("radius"),
  radiusValue: document.getElementById("radiusValue"),
  filtersPanel: document.getElementById("filtersPanel"),
  sortPanel: document.getElementById("sortPanel"),
  controlsBackdrop: document.getElementById("controlsBackdrop"),
  toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
  toggleSortBtn: document.getElementById("toggleSortBtn"),
  chips: [...document.querySelectorAll(".chip")],
  postFilterChips: [...document.querySelectorAll(".post-filter-chip")],
  statusChips: [...document.querySelectorAll(".status-chip")],
  sortChips: [...document.querySelectorAll(".sort-chip")],
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
  postChips: [...document.querySelectorAll(".post-chip")],
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
  contactNameInput: document.getElementById("contactNameInput"),
  contactMethodInput: document.getElementById("contactMethodInput"),
  contactValueInput: document.getElementById("contactValueInput"),
  reportModal: document.getElementById("reportModal"),
  reportBackdrop: document.getElementById("reportBackdrop"),
  reportForm: document.getElementById("reportForm"),
  closeReportBtn: document.getElementById("closeReportBtn"),
  reportReasonChips: [...document.querySelectorAll(".report-reason-chip")],
  reportDetailInput: document.getElementById("reportDetailInput"),
  toast: document.getElementById("toast"),
};

els.radius.value = String(state.radiusKm);
setRadiusLabel();
setPostFilterChipState();
setChipState();
setStatusChipState();
setSortChipState();
setBrandTitle();
els.notifyBtn.classList.toggle("active", localStorage.getItem("mkfind.notifications") === "on");

const supabase = state.hasSupabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

boot();

async function boot() {
  await locateUser();
  // Centre main map on user if they are within MK (≤ 20 km of centre)
  if (state.userLoc) {
    const distToMk = haversine(state.userLoc[0], state.userLoc[1], MK_CENTER[0], MK_CENTER[1]);
    if (distToMk <= 20) {
      map.setView(state.userLoc, 13);
    }
  }
  await loadReports();
  paint();
  applyIncomingLink();
  connectRealtime();
}

function applyIncomingLink() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("l");
  const id = params.get("id");
  let row = null;
  if (code) row = state.rows.find((x) => String(x.short_code || "") === code) || null;
  if (!row && id) row = state.rows.find((x) => String(x.id) === id) || null;
  if (!row) return;
  map.flyTo([row.lat, row.lng], 15, { duration: 0.5 });
  state.selectedId = String(row.id);
  focusListCard(String(row.id));
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
    .select("*")
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
  const rows = state.rows
    .filter((row) => (row.post_type || "lost") === state.feedType)
    .filter((row) => state.kind === "all" || row.kind === state.kind)
    .filter((row) => (state.status === "all" ? true : (row.status || "open") === state.status))
    .map((row) => ({
      ...row,
      distanceKm: haversine(lat, lng, Number(row.lat), Number(row.lng)),
    }))
    .filter((row) => row.distanceKm <= state.radiusKm);

  if (state.sort === "latest") {
    rows.sort((a, b) => new Date(b.seen_at).getTime() - new Date(a.seen_at).getTime());
  } else {
    rows.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  return rows;
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
      const contactText = contactLabel(row);
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
          <div class="meta">${clean(row.detail || "")} · ${ago}${contactText ? ` · ${clean(contactText)}` : ""}</div>
          ${mediaBlock}
          <div class="card-menu-wrap">
            <button class="card-dots-btn" data-dots-id="${clean(String(row.id))}" type="button" aria-label="Options">⋯</button>
            <div class="card-menu hidden" data-menu-id="${clean(String(row.id))}">
              <button class="card-menu-item contact-open" data-contact-id="${clean(String(row.id))}" type="button">Contact</button>
              <button class="card-menu-item share-open" data-share-id="${clean(String(row.id))}" type="button">Share</button>
              <button class="card-menu-item resolve-open" data-resolve-id="${clean(String(row.id))}" type="button">Mark as found</button>
              <button class="card-menu-item flag-open" data-flag-id="${clean(String(row.id))}" type="button">Report</button>
            </div>
          </div>
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

  // Media gallery buttons (still inline, not in menu)
  [...document.querySelectorAll(".media-open")].forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.mediaId;
      const row = rows.find((x) => String(x.id) === id);
      if (!row) return;
      openGallery(getMediaUrls(row), 0);
    });
  });

  // 3-dot menu toggle — menus are position:fixed so coords must be set from getBoundingClientRect
  [...document.querySelectorAll(".card-dots-btn")].forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.dotsId;
      const menu = document.querySelector(`.card-menu[data-menu-id="${CSS.escape(id)}"]`);
      if (!menu) return;
      const isOpen = !menu.classList.contains("hidden");
      document.querySelectorAll(".card-menu:not(.hidden)").forEach((m) => m.classList.add("hidden"));
      if (!isOpen) {
        const rect = btn.getBoundingClientRect();
        menu.style.right = `${window.innerWidth - rect.right}px`;
        menu.style.top = "";
        menu.classList.remove("hidden");
        const menuH = menu.offsetHeight;
        const topAbove = rect.top - menuH - 6;
        menu.style.top = topAbove >= 8 ? `${topAbove}px` : `${rect.bottom + 6}px`;
      }
    });
  });

  // Close card menus when clicking anywhere outside them
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".card-menu") && !ev.target.closest(".card-dots-btn")) {
      closeAllCardMenus();
    }
  }, { capture: true });

  // Close card menus when the results list scrolls (menu would drift from its button)
  els.results.addEventListener("scroll", closeAllCardMenus, { passive: true });

  // Card menu item handlers
  [...document.querySelectorAll(".card-menu-item.share-open")].forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      closeAllCardMenus();
      const row = rows.find((x) => String(x.id) === btn.dataset.shareId);
      if (!row) return;
      await shareListing(row);
    });
  });

  [...document.querySelectorAll(".card-menu-item.contact-open")].forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      closeAllCardMenus();
      const row = rows.find((x) => String(x.id) === btn.dataset.contactId);
      if (!row) return;
      await contactListing(row);
    });
  });

  [...document.querySelectorAll(".card-menu-item.resolve-open")].forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      closeAllCardMenus();
      const row = rows.find((x) => String(x.id) === btn.dataset.resolveId);
      if (!row) return;
      await markResolved(row);
    });
  });

  [...document.querySelectorAll(".card-menu-item.flag-open")].forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      closeAllCardMenus();
      const row = rows.find((x) => String(x.id) === btn.dataset.flagId);
      if (!row) return;
      openReport(row);
    });
  });
}

function closeAllCardMenus() {
  document.querySelectorAll(".card-menu:not(.hidden)").forEach((m) => m.classList.add("hidden"));
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
    if (!chip.dataset.type) return;
    chip.classList.toggle("active", chip.dataset.type === state.kind);
  });
}

function setPostFilterChipState() {
  els.postFilterChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.feedType === state.feedType);
  });
}

function setStatusChipState() {
  els.statusChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.status === state.status);
  });
}

function setSortChipState() {
  els.sortChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.sort === state.sort);
  });
}

function setBrandTitle() {
  els.brandTitle.textContent = "MK Lost and Found";
}

function closeControlPanels() {
  els.filtersPanel.classList.add("hidden");
  els.sortPanel.classList.add("hidden");
  els.controlsBackdrop.classList.add("hidden");
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
  const contactText = contactLabel(row);
  const mediaBtn = media.length
    ? `<br><button type="button" class="media-open popup-media-open" data-popup-media-id="${clean(String(row.id))}">Media</button>`
    : "";
  const gmapsUrl = `https://www.google.com/maps?q=${Number(row.lat).toFixed(6)},${Number(row.lng).toFixed(6)}`;
  return `<strong>${clean(row.title)}</strong><br>${clean(row.detail || "")}${contactText ? `<br>${clean(contactText)}` : ""}<br>${clean(row.post_type || "lost")} · ${clean(row.status || "open")}<br>${row.distanceKm.toFixed(1)} km${mediaBtn}<br><button type="button" class="media-open popup-contact-open" data-popup-contact-id="${clean(String(row.id))}">Contact</button> <button type="button" class="media-open popup-share-open" data-popup-share-id="${clean(String(row.id))}">Share</button> <button type="button" class="media-open popup-resolve-open" data-popup-resolve-id="${clean(String(row.id))}">Found</button> <button type="button" class="media-open popup-flag-open" data-popup-flag-id="${clean(String(row.id))}">Report</button> <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="media-open" style="display:inline-block;text-decoration:none;">Maps</a>`;
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

function makeShortCode() {
  return Math.random().toString(36).slice(2, 8);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 1800);
}

function mapSnapshotUrl(row) {
  const lat = Number(row.lat).toFixed(5);
  const lng = Number(row.lng).toFixed(5);
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=900x500&markers=${lat},${lng},red-pushpin`;
}

async function ensureShortCode(row) {
  if (row.short_code) return row.short_code;
  const localKey = `mkfind.short.${row.id}`;
  const localExisting = localStorage.getItem(localKey);
  if (localExisting) return localExisting;

  const code = makeShortCode();
  if (!supabase) {
    localStorage.setItem(localKey, code);
    return code;
  }

  const { error } = await supabase.from(TABLE_NAME).update({ short_code: code }).eq("id", row.id);
  if (error) {
    localStorage.setItem(localKey, code);
    return code;
  }
  row.short_code = code;
  return code;
}

async function shareListing(row) {
  let link = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(row.id)}`;
  const code = await ensureShortCode(row);
  if (code) link = `${window.location.origin}${window.location.pathname}?l=${code}`;
  const snapshot = mapSnapshotUrl(row);
  const text = `${row.title} · ${row.post_type || "lost"} · ${row.status || "open"}\n${link}\n${snapshot}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "MK Find", text, url: link });
      showToast("Shared");
      return;
    } catch (_err) {
      // fallback below
    }
  }
  await navigator.clipboard.writeText(text);
  showToast("Share copied");
}

function contactLabel(row) {
  const method = row.contact_method || "contact";
  const value = row.contact_value || row.contact || "";
  if (!value) return "";
  return `${method}: ${value}`;
}

async function contactListing(row) {
  const value = (row.contact_value || row.contact || "").trim();
  const method = (row.contact_method || "").toLowerCase();
  if (!value) {
    showToast("No contact details");
    return;
  }
  if (method === "email") {
    window.location.href = `mailto:${value}`;
    return;
  }
  if (method === "phone" || method === "whatsapp") {
    const cleaned = value.replace(/[^\d+]/g, "");
    window.location.href = method === "whatsapp" ? `https://wa.me/${cleaned.replace("+", "")}` : `tel:${cleaned}`;
    return;
  }
  await navigator.clipboard.writeText(value);
  showToast("Contact copied");
}

async function markResolved(row) {
  if ((row.status || "open") === "resolved") return;
  const ok = window.confirm("Mark this listing as found / resolved?");
  if (!ok) return;
  if (!supabase) {
    row.status = "resolved";
    paint();
    showToast("Marked resolved");
    return;
  }
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) {
    row.status = "resolved";
    paint();
    showToast("Resolved locally");
    return;
  }
  await loadReports();
  paint();
  showToast("Marked resolved");
}

function openReport(row) {
  state.reportDraft.listingId = row.id;
  state.reportDraft.reason = "spam";
  els.reportDetailInput.value = "";
  els.reportReasonChips.forEach((chip) => chip.classList.toggle("active", chip.dataset.reason === "spam"));
  els.reportModal.classList.remove("hidden");
  els.reportModal.setAttribute("aria-hidden", "false");
}

function closeReport() {
  els.reportModal.classList.add("hidden");
  els.reportModal.setAttribute("aria-hidden", "true");
}

async function reportListing(listingId, reason, detail) {
  if (!supabase) {
    showToast("Reported");
    return;
  }
  const { error } = await supabase.from(LISTING_REPORTS_TABLE).insert({
    listing_id: listingId,
    reason: `${reason}${detail ? `: ${detail}` : ""}`.trim().slice(0, 500),
  });
  showToast(error ? "Report failed" : "Reported");
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
  state.compose.postType = "lost";
  state.compose.lat = Number(loc[0]);
  state.compose.lng = Number(loc[1]);
  state.compose.address = "";
  state.compose.files = [];

  els.composeForm.reset();
  els.lastSeenInput.value = toInputDate();
  els.addressInput.value = "";
  els.mediaPreview.innerHTML = "";
  setComposeKindUI();
  setComposeTypeUI();
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
  clearFieldErrors();
}

function setComposeKindUI() {
  els.kindChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.kind === state.compose.kind);
  });
}

function setComposeTypeUI() {
  els.postChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.postType === state.compose.postType);
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
      post_type: payload.post_type || "lost",
      status: payload.status || "open",
      title: payload.title,
      detail: payload.detail,
      lat: payload.lat,
      lng: payload.lng,
      seen_at: payload.seen_at,
      address: payload.address || "",
      media_urls: payload.media_urls || [],
      contact_name: payload.contact_name || "",
      contact_method: payload.contact_method || "",
      contact_value: payload.contact_value || "",
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
      post_type: payload.post_type || "lost",
      status: payload.status || "open",
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

els.titleInput.addEventListener("input", () => {
  document.getElementById("ferr-titleInput")?.remove();
  els.titleInput.classList.remove("invalid");
});

els.contactValueInput.addEventListener("input", () => {
  document.getElementById("ferr-contactValueInput")?.remove();
  els.contactValueInput.classList.remove("invalid");
});

els.radius.addEventListener("input", (e) => {
  state.radiusKm = Number(e.target.value);
  localStorage.setItem("mkfind.radius", String(state.radiusKm));
  setRadiusLabel();
  paint();
});

els.radius.addEventListener("change", () => {
  closeControlPanels();
});

els.chips.forEach((chip) => {
  if (!chip.dataset.type) return;
  chip.addEventListener("click", () => {
    state.kind = chip.dataset.type;
    localStorage.setItem("mkfind.kind", state.kind);
    setChipState();
    paint();
    closeControlPanels();
  });
});

els.postFilterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.feedType = chip.dataset.feedType;
    localStorage.setItem("mkfind.feedType", state.feedType);
    setPostFilterChipState();
    setBrandTitle();
    paint();
    closeControlPanels();
  });
});

els.statusChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.status = chip.dataset.status;
    localStorage.setItem("mkfind.status", state.status);
    setStatusChipState();
    paint();
    closeControlPanels();
  });
});

els.sortChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.sort = chip.dataset.sort;
    localStorage.setItem("mkfind.sort", state.sort);
    setSortChipState();
    paint();
    closeControlPanels();
  });
});

els.toggleFiltersBtn.addEventListener("click", () => {
  const opening = els.filtersPanel.classList.contains("hidden");
  els.filtersPanel.classList.toggle("hidden");
  if (opening) els.sortPanel.classList.add("hidden");
  const anyOpen = !els.filtersPanel.classList.contains("hidden") || !els.sortPanel.classList.contains("hidden");
  els.controlsBackdrop.classList.toggle("hidden", !anyOpen);
});

els.toggleSortBtn.addEventListener("click", () => {
  const opening = els.sortPanel.classList.contains("hidden");
  els.sortPanel.classList.toggle("hidden");
  if (opening) els.filtersPanel.classList.add("hidden");
  const anyOpen = !els.filtersPanel.classList.contains("hidden") || !els.sortPanel.classList.contains("hidden");
  els.controlsBackdrop.classList.toggle("hidden", !anyOpen);
});

els.controlsBackdrop.addEventListener("click", closeControlPanels);

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
els.reportBackdrop.addEventListener("click", closeReport);
els.closeReportBtn.addEventListener("click", closeReport);

els.kindChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.compose.kind = chip.dataset.kind;
    setComposeKindUI();
  });
});

els.postChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.compose.postType = chip.dataset.postType;
    setComposeTypeUI();
  });
});

els.reportReasonChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.reportDraft.reason = chip.dataset.reason;
    els.reportReasonChips.forEach((x) => x.classList.toggle("active", x === chip));
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

function showFieldError(inputEl, message, anchorEl) {
  const anchor = anchorEl || inputEl;
  const errId = `ferr-${inputEl.id}`;
  document.getElementById(errId)?.remove();
  inputEl.classList.add("invalid");
  const span = document.createElement("span");
  span.className = "field-error";
  span.id = errId;
  span.textContent = message;
  anchor.insertAdjacentElement("afterend", span);
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => el.remove());
  document.querySelectorAll(".field-input.invalid").forEach((el) => el.classList.remove("invalid"));
  els.pickedMeta.style.color = "";
}

els.composeForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  clearFieldErrors();

  let hasErrors = false;

  const title = els.titleInput.value.trim();
  if (!title) {
    showFieldError(els.titleInput, "Title is required");
    hasErrors = true;
  }

  if (state.compose.lat == null || state.compose.lng == null) {
    els.pickedMeta.textContent = "Tap the map to set a location";
    els.pickedMeta.style.color = "#d32f2f";
    hasErrors = true;
  }

  const contactValue = els.contactValueInput.value.trim();
  const contactMethod = els.contactMethodInput.value;
  if (contactValue) {
    const contactRow = els.contactValueInput.closest(".field-row");
    if (contactMethod === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
        showFieldError(els.contactValueInput, "Enter a valid email address", contactRow);
        hasErrors = true;
      }
    } else if (contactMethod === "phone" || contactMethod === "whatsapp") {
      if (!/^[\d\s\+\-\(\)]{7,}$/.test(contactValue)) {
        showFieldError(els.contactValueInput, "Enter a valid phone number (digits only, min 7)", contactRow);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) return;

  els.saveComposeBtn.disabled = true;
  const initialSaveText = els.saveComposeBtn.textContent;
  els.saveComposeBtn.textContent = "...";

  try {
    const mediaUrls = await uploadMedia(state.compose.files);
    const payload = {
      kind: state.compose.kind,
      post_type: state.compose.postType,
      status: "open",
      title,
      detail: els.detailInput.value.trim() || null,
      lat: state.compose.lat,
      lng: state.compose.lng,
      seen_at: els.lastSeenInput.value ? new Date(els.lastSeenInput.value).toISOString() : new Date().toISOString(),
      address: state.compose.address || els.addressInput.value.trim() || null,
      media_urls: mediaUrls,
      contact_name: els.contactNameInput.value.trim() || null,
      contact_method: els.contactMethodInput.value || null,
      contact_value: els.contactValueInput.value.trim() || null,
    };

    const ok = await createReport(payload);
    if (ok) closeCompose();
    else els.pickedMeta.textContent = "Save failed";
  } finally {
    els.saveComposeBtn.disabled = false;
    els.saveComposeBtn.textContent = initialSaveText;
  }
});

els.reportForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!state.reportDraft.listingId) return;
  const detail = els.reportDetailInput.value.trim();
  await reportListing(state.reportDraft.listingId, state.reportDraft.reason, detail);
  closeReport();
});

map.on("popupopen", () => {
  const mediaBtn = document.querySelector(".popup-media-open");
  if (mediaBtn) {
    mediaBtn.addEventListener("click", () => {
      const row = state.rows.find((x) => String(x.id) === String(mediaBtn.dataset.popupMediaId));
      if (!row) return;
      openGallery(getMediaUrls(row), 0);
    });
  }

  const shareBtn = document.querySelector(".popup-share-open");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const row = state.rows.find((x) => String(x.id) === String(shareBtn.dataset.popupShareId));
      if (!row) return;
      await shareListing(row);
    });
  }

  const contactBtn = document.querySelector(".popup-contact-open");
  if (contactBtn) {
    contactBtn.addEventListener("click", async () => {
      const row = state.rows.find((x) => String(x.id) === String(contactBtn.dataset.popupContactId));
      if (!row) return;
      await contactListing(row);
    });
  }

  const resolveBtn = document.querySelector(".popup-resolve-open");
  if (resolveBtn) {
    resolveBtn.addEventListener("click", async () => {
      const row = state.rows.find((x) => String(x.id) === String(resolveBtn.dataset.popupResolveId));
      if (!row) return;
      await markResolved(row);
    });
  }

  const flagBtn = document.querySelector(".popup-flag-open");
  if (flagBtn) {
    flagBtn.addEventListener("click", () => {
      const row = state.rows.find((x) => String(x.id) === String(flagBtn.dataset.popupFlagId));
      if (!row) return;
      openReport(row);
    });
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeControlPanels();
  if (ev.key === "Escape") closeReport();
  if (els.galleryModal.classList.contains("hidden")) return;
  if (ev.key === "Escape") closeGallery();
  if (ev.key === "ArrowLeft") stepGallery(-1);
  if (ev.key === "ArrowRight") stepGallery(1);
});
