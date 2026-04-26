import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const MAP_WIDTH = 1800;
const MAP_HEIGHT = 2048;
const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
const center = [MAP_HEIGHT / 2, MAP_WIDTH / 2];
const initialZoom = 1;

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 4,
  zoomControl: true,
  attributionControl: false,
  scrollWheelZoom: false
});
map.scrollWheelZoom.disable();

const mapStyleConfig = {
  satellite: "assets/images/map-satelite.png",
  streets: "assets/images/map-streets1.png",
  bw: "assets/images/map-b&w.png"
};

let currentBaseOverlay = L.imageOverlay(mapStyleConfig.streets, bounds).addTo(map);
let currentMapStyle = "streets";

const organizationsLayer = L.layerGroup().addTo(map);
const draftLayer = L.layerGroup().addTo(map);
const graffitiLayer = L.layerGroup().addTo(map);
const plantationsLayer = L.layerGroup().addTo(map);
const poisLayer = L.layerGroup().addTo(map);
const storageLayer = L.layerGroup().addTo(map);
const salesLayer = L.layerGroup().addTo(map);
const specialPointsLayer = L.layerGroup().addTo(map);

const drawModeBtn = document.getElementById("drawModeBtn");
const undoPointBtn = document.getElementById("undoPointBtn");
const clearDraftBtn = document.getElementById("clearDraftBtn");
const saveOrgBtn = document.getElementById("saveOrgBtn");
const fitMapBtn = document.getElementById("fitMapBtn");

const addStorageBtn = document.getElementById("addStorageBtn");
const addGraffitiBtn = document.getElementById("addGraffitiBtn");
const addPlantationBtn = document.getElementById("addPlantationBtn");
const addPoiBtn = document.getElementById("addPoiBtn");
const cancelModeBtn = document.getElementById("cancelModeBtn");
const modeStatus = document.getElementById("modeStatus");
const selectedOrgName = document.getElementById("selectedOrgName");

const orgName = document.getElementById("orgName");
const primaryColor = document.getElementById("primaryColor");
const secondaryColor = document.getElementById("secondaryColor");
const organizationList = document.getElementById("organizationList");

const navLinks = document.querySelectorAll(".cid-nav__link");
const navLight = document.querySelector(".cid-nav__light");

const deleteModal = document.getElementById("deleteModal");
const modalText = document.getElementById("modalText");
const deleteOneBtn = document.getElementById("deleteOneBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const closeModal = document.getElementById("closeModal");

const mapStyleSatelliteBtn = document.getElementById("mapStyleSatelliteBtn");
const mapStyleStreetsBtn = document.getElementById("mapStyleStreetsBtn");
const mapStyleBWBtn = document.getElementById("mapStyleBWBtn");

const deleteGroupModal = document.getElementById("deleteGroupModal");
const deleteGroupModalText = document.getElementById("deleteGroupModalText");
const confirmDeleteGroupBtn = document.getElementById("confirmDeleteGroupBtn");
const cancelDeleteGroupBtn = document.getElementById("cancelDeleteGroupBtn");
const closeDeleteGroupModal = document.getElementById("closeDeleteGroupModal");

const viewAllBtn = document.getElementById("viewAllBtn");

const addSalesBtn = document.getElementById("addSalesBtn");
const addIllegalBoatBtn = document.getElementById("addIllegalBoatBtn");
const addDeliveryPointBtn = document.getElementById("addDeliveryPointBtn");


let currentDeleteGroupId = null;

let currentDeleteContext = null;

let organizations = [];
let drawingMode = false;
let draftPoints = [];

let selectedOrganizationId = null;
let currentAddMode = null;
let currentSpecialMode = null;
let specialPoints = [];
let unsubscribeSpecialPoints = null;
let unsubscribeOrganizations = null;

let visibilityState = {
  zone: {},
  graffiti: {},
  plantations: {},
  pois: {},
  storage: {},
  sales: {}
};

let pageInitialized = false;
let hasRetriedOrganizationsListener = false;

function setCurrentSpecialMode(mode) {
  drawingMode = false;
  currentAddMode = null;
  currentSpecialMode = currentSpecialMode === mode ? null : mode;

  drawModeBtn.textContent = "Definir zona";
  updateModeUI();
}

function redirectToLogin() {
  window.location.href = "login.html";
}

function isPermissionError(error) {
  return (
    error?.code === "permission-denied" ||
    error?.message?.toLowerCase().includes("missing or insufficient permissions")
  );
}

function openDeleteGroupModal(org) {
  currentDeleteGroupId = org.id;
  deleteGroupModalText.textContent = `¿Deseas eliminar el grupo "${org.name}"? Esta acción no se puede deshacer.`;
  deleteGroupModal.classList.remove("hidden");
}

function closeDeleteGroupModalFn() {
  currentDeleteGroupId = null;
  deleteGroupModal.classList.add("hidden");
}


function moveNavLight(linkElement) {
  if (!navLight || !linkElement || !linkElement.parentElement) return;

  const linkRect = linkElement.getBoundingClientRect();
  const parentRect = linkElement.parentElement.getBoundingClientRect();
  const left =
    linkRect.left -
    parentRect.left +
    (linkRect.width / 2) -
    (navLight.offsetWidth / 2);

  navLight.style.left = `${left}px`;
}

function initNavLight() {
  if (!navLinks.length) return;

  const active = document.querySelector(".cid-nav__link.active");
  if (active) {
    moveNavLight(active);
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      moveNavLight(link);
    });
  });

  window.addEventListener("resize", () => {
    const current = document.querySelector(".cid-nav__link.active");
    if (current) moveNavLight(current);
  });
}

