import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const MAP_WIDTH = 1800;
const MAP_HEIGHT = 2048;
const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
const center = [MAP_HEIGHT / 2, MAP_WIDTH / 2];
const initialZoom = 0;

const mapStyleConfig = {
  streets: "assets/images/map-streets1.png",
  satellite: "assets/images/map-satelite.png"
};

const authNavBtn = document.getElementById("authNavBtn");
const searchInput = document.getElementById("searchInput");
const groupsGrid = document.getElementById("groupsGrid");
const summaryPill = document.getElementById("summaryPill");

const navLinks = document.querySelectorAll(".cid-nav__link");
const navLight = document.querySelector(".cid-nav__light");


let organizations = [];
let renderedMaps = [];
let navInitialized = false;

onAuthStateChanged(auth, (user) => {
  document.body.classList.remove("auth-loading");

  if (!user) {
    redirectToLogin();
    return;
  }

  initNavLight();
  initSearch();
  listenOrganizations();

  const authNavBtn = document.getElementById("authNavBtn");

  if (authNavBtn) {
    const username = user.email?.split("@")[0] || "Usuario";

    authNavBtn.textContent = username;

    authNavBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }
});

function redirectToLogin() {
  window.location.href = "login.html";
}
function moveNavLight(linkElement) {
  if (!navLight || !linkElement) return;

  const target = linkElement.querySelector("a") || linkElement;
  const linkRect = target.getBoundingClientRect();
  const parentRect = navLight.parentElement.getBoundingClientRect();

  const left =
    linkRect.left -
    parentRect.left +
    linkRect.width / 2 -
    navLight.offsetWidth / 2;

  navLight.style.left = `${left}px`;
}

function initNavLight() {
  if (navInitialized) return;
  navInitialized = true;

  if (!navLinks.length || !navLight) return;

  const active = document.querySelector(".cid-nav__link.active");
  if (active) moveNavLight(active);

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

function setStatus(message, type = "") {
  if (!summaryPill) return;

  summaryPill.textContent = message;
  summaryPill.classList.remove("is-error", "is-success");

  if (type) {
    summaryPill.classList.add(type);
  }
}

function setGroupCount(count) {
  if (!summaryPill) return;

  summaryPill.innerHTML = `
    <div class="summary-card__icon">👥</div>

    <div>
      <strong>${count} grupo${count === 1 ? "" : "s"} encontrado${count === 1 ? "" : "s"}</strong>
      <span>Total de organizaciones registradas</span>
    </div>

    <div class="summary-card__arrow">›</div>
  `;
}

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function firestorePointToLeaflet(point) {
  if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") {
    return null;
  }

  return [point.lat, point.lng];
}

function hasValidOrganizationName(org) {
  return typeof org?.name === "string" && org.name.trim().length > 1;
}

function getColorName(hex) {
  if (!hex) return "No definido";

  const normalized = hex.toLowerCase();

  const colorMap = {
    "#ec7ef2": "Rosa / Lila",
    "#d1bfa9": "Beige",
    "#341066": "Violeta oscuro",
    "#115696": "Azul",
    "#a31408": "Rojo oscuro",
    "#166e22": "Verde",
    "#212121": "Negro",
    "#d97007": "Naranja",
    "#1c317a": "Azul marino",
    "#6919a6": "Violeta",
    "#b4cdd6": "Azul grisáceo",
    "#f5382a": "Rojo anaranjado",
    "#ffd621": "Amarillo",
    "#41b54c": "Verde lima",
    "#2ddbeb": "Turquesa",
    "#2a6bff": "Azul"
  };

  return colorMap[normalized] || normalized.toUpperCase();
}