function updateMapStyleButtons() {
  mapStyleSatelliteBtn?.classList.toggle("is-active", currentMapStyle === "satellite");
  mapStyleStreetsBtn?.classList.toggle("is-active", currentMapStyle === "streets");
  mapStyleBWBtn?.classList.toggle("is-active", currentMapStyle === "bw");
}

function switchBaseMap(style) {
  const imagePath = mapStyleConfig[style];
  if (!imagePath || currentMapStyle === style) return;

  if (currentBaseOverlay) {
    map.removeLayer(currentBaseOverlay);
  }

  currentBaseOverlay = L.imageOverlay(imagePath, bounds).addTo(map);
  currentMapStyle = style;
  updateMapStyleButtons();

  organizationsLayer.bringToFront();
  draftLayer.bringToFront();
  graffitiLayer.bringToFront();
  plantationsLayer.bringToFront();
  poisLayer.bringToFront();
  storageLayer.bringToFront();
  salesLayer.bringToFront();
  specialPointsLayer.bringToFront();
}

function resetMapView() {
  map.setView(center, initialZoom);

  setTimeout(() => {
    map.invalidateSize();
    map.setView(center, initialZoom);
  }, 100);
}

function initMapView() {
  resetMapView();
  updateMapStyleButtons();
}

function leafletPointToFirestore(point) {
  return {
    lat: point[0],
    lng: point[1]
  };
}

function firestorePointToLeaflet(point) {
  if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") {
    return null;
  }

  return [point.lat, point.lng];
}

function hasValidName() {
  return orgName.value.trim().length > 0;
}

function hasValidZone() {
  return draftPoints.length >= 3;
}

function clearValidationErrors() {
  orgName.classList.remove("input-error");
  drawModeBtn.classList.remove("button-error");
}

function markNameError() {
  orgName.classList.add("input-error");
}

function markZoneError() {
  drawModeBtn.classList.add("button-error");
}

function updateButtonAvailability() {
  const validName = hasValidName();

  undoPointBtn.disabled = !validName || draftPoints.length === 0;
  clearDraftBtn.disabled = !validName || draftPoints.length === 0;
  saveOrgBtn.disabled = false;
}

function getSelectedOrganization() {
  return organizations.find((org) => org.id === selectedOrganizationId) ?? null;
}

function setSelectedOrganization(orgId) {
  selectedOrganizationId = selectedOrganizationId === orgId ? null : orgId;
  updateSelectedOrganizationUI();
  updateModeUI();
  renderOrganizations();
}

function clearCurrentAddMode() {
   currentAddMode = null;
  currentSpecialMode = null;
  updateModeUI();
}

function setCurrentAddMode(mode) {
  if (!selectedOrganizationId) {
    alert("Selecciona primero un grupo guardado.");
    return;
  }

  drawingMode = false;
  drawModeBtn.textContent = "Definir zona";

  currentAddMode = currentAddMode === mode ? null : mode;
  updateModeUI();
}

function updateSelectedOrganizationUI() {
  const selectedOrg = getSelectedOrganization();
  selectedOrgName.textContent = selectedOrg
    ? selectedOrg.name
    : "Ninguno seleccionado";
}

function updateModeUI() {
  addGraffitiBtn.classList.toggle("is-active", currentAddMode === "graffiti");
  addPlantationBtn.classList.toggle("is-active", currentAddMode === "plantation");
  addPoiBtn.classList.toggle("is-active", currentAddMode === "poi");
  addStorageBtn.classList.toggle("is-active", currentAddMode === "storage");
  addSalesBtn.classList.toggle("is-active", currentAddMode === "sales");
  addIllegalBoatBtn?.classList.toggle("is-active", currentSpecialMode === "illegalBoat");
addDeliveryPointBtn?.classList.toggle("is-active", currentSpecialMode === "deliveryPoint");

if (currentSpecialMode === "illegalBoat") {
  modeStatus.textContent = "Modo activo: añade embarcaciones ilegales al mapa.";
  return;
}

if (currentSpecialMode === "deliveryPoint") {
  modeStatus.textContent = "Modo activo: añade puntos de entrega al mapa.";
  return;
}

  const selectedOrg = getSelectedOrganization();

  if (!selectedOrg) {
    modeStatus.textContent = "Selecciona un grupo para añadir elementos.";
    return;
  }

  if (currentAddMode === "graffiti") {
    modeStatus.textContent = `Modo activo: añade grafitis a ${selectedOrg.name}.`;
    return;
  }

  if (currentAddMode === "plantation") {
    modeStatus.textContent = `Modo activo: añade plantaciones a ${selectedOrg.name}.`;
    return;
  }

  if (currentAddMode === "poi") {
    modeStatus.textContent = `Modo activo: añade puntos de interés a ${selectedOrg.name}.`;
    return;
  }

  if (currentAddMode === "storage") {
    modeStatus.textContent = `Modo activo: añade almacenes a ${selectedOrg.name}.`;
    return;
  }

  if (currentAddMode === "sales") {
    modeStatus.textContent = `Modo activo: añade puntos de venta a ${selectedOrg.name}.`;
    return;
  }

  modeStatus.textContent = `Grupo seleccionado: ${selectedOrg.name}.`;
}

function renderDraft() {
  draftLayer.clearLayers();

  draftPoints.forEach((point) => {
    L.circleMarker(point, {
      radius: 5,
      color: "#ffffff",
      weight: 2,
      fillColor: primaryColor.value,
      fillOpacity: 1
    }).addTo(draftLayer);
  });

  if (draftPoints.length >= 2) {
    L.polyline(draftPoints, {
      color: secondaryColor.value,
      weight: 3,
      dashArray: "6,6"
    }).addTo(draftLayer);
  }

  if (draftPoints.length >= 3) {
    L.polygon(draftPoints, {
      color: secondaryColor.value,
      weight: 3,
      fillColor: primaryColor.value,
      fillOpacity: 0.55
    }).addTo(draftLayer);
  }
}

function createEmojiIcon(type, org) {
  const config = {
    graffiti: { className: "extra-marker extra-marker--graffiti", label: "🎨" },
    plantation: { className: "extra-marker extra-marker--plantation", label: "🌿" },
    poi: { className: "extra-marker extra-marker--poi", label: "ℹ️" },
    storage: { className: "extra-marker extra-marker--storage", label: "📦" },
    sales: { className: "extra-marker extra-marker--sales", label: "🫱🏾‍🫲🏿" }
  };

  const item = config[type];

  const primary = org?.primaryColor || "#2A6BFF";
  const secondary = org?.secondaryColor || "#B4CDD6";

  return L.divIcon({
    className: "",
    html: `
      <div
        class="${item.className}"
        style="
          --marker-primary: ${primary};
          --marker-secondary: ${secondary};
        "
      >
        <span class="extra-marker__emoji">${item.label}</span>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 11],
    popupAnchor: [0, -14]
  });
}
function createSpecialIcon(type) {
  const config = {
    illegalBoat: {
      className: "special-marker special-marker--boat",
      label: "🚤"
    },
    deliveryPoint: {
      className: "special-marker special-marker--delivery",
      label: "📦"
    }
  };

  const item = config[type];

  return L.divIcon({
    className: "",
    html: `
      <div class="${item.className}">
        <span class="special-marker__emoji">${item.label}</span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 12],
    popupAnchor: [0, -14]
  });
}