function getApproximateLocation(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return "Ubicación no disponible";
  }

  const validPoints = points.map(firestorePointToLeaflet).filter(Boolean);

  if (!validPoints.length) {
    return "Ubicación no disponible";
  }

  const avgLat = validPoints.reduce((sum, point) => sum + point[0], 0) / validPoints.length;
  const avgLng = validPoints.reduce((sum, point) => sum + point[1], 0) / validPoints.length;

  const zones = [
    { name: "Norte de Los Santos", test: () => avgLat < 450 },
    { name: "Centro-norte", test: () => avgLat >= 450 && avgLat < 850 },
    { name: "Centro de Los Santos", test: () => avgLat >= 850 && avgLat < 1200 },
    { name: "Sur de Los Santos", test: () => avgLat >= 1200 && avgLat < 1600 },
    { name: "Extremo sur / puerto", test: () => avgLat >= 1600 }
  ];

  let verticalZone = "Zona no definida";
  const foundVertical = zones.find((zone) => zone.test());
  if (foundVertical) verticalZone = foundVertical.name;

  let horizontalZone = "central";
  if (avgLng < 550) horizontalZone = "oeste";
  else if (avgLng > 1250) horizontalZone = "este";

  return `${verticalZone}, sector ${horizontalZone}`;
}

function createEmptyState(message) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = message;
  return div;
}

function destroyRenderedMaps() {
  renderedMaps.forEach((mapInstance) => {
    try {
      mapInstance.remove();
    } catch (error) {
      console.warn("No se pudo eliminar una instancia del mapa:", error);
    }
  });

  renderedMaps = [];
}