function renderExtras() {
  graffitiLayer.clearLayers();
  plantationsLayer.clearLayers();
  poisLayer.clearLayers();
  storageLayer.clearLayers();
  salesLayer.clearLayers();

  organizations.forEach((org) => {
    const graffiti = Array.isArray(org.graffiti) ? org.graffiti : [];
    const plantations = Array.isArray(org.plantations) ? org.plantations : [];
    const pois = Array.isArray(org.pois) ? org.pois : [];
    const storage = Array.isArray(org.storage) ? org.storage : [];
    const sales = Array.isArray(org.sales) ? org.sales : [];

    if (visibilityState.graffiti[org.id]) {
      graffiti.forEach((point, index) => {
        const latLng = firestorePointToLeaflet(point);
        if (!latLng) return;

        const marker = L.marker(latLng, {
          icon: createEmojiIcon("graffiti", org)
        })
          .bindPopup(`<strong>${org.name}</strong><br>Grafiti #${index + 1}`)
          .addTo(graffitiLayer);

        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);

          openDeleteModal({
            org,
            type: "graffiti",
            index
          });
        });
      });
    }

    if (visibilityState.plantations[org.id]) {
      plantations.forEach((point, index) => {
        const latLng = firestorePointToLeaflet(point);
        if (!latLng) return;

        const marker = L.marker(latLng, {
          icon: createEmojiIcon("plantation", org)
        })
          .bindPopup(`<strong>${org.name}</strong><br>Plantación #${index + 1}`)
          .addTo(plantationsLayer);

        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);

          openDeleteModal({
            org,
            type: "plantations",
            index
          });
        });
      });
    }

    if (visibilityState.pois[org.id]) {
      pois.forEach((point, index) => {
        const latLng = firestorePointToLeaflet(point);
        if (!latLng) return;

        const label = point.label?.trim() || `Punto de interés #${index + 1}`;

        const marker = L.marker(latLng, {
          icon: createEmojiIcon("poi", org)
        })
          .bindPopup(`<strong>${org.name}</strong><br>${label}`)
          .addTo(poisLayer);

        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);

          openDeleteModal({
            org,
            type: "pois",
            index
          });
        });
      });
    }

    if (visibilityState.storage[org.id]) {
      storage.forEach((point, index) => {
        const latLng = firestorePointToLeaflet(point);
        if (!latLng) return;

        const marker = L.marker(latLng, {
          icon: createEmojiIcon("storage", org)
        })
          .bindPopup(`<strong>${org.name}</strong><br>Almacén #${index + 1}`)
          .addTo(storageLayer);

        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);

          openDeleteModal({
            org,
            type: "storage",
            index
          });
        });
      });
    }

    if (visibilityState.sales[org.id]) {
      sales.forEach((point, index) => {
        const latLng = firestorePointToLeaflet(point);
        if (!latLng) return;

        const marker = L.marker(latLng, {
          icon: createEmojiIcon("sales", org)
        })
          .bindPopup(`<strong>${org.name}</strong><br>Punto de venta #${index + 1}`)
          .addTo(salesLayer);

        marker.on("contextmenu", (e) => {
          L.DomEvent.stopPropagation(e);

          openDeleteModal({
            org,
            type: "sales",
            index
          });
        });
      });
    }
  });
}

function renderSpecialPoints() {
  specialPointsLayer.clearLayers();

  specialPoints.forEach((point) => {
    const latLng = firestorePointToLeaflet(point);
    if (!latLng) return;

    const label =
      point.type === "illegalBoat"
        ? "Embarcación ilegal"
        : "Punto de entrega";

    const marker = L.marker(latLng, {
      icon: createSpecialIcon(point.type)
    })
      .bindPopup(`<strong>${label}</strong>`)
      .addTo(specialPointsLayer);

    marker.on("contextmenu", async (e) => {
      L.DomEvent.stopPropagation(e);

      const confirmed = confirm(`¿Eliminar "${label}" del mapa?`);
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, "mapSpecialPoints", point.id));
      } catch (error) {
        console.error("Error al eliminar punto especial:", error);
        alert("No se pudo eliminar el punto especial.");
      }
    });
  });
}

function renderOrganizations() {
  organizationsLayer.clearLayers();
  organizationList.innerHTML = "";

  organizations.forEach((org) => {
    if (!Array.isArray(org.points) || org.points.length < 3) return;

    const leafletPoints = org.points
      .map(firestorePointToLeaflet)
      .filter(Boolean);

    if (leafletPoints.length < 3) return;

    if (visibilityState.zone[org.id]) {
      const polygon = L.polygon(leafletPoints, {
        color: org.secondaryColor,
        weight: 3,
        fillColor: org.primaryColor,
        fillOpacity: 0.55
      }).addTo(organizationsLayer);

      polygon.bindPopup(`
  <strong>${org.name}</strong><br>
  Principal: ${org.primaryColor}<br>
  Secundario: ${org.secondaryColor}
`);

      polygon.bindTooltip(org.name, {
        permanent: true,
        direction: "center",
        className: "zone-label"
      });
    }

    const graffitiCount = Array.isArray(org.graffiti) ? org.graffiti.length : 0;
    const plantationCount = Array.isArray(org.plantations) ? org.plantations.length : 0;
    const poiCount = Array.isArray(org.pois) ? org.pois.length : 0;
    const storageCount = Array.isArray(org.storage) ? org.storage.length : 0;
    const salesCount = Array.isArray(org.sales) ? org.sales.length : 0;

    const item = document.createElement("div");
    item.className = "organization-item";
    item.classList.toggle("selected", selectedOrganizationId === org.id);
    item.style.setProperty("--primary-color", org.primaryColor);
    item.style.setProperty("--secondary-color", org.secondaryColor);
    item.innerHTML = `
      <div class="organization-row organization-row--header">
        <div class="organization-item__name">${org.name}</div>

        <div class="organization-actions">
          <button
            class="icon-btn toggle-all-btn ${isAllVisible(org.id) ? "is-visible" : ""}"
            type="button"
            title="Ver todo"
          >🔎</button>

          <button class="delete-btn" type="button" title="Eliminar grupo">🗑️</button>
        </div>
      </div>

      <div class="organization-row organization-row--icons">
        <button class="icon-btn toggle-zone-btn ${visibilityState.zone[org.id] ? "is-visible" : ""}">👁️</button>
        <button class="icon-btn toggle-graffiti-btn ${visibilityState.graffiti[org.id] ? "is-visible" : ""}">🎨</button>
        <button class="icon-btn toggle-poi-btn ${visibilityState.pois[org.id] ? "is-visible" : ""}">ℹ️</button>
        <button class="icon-btn toggle-plant-btn ${visibilityState.plantations[org.id] ? "is-visible" : ""}">🌿</button>
        <button class="icon-btn toggle-storage-btn ${visibilityState.storage[org.id] ? "is-visible" : ""}">📦</button>
        <button class="icon-btn toggle-sales-btn ${visibilityState.sales[org.id] ? "is-visible" : ""}">🫱🏾‍🫲🏿</button>
      </div>

      <div class="organization-row organization-row--meta">
        <span>🎨 ${graffitiCount}</span>
        <span>ℹ️ ${poiCount}</span>
        <span>🌿 ${plantationCount}</span>
        <span>📦 ${storageCount}</span>
        <span>🫱🏾‍🫲🏿 ${salesCount}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      setSelectedOrganization(org.id);
    });

    const deleteBtn = item.querySelector(".delete-btn");
    const allBtn = item.querySelector(".toggle-all-btn");
    const zoneBtn = item.querySelector(".toggle-zone-btn");
    const graffitiBtn = item.querySelector(".toggle-graffiti-btn");
    const poiBtn = item.querySelector(".toggle-poi-btn");
    const plantBtn = item.querySelector(".toggle-plant-btn");
    const storageBtn = item.querySelector(".toggle-storage-btn");
    const salesBtn = item.querySelector(".toggle-sales-btn");

    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDeleteGroupModal(org);
      });
    }

    if (allBtn) {
      allBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleAllVisibility(org.id);
      });
    }

    if (zoneBtn) {
      zoneBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("zone", org.id);
      });
    }

    if (graffitiBtn) {
      graffitiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("graffiti", org.id);
      });
    }

    if (poiBtn) {
      poiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("pois", org.id);
      });
    }

    if (plantBtn) {
      plantBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("plantations", org.id);
      });
    }

    if (storageBtn) {
      storageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("storage", org.id);
      });
    }

    if (salesBtn) {
      salesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExtraVisibility("sales", org.id);
      });
    }

    organizationList.appendChild(item);
  });

  renderExtras();
}

function isAllVisible(orgId) {
  return (
    visibilityState.zone[orgId] &&
    visibilityState.graffiti[orgId] &&
    visibilityState.pois[orgId] &&
    visibilityState.plantations[orgId] &&
    visibilityState.storage[orgId] &&
    visibilityState.sales[orgId]
  );
}

function toggleAllVisibility(orgId) {
  const nextValue = !isAllVisible(orgId);

  visibilityState.zone[orgId] = nextValue;
  visibilityState.graffiti[orgId] = nextValue;
  visibilityState.pois[orgId] = nextValue;
  visibilityState.plantations[orgId] = nextValue;
  visibilityState.storage[orgId] = nextValue;
  visibilityState.sales[orgId] = nextValue;

  renderOrganizations();
}

function resetForm() {
  orgName.value = "";
  primaryColor.value = "#2A6BFF";
  secondaryColor.value = "#B4CDD6";
  draftPoints = [];
  drawingMode = false;
  drawModeBtn.textContent = "Definir zona";

  clearValidationErrors();
  renderDraft();
  updateButtonAvailability();
}

async function saveOrganization() {
  clearValidationErrors();

  const validName = hasValidName();
  const validZone = hasValidZone();

  if (!validName) {
    markNameError();
  }

  if (!validZone) {
    markZoneError();
  }

  if (!validName || !validZone) {
    if (!validName) {
      orgName.focus();
    }
    return;
  }

  const organization = {
    name: orgName.value.trim(),
    primaryColor: primaryColor.value,
    secondaryColor: secondaryColor.value,
    points: draftPoints.map(leafletPointToFirestore),
    graffiti: [],
    plantations: [],
    pois: [],
    storage: [],
    sales: [],
    createdAt: serverTimestamp()
  };

  try {
    saveOrgBtn.disabled = true;
    saveOrgBtn.textContent = "Guardando...";

    await addDoc(collection(db, "criminalOrganizations"), organization);
    resetForm();
  } catch (error) {
    console.error("Error al guardar la organización:", error);
    alert(`No se pudo guardar la organización en Firebase.\n${error.message}`);
  } finally {
    saveOrgBtn.disabled = false;
    saveOrgBtn.textContent = "Guardar grupo";
    updateButtonAvailability();
  }
}

async function deleteOrganization(id) {
  const confirmed = confirm("¿Seguro que quieres eliminar el grupo?");

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "criminalOrganizations", id));

    if (selectedOrganizationId === id) {
      selectedOrganizationId = null;
      clearCurrentAddMode();
      updateSelectedOrganizationUI();
    }
  } catch (error) {
    console.error("Error al eliminar el grupo:", error);
    alert("No se pudo eliminar el grupo.");
  }
}

function toggleExtraVisibility(type, orgId) {
  visibilityState[type][orgId] = !visibilityState[type][orgId];
  renderOrganizations();
}

async function addExtraPointToOrganization(type, latLng) {
  const selectedOrg = getSelectedOrganization();

  if (!selectedOrg) {
    alert("Selecciona primero un grupo.");
    return;
  }

  const pointData = {
    lat: Math.round(latLng.lat),
    lng: Math.round(latLng.lng)
  };

  if (type === "poi") {
    const label = window.prompt("Nombre o descripción breve del punto de interés:", "");
    pointData.label = label?.trim() || "";
  }

  try {
    const updatePayload = {};

    if (type === "graffiti") {
      updatePayload.graffiti = arrayUnion(pointData);
      visibilityState.graffiti[selectedOrg.id] = true;
    }

    if (type === "plantation") {
      updatePayload.plantations = arrayUnion(pointData);
      visibilityState.plantations[selectedOrg.id] = true;
    }

    if (type === "poi") {
      updatePayload.pois = arrayUnion(pointData);
      visibilityState.pois[selectedOrg.id] = true;
    }

    if (type === "storage") {
      updatePayload.storage = arrayUnion(pointData);
      visibilityState.storage[selectedOrg.id] = true;
    }

    if (type === "sales") {
      updatePayload.sales = arrayUnion(pointData);
      visibilityState.sales[selectedOrg.id] = true;
    }

    await updateDoc(doc(db, "criminalOrganizations", selectedOrg.id), updatePayload);
  } catch (error) {
    console.error("Error al añadir elemento:", error);
    alert("No se pudo guardar el elemento.");
  }
}

async function addSpecialPointToMap(type, latLng) {
  const point = {
    type,
    lat: Math.round(latLng.lat),
    lng: Math.round(latLng.lng),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "mapSpecialPoints"), point);

    currentSpecialMode = null;
    updateModeUI();
  } catch (error) {
    console.error("Error al guardar punto especial:", error);
    alert("No se pudo guardar el punto especial.");
  }
}

function listenOrganizations() {
  if (unsubscribeOrganizations) {
    unsubscribeOrganizations();
    unsubscribeOrganizations = null;
  }

  unsubscribeOrganizations = onSnapshot(
    collection(db, "criminalOrganizations"),
    (snapshot) => {
      hasRetriedOrganizationsListener = false;

      organizations = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          ...data,
          graffiti: Array.isArray(data.graffiti) ? data.graffiti : [],
          plantations: Array.isArray(data.plantations) ? data.plantations : [],
          pois: Array.isArray(data.pois) ? data.pois : [],
          storage: Array.isArray(data.storage) ? data.storage : [],
          sales: Array.isArray(data.sales) ? data.sales : []
        };
      });

      organizations.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      organizations.forEach((org) => {
        if (visibilityState.zone[org.id] === undefined) visibilityState.zone[org.id] = false;
        if (visibilityState.graffiti[org.id] === undefined) visibilityState.graffiti[org.id] = false;
        if (visibilityState.plantations[org.id] === undefined) visibilityState.plantations[org.id] = false;
        if (visibilityState.pois[org.id] === undefined) visibilityState.pois[org.id] = false;
        if (visibilityState.storage[org.id] === undefined) visibilityState.storage[org.id] = false;
        if (visibilityState.sales[org.id] === undefined) visibilityState.sales[org.id] = false;
      });

      if (
        selectedOrganizationId &&
        !organizations.some((org) => org.id === selectedOrganizationId)
      ) {
        selectedOrganizationId = null;
        clearCurrentAddMode();
      }

      updateSelectedOrganizationUI();
      updateModeUI();
      renderOrganizations();
    },
    async (error) => {
      console.error("Error al cargar organizaciones:", error);

      if (isPermissionError(error)) {
        const currentUser = auth.currentUser;
        console.log("Usuario actual:", auth.currentUser);
        console.log("UID:", auth.currentUser?.uid);
        console.log("Email:", auth.currentUser?.email);
        if (currentUser && !hasRetriedOrganizationsListener) {
          hasRetriedOrganizationsListener = true;

          try {
            await currentUser.getIdToken(true);
            setTimeout(() => {
              listenOrganizations();
            }, 250);
            return;
          } catch (tokenError) {
            console.error("No se pudo refrescar el token:", tokenError);
          }
        }

        redirectToLogin();
        return;
      }

      alert(`No se pudieron cargar las organizaciones.\n${error.message}`);
    }
  );
}

function listenSpecialPoints() {
  if (unsubscribeSpecialPoints) {
    unsubscribeSpecialPoints();
    unsubscribeSpecialPoints = null;
  }

  unsubscribeSpecialPoints = onSnapshot(
    collection(db, "mapSpecialPoints"),
    (snapshot) => {
      specialPoints = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderSpecialPoints();
    },
    (error) => {
      console.error("Error al cargar puntos especiales:", error);
      alert("No se pudieron cargar los puntos especiales.");
    }
  );
}

function bindUI() {
  drawModeBtn?.addEventListener("click", () => {
    clearValidationErrors();

    if (!hasValidName()) {
      markNameError();
      orgName.focus();
      updateButtonAvailability();
      return;
    }

    clearCurrentAddMode();

    drawingMode = !drawingMode;
    drawModeBtn.textContent = drawingMode ? "Dibujando..." : "Definir zona";
    updateButtonAvailability();
  });

  undoPointBtn?.addEventListener("click", () => {
    if (!hasValidName()) return;

    draftPoints.pop();
    renderDraft();
    updateButtonAvailability();
  });

  clearDraftBtn?.addEventListener("click", () => {
    if (!hasValidName()) return;

    draftPoints = [];
    renderDraft();
    updateButtonAvailability();
  });

  saveOrgBtn?.addEventListener("click", saveOrganization);

  fitMapBtn?.addEventListener("click", () => {
    resetMapView();
  });

  mapStyleSatelliteBtn?.addEventListener("click", () => {
    switchBaseMap("satellite");
  });

  mapStyleStreetsBtn?.addEventListener("click", () => {
    switchBaseMap("streets");
  });

  mapStyleBWBtn?.addEventListener("click", () => {
    switchBaseMap("bw");
  });

  addGraffitiBtn?.addEventListener("click", () => {
    setCurrentAddMode("graffiti");
  });

  addPlantationBtn?.addEventListener("click", () => {
    setCurrentAddMode("plantation");
  });

  addPoiBtn?.addEventListener("click", () => {
    setCurrentAddMode("poi");
  });

  addStorageBtn?.addEventListener("click", () => {
    setCurrentAddMode("storage");
  });

  addSalesBtn?.addEventListener("click", () => {
    setCurrentAddMode("sales");
  });

  cancelModeBtn?.addEventListener("click", () => {
    clearCurrentAddMode();
  });

  addIllegalBoatBtn?.addEventListener("click", () => {
  setCurrentSpecialMode("illegalBoat");
});

addDeliveryPointBtn?.addEventListener("click", () => {
  setCurrentSpecialMode("deliveryPoint");
});

  map.on("click", async (e) => {
    if (drawingMode) {
      const point = [
        Math.round(e.latlng.lat),
        Math.round(e.latlng.lng)
      ];

      draftPoints.push(point);
      drawModeBtn.classList.remove("button-error");

      renderDraft();
      updateButtonAvailability();
      return;
    }

   if (currentSpecialMode) {
  await addSpecialPointToMap(currentSpecialMode, e.latlng);
  return;
}

if (!currentAddMode) return;

await addExtraPointToOrganization(currentAddMode, e.latlng);
  });

  primaryColor?.addEventListener("input", renderDraft);
  secondaryColor?.addEventListener("input", renderDraft);

  orgName?.addEventListener("input", () => {
    if (hasValidName()) {
      orgName.classList.remove("input-error");
    }
    updateButtonAvailability();
  });
}

function openDeleteModal(context) {
  currentDeleteContext = context;

  modalText.textContent = `¿Qué quieres hacer con los elementos de ${context.org.name}?`;

  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  currentDeleteContext = null;
  deleteModal.classList.add("hidden");
}

closeModal.onclick = closeDeleteModal;
cancelDeleteBtn.onclick = closeDeleteModal;

deleteOneBtn.onclick = async () => {
  if (!currentDeleteContext) return;

  const { org, type, index } = currentDeleteContext;

  const array = [...(org[type] || [])];
  array.splice(index, 1);

  await updateDoc(doc(db, "criminalOrganizations", org.id), {
    [type]: array
  });

  closeDeleteModal();
};

deleteAllBtn.onclick = async () => {
  if (!currentDeleteContext) return;

  const { org, type } = currentDeleteContext;

  await updateDoc(doc(db, "criminalOrganizations", org.id), {
    [type]: []
  });

  closeDeleteModal();
};

closeDeleteGroupModal.onclick = closeDeleteGroupModalFn;
cancelDeleteGroupBtn.onclick = closeDeleteGroupModalFn;

confirmDeleteGroupBtn.onclick = async () => {
  if (!currentDeleteGroupId) return;

  await deleteOrganization(currentDeleteGroupId);
  closeDeleteGroupModalFn();
};

function initPage() {
  if (pageInitialized) return;
  pageInitialized = true;

  initNavLight();
  initMapView();
  bindUI();
  renderOrganizations();
  renderDraft();
  listenOrganizations();
  listenSpecialPoints();
  clearValidationErrors();
  updateButtonAvailability();
  updateSelectedOrganizationUI();
  updateModeUI();
}

function showAllOrganizationsData() {
  organizations.forEach((org) => {
    visibilityState.zone[org.id] = true;
    visibilityState.graffiti[org.id] = true;
    visibilityState.plantations[org.id] = true;
    visibilityState.pois[org.id] = true;
    visibilityState.storage[org.id] = true;
    visibilityState.sales[org.id] = true;
  });

  renderOrganizations();
}

viewAllBtn?.addEventListener("click", () => {
  showAllOrganizationsData();
});

let allVisible = false;

viewAllBtn?.addEventListener("click", () => {
  allVisible = !allVisible;

  organizations.forEach((org) => {
    visibilityState.zone[org.id] = allVisible;
    visibilityState.graffiti[org.id] = allVisible;
    visibilityState.plantations[org.id] = allVisible;
    visibilityState.pois[org.id] = allVisible;
    visibilityState.storage[org.id] = allVisible;
    visibilityState.sales[org.id] = allVisible;
  });

  renderOrganizations();
});


onAuthStateChanged(auth, (user) => {
  if (!user) {
    redirectToLogin();
    return;
  }

  initPage();
});