function buildGroupCard(org) {
  const card = document.createElement("article");
  card.className = "group-card";
  card.style.setProperty("--primary-color", org.primaryColor || "#34d6ff");
  card.style.setProperty("--secondary-color", org.secondaryColor || "#9c7dff");

  const locationText = getApproximateLocation(org.points);
  const photos = Array.isArray(org.photos) ? org.photos : [];

  card.innerHTML = `
   <div class="group-card__header group-card__header--premium">
  <div
    class="group-name-card"
    style="
      --group-primary:${escapeHtml(org.primaryColor || "#34d6ff")};
      --group-secondary:${escapeHtml(org.secondaryColor || "#ffffff")};
    "
  >

    <h2>${escapeHtml(org.name)}</h2>

    <div class="group-badges">
      <div class="color-badge">
        <span 
          class="color-dot" 
          style="background:${escapeHtml(org.primaryColor || "#34d6ff")}"
        ></span>
        <span>Principal</span>
      </div>

      <div class="color-badge">
        <span 
          class="color-dot" 
          style="background:${escapeHtml(org.secondaryColor || "#ffffff")}"
        ></span>
        <span>Secundario</span>
      </div>
    </div>
  </div>
</div>

   
    <div class="group-content">
      <div class="group-left">
        <section class="block-card">
          <h3>Ubicación visual</h3>

          <div class="map-preview-grid">
            <div class="map-preview">
              <div class="map-preview__title">Zona foto mapa</div>
              <div id="zone-map-${org.id}" class="map-canvas"></div>
            </div>

            <div class="map-preview">
              <div class="map-preview__title">Foto aérea de zona</div>
              <div id="satellite-map-${org.id}" class="map-canvas"></div>
            </div>
          </div>
        </section>

        <section class="block-card">
          <h3>Añadir foto al grupo</h3>

          <form class="upload-form" data-org-id="${escapeHtml(org.id)}">
            <textarea
              class="caption-input"
              name="caption"
              placeholder="Escribe un pie de foto..."
            ></textarea>

            <div class="upload-row">
              
              <input
                id="file-${org.id}"
                class="hidden-input file-input"
                type="file"
                name="image"
                accept="image/*"
              />
              <button class="upload-btn" type="submit">
  <span>⬆</span>
  Subir foto
</button>
            </div>

           
          </form>
        </section>
      </div>

      <div class="group-right">
       <section class="block-card">
  <h3>Galería de fotos</h3>

  <div class="photo-carousel">
    <button class="carousel-btn carousel-btn--prev" type="button" data-carousel-prev>‹</button>

    <div class="gallery-grid" data-gallery></div>

    <button class="carousel-btn carousel-btn--next" type="button" data-carousel-next>›</button>
  </div>
</section>
      </div>
    </div>
  `;

  const gallery = card.querySelector("[data-gallery]");

  if (!photos.length) {
    gallery.appendChild(
      createEmptyState("Este grupo todavía no tiene fotos ancladas.")
    );
  } else {
    const orderedPhotos = [...photos].sort((a, b) => {
      const aTime = normalizeTimestamp(a?.uploadedAt);
      const bTime = normalizeTimestamp(b?.uploadedAt);
      return bTime - aTime;
    });

orderedPhotos.forEach((photo) => {
  const photoCard = document.createElement("article");
  photoCard.className = "photo-card";

  const caption = photo.caption?.trim() || "Sin pie de foto";
  const uploadedAt = formatTimestamp(photo.uploadedAt);
const adminEmails = [
  "callahan@cid.com"
];

const isAdmin = adminEmails.includes(auth.currentUser?.email);

photoCard.innerHTML = `
  <div class="photo-card__image-wrap">

    ${isAdmin ? `
      <button class="photo-delete-btn" type="button">
        ✕
      </button>
    ` : ""}

    <img 
      src="${escapeAttribute(photo.url || "")}" 
      alt="${escapeAttribute(caption)}" 
    />
  </div>

  <div class="photo-card__body">
    <div class="photo-card__caption">${escapeHtml(caption)}</div>
    <div class="photo-card__date">${escapeHtml(uploadedAt)}</div>
  </div>
`;

const deleteBtn = photoCard.querySelector(".photo-delete-btn");

deleteBtn?.addEventListener("click", async () => {
  const confirmed = confirm("¿Eliminar esta foto de la galería?");

  if (!confirmed) return;

  try {
    await updateDoc(doc(db, "criminalOrganizations", org.id), {
      photos: arrayRemove(photo)
    });

    setStatus("Foto eliminada correctamente.", "is-success");

  } catch (error) {
    console.error(error);

    setStatus(
      "No se pudo eliminar la foto.",
      "is-error"
    );
  }
});
  gallery.appendChild(photoCard);
});

const prevBtn = card.querySelector("[data-carousel-prev]");
const nextBtn = card.querySelector("[data-carousel-next]");

prevBtn?.addEventListener("click", () => {
  gallery.scrollBy({
    left: -gallery.clientWidth,
    behavior: "smooth"
  });
});

nextBtn?.addEventListener("click", () => {
  gallery.scrollBy({
    left: gallery.clientWidth,
    behavior: "smooth"
  });
});
  }

  const form = card.querySelector(".upload-form");
  const fileInput = card.querySelector(".file-input");
  const fileNameBox = card.querySelector("[data-file-name]");
  const uploadBtn = card.querySelector(".upload-btn");

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileNameBox.textContent = file
      ? `Archivo seleccionado: ${file.name}`
      : "No se ha seleccionado ningún archivo.";
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = fileInput?.files?.[0];
    const caption = form.querySelector("[name='caption']")?.value?.trim() || "";

    if (!file) {
      setStatus("Debes seleccionar una imagen antes de subirla.", "is-error");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setStatus(
        "La imagen es demasiado grande. Usa una imagen de menos de 4MB.",
        "is-error"
      );
      return;
    }
    if (!file) {
      setStatus("Debes seleccionar una imagen antes de subirla.", "is-error");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Subiendo...";

    try {
      await uploadPhotoForOrganization(org, file, caption);
      setStatus(`Foto subida correctamente al grupo ${org.name}.`, "is-success");
      form.reset();
      fileNameBox.textContent = "No se ha seleccionado ningún archivo.";
    } catch (error) {
      console.error(error);
      setStatus(
        `No se pudo subir la foto al grupo ${org.name}. Revisa Firebase Storage y los permisos.`,
        "is-error"
      );
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Subir foto";
    }
  });

  return card;
}

function renderOrganizations() {
  destroyRenderedMaps();
  groupsGrid.innerHTML = "";

  const searchTerm = normalizeText(searchInput?.value || "");

  const filteredOrganizations = organizations.filter((org) => {
    if (!hasValidOrganizationName(org)) {
      return false;
    }

    const name = normalizeText(org.name);
    return name.includes(searchTerm);
  });

  setGroupCount(filteredOrganizations.length);

  if (!filteredOrganizations.length) {
    groupsGrid.appendChild(
      createEmptyState("No hay grupos que coincidan con la búsqueda.")
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredOrganizations.forEach((org) => {
    const card = buildGroupCard(org);
    fragment.appendChild(card);
  });

  groupsGrid.appendChild(fragment);

  requestAnimationFrame(() => {
    filteredOrganizations.forEach((org) => {
      renderGroupMaps(org);
    });
  });
}

function renderGroupMaps(org) {
  const zoneContainer = document.getElementById(`zone-map-${org.id}`);
  const satelliteContainer = document.getElementById(`satellite-map-${org.id}`);

  if (!zoneContainer || !satelliteContainer) return;

  const points = Array.isArray(org.points)
    ? org.points.map(firestorePointToLeaflet).filter(Boolean)
    : [];

  const zoneMap = L.map(zoneContainer, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false
  });

  const satelliteMap = L.map(satelliteContainer, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false
  });

  renderedMaps.push(zoneMap, satelliteMap);

  L.imageOverlay(mapStyleConfig.streets, bounds).addTo(zoneMap);
  L.imageOverlay(mapStyleConfig.satellite, bounds).addTo(satelliteMap);

  const groupLayer1 = L.layerGroup().addTo(zoneMap);
  const groupLayer2 = L.layerGroup().addTo(satelliteMap);

  if (points.length >= 3) {
    const polygonOptions = {
      color: org.secondaryColor || "#b4cdd6",
      weight: 3,
      fillColor: org.primaryColor || "#34d6ff",
      fillOpacity: 0.5
    };

    const polygon1 = L.polygon(points, polygonOptions).addTo(groupLayer1);
    const polygon2 = L.polygon(points, polygonOptions).addTo(groupLayer2);

    polygon1.bindTooltip(org.name || "Grupo", {
      permanent: true,
      direction: "center",
      className: "zone-label"
    });

    polygon2.bindTooltip(org.name || "Grupo", {
      permanent: true,
      direction: "center",
      className: "zone-label"
    });

    const fitBounds = L.polygon(points).getBounds();
    zoneMap.fitBounds(fitBounds, {
      padding: [120, 120],
      maxZoom: 0
    });

    satelliteMap.fitBounds(fitBounds, {
      padding: [120, 120],
      maxZoom: 0
    });
  } else {
    zoneMap.setView(center, initialZoom);
    satelliteMap.setView(center, initialZoom);
  }

  setTimeout(() => {
    zoneMap.invalidateSize();
    satelliteMap.invalidateSize();
  }, 50);
}

async function uploadPhotoForOrganization(org, file, caption) {
  const imageBase64 = await compressImageToBase64(file);
  const currentUser = auth.currentUser;

  await updateDoc(doc(db, "criminalOrganizations", org.id), {
    photos: arrayUnion({
      url: imageBase64,
      caption,
      fileName: file.name,
      uploadedBy: currentUser?.email || "Usuario autenticado",
      uploadedAt: new Date().toISOString()
    })
  });
}

function compressImageToBase64(file, maxWidth = 700, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result;
    };

    reader.onerror = () => reject(reader.error);

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => reject(new Error("No se pudo procesar la imagen."));

    reader.readAsDataURL(file);
  });
}
function listenOrganizations() {
  const organizationsQuery = query(
    collection(db, "criminalOrganizations"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    organizationsQuery,
    (snapshot) => {
      organizations = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      const validOrganizations = organizations.filter(hasValidOrganizationName);

      if (!validOrganizations.length) {
        groupsGrid.innerHTML = "";
        groupsGrid.appendChild(
          createEmptyState("No hay grupos criminales guardados con nombre válido.")
        );
        setGroupCount(0);
        return;
      }

      renderOrganizations();
    },
    (error) => {
      console.error(error);
      setStatus(
        "No se pudieron cargar los grupos criminales. Revisa permisos de Firestore.",
        "is-error"
      );
    }
  );
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });
}

function formatTimestamp(value) {
  const date = parseTimestamp(value);

  if (!date) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function normalizeTimestamp(value) {
  const date = parseTimestamp(value);
  return date ? date.getTime() : 0;
}

function parseTimestamp(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^\w.-]/g, "_");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function initSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    renderOrganizations();
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    redirectToLogin();
    return;
  }

  initNavLight();
  initSearch();
  listenOrganizations();
});