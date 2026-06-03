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
const searchBtn = document.getElementById("searchBtn");
const autocompleteList = document.getElementById("autocompleteList");
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

function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "255, 247, 0";
}

function buildGroupCard(org) {
  const card = document.createElement("article");
  card.className = "group-card";
  const primaryColor = org.primaryColor || "#FFF700";
  const secondaryColor = org.secondaryColor || "#FFFFFF";
  const black = "#000000";

  card.style.setProperty("--group-primary-color", primaryColor);
  card.style.setProperty("--group-secondary-color", secondaryColor);
  card.style.setProperty("--group-primary-rgb", hexToRGB(primaryColor));
  card.style.setProperty("--group-secondary-rgb", hexToRGB(secondaryColor));
  card.style.setProperty("--black", hexToRGB(black));

  const locationText = getApproximateLocation(org.points);
  const photos = Array.isArray(org.photos) ? org.photos : [];
  const firstPhoto = photos[0] || null;
  const hasMembers = Array.isArray(org.members) && org.members.length > 0;
  const noMembersWarning = !hasMembers ? '<div class="empty-state" style="margin-bottom:12px;">No hay miembros registrados.</div>' : '';

  const primaryColorName = getColorName(org.primaryColor || '');
  const secondaryColorName = getColorName(org.secondaryColor || '');

  card.innerHTML = `
   <div class="group-card__header group-card__header--premium">
  <div
    class="group-name-card"
    style="
      --group-primary:${escapeHtml(org.primaryColor || "#34d6ff")};
      --group-secondary:${escapeHtml(org.secondaryColor || "#ffffff")};
    "
  >

    <div class="group-name-card-grid">
      <div class="group-name-card__panel group-name-card__panel--info">
       <div class="group-name-card__top">
  <span>
    Peligrosidad: ${escapeHtml(getDangerLabel(org))} 
    | Miembros: ${escapeHtml(String((Array.isArray(org.members) ? org.members.length : 0) || org.memberCount || 0))}
  </span>
</div>

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

      <div class="group-name-card__panel group-name-card__panel--media">
        <div class="group-header-stats">
          ${renderStatusBadge(org)}
        </div>

        ${firstPhoto ? `
          <div class="group-graffiti-full">
            <img src="${escapeAttribute(firstPhoto.url || '')}" alt="Grafiti" />
          </div>
        ` : `
          <div class="group-graffiti-empty">Sin grafiti disponible</div>
        `}
      </div>
    </div>
  </div>
</div>

    <div class="group-content">
      <section class="block-card">
        <h3>Ubicación</h3>

        <div class="map-preview-grid">
          <div class="map-preview">
            <div class="map-preview__title">Mapa territorial</div>
            <div id="zone-map-${org.id}" class="map-canvas"></div>
          </div>

          <div class="map-preview">
            <div class="map-preview__title">Mapa de actividad</div>
            <div id="satellite-map-${org.id}" class="map-canvas"></div>
          </div>
        </div>
      </section>

      <section class="block-card">
        <h3>Galería de fotos</h3>

    <div class="photo-gallery-viewer" data-photo-viewer>
  <div class="photo-gallery-bg" data-gallery-bg></div>

  <button class="photo-gallery-arrow photo-gallery-arrow--prev" type="button" data-carousel-prev>
    ‹
  </button>

  <div class="photo-gallery-main">
    <img data-gallery-main-img src="" alt="Foto principal" />
  </div>

  <button class="photo-gallery-arrow photo-gallery-arrow--next" type="button" data-carousel-next>
    ›
  </button>

  <div class="photo-gallery-info">
    <strong data-gallery-title></strong>
    <span data-gallery-date></span>
  </div>

  <div class="photo-gallery-thumbs" data-gallery></div>
</div>

        <div class="upload-photo-block" style="display:flex; justify-content:center; margin-top:18px;">
          <input
            id="file-${org.id}"
            class="hidden-input file-input"
            type="file"
            name="image"
            accept="image/*"
            style="display:none;"
          />
          <button class="upload-btn" type="button" data-action="pick-photo">
            <span> </span>
            Subir foto
          </button>
        </div>
      </section>

      <section class="block-card">
        <h3>Miembros del grupo</h3>
        ${noMembersWarning}

       <div class="members-carousel">
  <button class="members-carousel-btn members-carousel-btn--prev" type="button" data-members-prev>‹</button>

  <div class="members-grid">
    ${renderMembersGrid(org)}
  </div>

  <button class="members-carousel-btn members-carousel-btn--next" type="button" data-members-next>›</button>
  
</div>
<div class="members-actions">
  <button class="upload-btn" type="button" data-action="add-member">Añadir miembro</button>
</div>
      </section>
    </div>
  `;

  const gallery = card.querySelector("[data-gallery]");
  const membersGrid = card.querySelector(".members-grid");
  const addMemberBtn = card.querySelector("[data-action='add-member']");

  addMemberBtn?.addEventListener("click", () => {
    openAddMemberModal(org, card, membersGrid);
  });

  const filterButtons = card.querySelectorAll("[data-filter]");
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");
      applyMemberFilter(membersGrid, org, filter);
    });
  });

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

    let activePhotoIndex = 0;

    const viewer = card.querySelector("[data-photo-viewer]");
    const bg = card.querySelector("[data-gallery-bg]");
    const mainImg = card.querySelector("[data-gallery-main-img]");
    const title = card.querySelector("[data-gallery-title]");
    const date = card.querySelector("[data-gallery-date]");

    function setActivePhoto(index) {
      activePhotoIndex = index;

      const photo = orderedPhotos[activePhotoIndex];
      if (!photo) return;

      const caption = photo.caption?.trim() || "Sin pie de foto";
      const uploadedAt = formatTimestamp(photo.uploadedAt);
      const photoUrl = photo.url || "";

      bg.style.backgroundImage = `url("${photoUrl}")`;
      mainImg.src = photoUrl;
      mainImg.alt = caption;
      title.textContent = caption;
      date.textContent = uploadedAt;

      gallery.querySelectorAll(".photo-thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("is-active", thumbIndex === activePhotoIndex);
      });
    }

    orderedPhotos.forEach((photo, index) => {
      const thumb = document.createElement("button");
      thumb.className = "photo-thumb";
      thumb.type = "button";

      const caption = photo.caption?.trim() || "Sin pie de foto";

      thumb.innerHTML = `
    <img 
      src="${escapeAttribute(photo.url || "")}" 
      alt="${escapeAttribute(caption)}" 
    />
  `;

      thumb.addEventListener("click", () => {
        setActivePhoto(index);
      });

      gallery.appendChild(thumb);
    });

    setActivePhoto(0);

    const prevBtn = card.querySelector("[data-carousel-prev]");
    const nextBtn = card.querySelector("[data-carousel-next]");

    prevBtn?.addEventListener("click", () => {
      const nextIndex =
        activePhotoIndex === 0 ? orderedPhotos.length - 1 : activePhotoIndex - 1;

      setActivePhoto(nextIndex);
    });

    nextBtn?.addEventListener("click", () => {
      const nextIndex =
        activePhotoIndex === orderedPhotos.length - 1 ? 0 : activePhotoIndex + 1;

      setActivePhoto(nextIndex);
    });
  }

  const fileInput = card.querySelector(".file-input");
  const uploadBtn = card.querySelector("[data-action='pick-photo']");

  uploadBtn?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setStatus("La imagen es demasiado grande. Usa una imagen de menos de 4MB.", "is-error");
      fileInput.value = "";
      return;
    }

    openPhotoCaptionModal(org, file, fileInput, uploadBtn);
  });

  bindMemberCardActions(membersGrid, org);

  const membersPrevBtn = card.querySelector("[data-members-prev]");
  const membersNextBtn = card.querySelector("[data-members-next]");

  function getCardStep() {
    const firstCard = membersGrid.querySelector(".member-card");
    if (!firstCard) return 0;

    const styles = getComputedStyle(membersGrid);
    const gap = parseFloat(styles.columnGap || styles.gap || 0);

    return firstCard.getBoundingClientRect().width + gap;
  }

  membersNextBtn?.addEventListener("click", () => {
    membersGrid.scrollBy({
      left: getCardStep(),
      behavior: "smooth"
    });
  });

  membersPrevBtn?.addEventListener("click", () => {
    membersGrid.scrollBy({
      left: -getCardStep(),
      behavior: "smooth"
    });
  });

  return card;
}

function openPhotoCaptionModal(org, file, fileInput, uploadBtn) {
  const modal = document.createElement("div");
  modal.className = "member-modal-overlay";
  modal.style.setProperty("--group-primary-color", org.primaryColor || "#FFF700");
  modal.style.setProperty("--group-primary-rgb", hexToRGB(org.primaryColor || "#FFF700"));

  modal.innerHTML = `
    <div class="member-modal">
      <div class="member-modal__header">
        <h2>Subir foto</h2>
        <button type="button" class="member-modal__close">×</button>
      </div>

      <div class="member-modal__body">
        <label class="member-modal__field">
          <span>Pie de foto</span>
          <input name="caption" type="text" placeholder="Ej: Grafiti visto en la zona..." />
        </label>
      </div>

      <div class="member-modal__actions">
        <button type="button" class="member-modal__cancel">Cancelar</button>
        <button type="button" class="member-modal__save">Subir</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const captionInput = modal.querySelector("[name='caption']");
  const saveBtn = modal.querySelector(".member-modal__save");

  const closeModal = () => {
    fileInput.value = "";
    modal.remove();
  };

  modal.querySelector(".member-modal__close")?.addEventListener("click", closeModal);
  modal.querySelector(".member-modal__cancel")?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  saveBtn?.addEventListener("click", async () => {
    const caption = captionInput?.value.trim() || "";

    if (!caption) {
      setStatus("Introduce un pie de foto.", "is-error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Subiendo...";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Subiendo...";

    try {
      await uploadPhotoForOrganization(org, file, caption);

      setStatus(`Foto subida correctamente al grupo ${org.name}.`, "is-success");
      fileInput.value = "";
      modal.remove();
    } catch (error) {
      console.error(error);

      setStatus(
        `No se pudo subir la foto al grupo ${org.name}. Revisa Firebase Storage y los permisos.`,
        "is-error"
      );

      saveBtn.disabled = false;
      saveBtn.textContent = "Subir";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Subir foto";
    }
  });
}

function openAddMemberModal(org, card, membersGrid) {
  openMemberModal({
    org,
    membersGrid,
    mode: "add"
  });
}

function openEditMemberModal(org, member) {
  openMemberModal({
    org,
    member,
    mode: "edit"
  });
}

function openMemberModal({ org, member = null, membersGrid = null, mode = "add" }) {
  const isEdit = mode === "edit";

  const modal = document.createElement("div");
  modal.className = "member-modal-overlay";
  modal.style.setProperty("--group-primary-color", org.primaryColor || "#FFF700");
  modal.style.setProperty("--group-primary-rgb", hexToRGB(org.primaryColor || "#FFF700"));

  modal.innerHTML = `
    <div class="member-modal">
      <div class="member-modal__header">
        <h2>${isEdit ? "Editar miembro" : "Añadir miembro"}</h2>
        <button type="button" class="member-modal__close">×</button>
      </div>

      <div class="member-modal__body">
        <label class="member-modal__field">
          <span>Nombre</span>
          <input name="firstName" type="text" value="${escapeAttribute(member?.firstName || member?.name || "")}" placeholder="Nombre y apellido" />
        </label>

        <label class="member-modal__field">
          <span>State ID</span>
          <input name="stateId" type="text" value="${escapeAttribute(member?.stateId || member?.id || "")}" placeholder="12345" />
        </label>

        <label class="member-modal__field">
          <span>Foto (URL)</span>
          <input name="photo" type="url" value="${escapeAttribute(member?.photo || "")}" placeholder="https://i.imgur.com/foto.png" />
        </label>

        <label class="member-modal__field">
          <span>Red social</span>
          <input name="social" type="text" value="${escapeAttribute(member?.social || "")}" placeholder="@usuario" />
        </label>

        <label class="member-modal__field">
          <span>Grupo actual</span>
          <input name="currentGroup" type="text" value="${escapeAttribute(member?.currentGroup || org.name || "")}" />
        </label>

        <label class="member-modal__field">
          <span>Grupo anterior</span>
          <input name="previousGroup" type="text" value="${escapeAttribute(member?.previousGroup || "—")}" />
        </label>

        <label class="member-modal__field">
          <span>Cargo</span>
          <input name="role" type="text" value="${escapeAttribute(member?.role || "Miembro")}" />
        </label>

        <label class="member-modal__field">
          <span>Estado</span>
          <select name="status">
            <option value="Activo" ${member?.status === "Activo" ? "selected" : ""}>Activo</option>
            <option value="No activo" ${member?.status === "No activo" ? "selected" : ""}>No activo</option>
            <option value="Investigación" ${member?.status === "Investigación" ? "selected" : ""}>Investigación</option>
          </select>
        </label>
      </div>

      <div class="member-modal__actions">
        <button type="button" class="member-modal__cancel">Cancelar</button>
        <button type="button" class="member-modal__save">${isEdit ? "Guardar cambios" : "Guardar"}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();

  modal.querySelector(".member-modal__close")?.addEventListener("click", closeModal);
  modal.querySelector(".member-modal__cancel")?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  const saveBtn = modal.querySelector(".member-modal__save");

  saveBtn?.addEventListener("click", async () => {
    const updatedMember = {
      firstName: modal.querySelector("[name='firstName']")?.value.trim() || "",
      stateId: modal.querySelector("[name='stateId']")?.value.trim() || "",
      photo: modal.querySelector("[name='photo']")?.value.trim() || "",
      social: modal.querySelector("[name='social']")?.value.trim() || "-",
      currentGroup: modal.querySelector("[name='currentGroup']")?.value.trim() || org.name || "-",
      previousGroup: modal.querySelector("[name='previousGroup']")?.value.trim() || "—",
      role: modal.querySelector("[name='role']")?.value.trim() || "Miembro",
      status: modal.querySelector("[name='status']")?.value || "Activo"
    };

    // Ensure photos array includes initial photo so it appears in member gallery
    const currentUserEmail = auth.currentUser?.email || "Usuario autenticado";
    if (isEdit && member) {
      // preserve existing photos if present, otherwise seed from photo field
      updatedMember.photos = member.photos && member.photos.length ? member.photos : (updatedMember.photo ? [{
        url: updatedMember.photo,
        caption: "",
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUserEmail,
        favorite: member?.photo === updatedMember.photo || true
      }] : []);
    } else {
      updatedMember.photos = updatedMember.photo ? [{
        url: updatedMember.photo,
        caption: "",
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUserEmail,
        favorite: true
      }] : [];
    }

    if (!updatedMember.firstName || !updatedMember.stateId) {
      setStatus("Completa nombre y State ID.", "is-error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? "Guardando..." : "Añadiendo...";

    try {
      if (isEdit && member) {
        await updateDoc(doc(db, "criminalOrganizations", org.id), {
          members: arrayRemove(member)
        });

        await updateDoc(doc(db, "criminalOrganizations", org.id), {
          members: arrayUnion(updatedMember)
        });

        setStatus("Miembro editado correctamente.", "is-success");
      } else {
        await updateDoc(doc(db, "criminalOrganizations", org.id), {
          members: arrayUnion(updatedMember)
        });

        setStatus(`Miembro agregado a ${org.name}.`, "is-success");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      setStatus("No se pudo guardar el miembro.", "is-error");
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? "Guardar cambios" : "Guardar";
    }
  });
}

function renderOrganizations() {
  destroyRenderedMaps();
  groupsGrid.innerHTML = "";
  const term = searchInput?.value || "";

  const filteredOrganizations = term.trim() ? getOrgMatches(term) : organizations.filter(hasValidOrganizationName);

  setGroupCount(filteredOrganizations.length);

  if (!filteredOrganizations.length) {
    groupsGrid.appendChild(
      createEmptyState("No se han encontrado resultados")
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

  const graffitiPoints = Array.isArray(org.graffiti) ? org.graffiti : Array.isArray(org.grafitis) ? org.grafitis : [];
  graffitiPoints.forEach((graffiti) => {
    const coords = firestorePointToLeaflet(graffiti.location || graffiti.point || graffiti);
    if (!coords) return;

    const marker = L.circleMarker(coords, {
      radius: 8,
      fillColor: org.primaryColor || '#34d6ff',
      color: org.secondaryColor || '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    }).addTo(groupLayer2);

    marker.bindPopup(`Grafiti: ${escapeHtml(graffiti.name || graffiti.tag || graffiti.caption || 'punto')}<br>${escapeHtml(graffiti.description || graffiti.detail || '')}`);
  });

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
      populateAutocomplete(searchInput?.value || "");
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

function populateAutocomplete(term) {
  if (!autocompleteList) return;
  const value = (term || "").toString().trim();

  const matches = value ? getOrgMatches(value) : organizations.filter(hasValidOrganizationName);

  autocompleteList.innerHTML = '';

  if (!matches || !matches.length) {
    autocompleteList.innerHTML = value
      ? '<div class="autocomplete-empty">No se han encontrado resultados</div>'
      : 'Sugerencias: ' + (organizations.map(o => o.name).join(', '));

    return;
  }

  matches.forEach(org => {
    const div = document.createElement('div');
    div.setAttribute('data-suggestion', 'true');
    div.setAttribute('data-value', org.name || '');
    div.style.padding = '6px 8px';
    div.style.cursor = 'pointer';
    div.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
    div.innerHTML = `<strong style="color:var(--nav-glow)">${escapeHtml(org.name)}</strong> <span style="color:var(--muted); margin-left:8px">${escapeHtml((org.aliases || []).slice(0, 2).join(', '))}</span>`;
    autocompleteList.appendChild(div);
  });
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

function joinOrList(value, fallback = '-') {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : fallback;
  }

  if (typeof value === 'string' && value.trim()) return value;

  return fallback;
}

function getDangerLabel(org) {
  const level = org.danger || org.peligrosidad || org.dangerLevel || org.risk || "media";
  const map = {
    baja: "Baja",
    baja0: "Baja",
    media: "Media",
    alta: "Alta",
    critica: "Crítica",
    crítica: "Crítica",
    critical: "Crítica"
  };

  return map[String(level).toLowerCase()] || String(level);
}

function renderStatusBadge(org) {
  const state = org.status || org.estado;
  if (!state) return '';

  const status = state.toString().toLowerCase();
  let color = "#999";
  let emoji = "⚪";

  if (status.includes("activo")) {
    color = "#38d98e"; emoji = "🟢";
  } else if (status.includes("investig")) {
    color = "#ffd621"; emoji = "🟡";
  } else if (status.includes("no") || status.includes("inactivo")) {
    color = "#ff5f6d"; emoji = "🔴";
  }

  return `<div style="display:flex; align-items:center; gap:8px; justify-content:flex-end"><div style="font-weight:900; color:${color}">${emoji}</div><div style="font-weight:800">${escapeHtml(String(state))}</div></div>`;
}

function renderMemberCard(org, m, index) {
  const photo = m.photo || m.avatar || m.image || "assets/images/miembros/default.png";
  const fullName = `${m.firstName || m.name || ""} ${m.lastName || m.surname || ""}`.trim() || "Sin nombre";
  const stateId = m.stateId || m.id || m.stateID || "-";
  const social = m.social || m.handle || m.twitter || m.red || "-";
  const role = m.role || m.cargo || "Miembro";
  const status = m.status || m.estado || "—";
  const currentGroup = m.currentGroup || m.grupoActual || m.organizacion || org.abbreviation || org.code || org.name || "-";
  const previousGroup = m.previousGroup || m.grupoAnterior || m.previous || "—";
  const isActive = status.toLowerCase() === "activo";

  return `
    <article class="group-card member-card" data-member-index="${index}">
      <div class="member-card__state-id">ID: ${escapeHtml(stateId)}</div>

      <div class="member-card__actions">
          <button class="member-action-btn member-action-btn--edit" type="button" data-action="edit-member" data-member-index="${index}">✏️</button>
          <button class="member-action-btn member-action-btn--gallery" type="button" data-action="open-gallery" data-member-index="${index}">🖼️</button>
          <button class="member-action-btn member-action-btn--delete" type="button" data-action="delete-member" data-member-index="${index}">❌</button>
      </div>

      <div class="member-card__photo">
        <img src="${escapeAttribute(photo)}" alt="${escapeAttribute(fullName)}" />
      </div>

      <div style="font-weight:800; margin-bottom:6px;">${escapeHtml(fullName)}</div>
      <div style="font-size:0.9rem; color:var(--muted)">Red social: ${escapeHtml(social)}</div>
      <div style="font-size:0.9rem; color:var(--muted)">Grupo actual: ${escapeHtml(currentGroup)}</div>
      <div style="font-size:0.9rem; color:var(--muted)">Grupo anterior: ${escapeHtml(previousGroup)}</div>
      <div style="font-size:0.9rem; color:var(--muted)">Cargo: ${escapeHtml(role)}</div>
      <div style="margin-top:10px; font-weight:800; color:${isActive ? "#38d98e" : "#ff5f6d"}">${escapeHtml(status)}</div>
    </article>
  `;
}
function renderMembersGrid(org) {
  const members = Array.isArray(org.members) ? org.members : [];
  if (!members.length) return "";

  return members.map((m, index) => renderMemberCard(org, m, index)).join("");
}

function bindMemberCardActions(membersGrid, org) {
  if (!membersGrid) return;

  membersGrid.onclick = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const index = Number(button.dataset.memberIndex);
    const member = org.members?.[index];

    if (!member) return;

    if (button.dataset.action === "delete-member") {
      deleteMember(org, member);
    }

    if (button.dataset.action === "edit-member") {
      openEditMemberModal(org, member);
    }
    
    if (button.dataset.action === "open-gallery") {
      openMemberGalleryModal(org, member, index, membersGrid);
    }
  };
}

function openMemberGalleryModal(org, member, memberIndex, membersGrid) {
  let photos = Array.isArray(member.photos) ? [...member.photos] : [];

  // If member has a main `photo` field but it's not present in photos array, include it
  if (member.photo && !photos.find(p => p.url === member.photo)) {
    photos.unshift({
      url: member.photo,
      caption: '',
      uploadedAt: member.uploadedAt || new Date().toISOString(),
      uploadedBy: member.uploadedBy || auth.currentUser?.email || 'usuario',
      favorite: true
    });
  } else {
    // sync favorite flags with member.photo when available
    photos = photos.map(p => ({ ...p, favorite: member.photo ? p.url === member.photo : !!p.favorite }));
  }

  const modal = document.createElement("div");
  modal.className = "member-modal-overlay";
  modal.style.setProperty("--group-primary-color", org.primaryColor || "#FFF700");
  modal.style.setProperty("--group-primary-rgb", hexToRGB(org.primaryColor || "#FFF700"));

  modal.innerHTML = `
    <div class="member-modal" style="max-width:900px;">
      <div class="member-modal__header">
        <h2>Galería — ${escapeHtml(member.firstName || member.name || 'Miembro')}</h2>
        <button type="button" class="member-modal__close">×</button>
      </div>

      <div class="member-modal__body">
        <div class="photo-gallery-viewer" style="min-height:260px;">
          <div class="photo-gallery-bg" data-gallery-bg></div>
          <button class="photo-gallery-arrow photo-gallery-arrow--prev" type="button" data-gallery-prev>‹</button>
          <div class="photo-gallery-main" style="width:360px; margin:0 auto; position:relative;">
            <img data-gallery-main-img src="" alt="Foto principal" />
          </div>
          <button class="photo-gallery-arrow photo-gallery-arrow--next" type="button" data-gallery-next>›</button>
          <div class="photo-gallery-thumbs" data-gallery style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; max-height:200px; overflow:auto;"></div>
        </div>

        <div style="margin-top:16px; display:flex; gap:8px; align-items:center;">
          <input name="photoUrl" type="url" placeholder="https://.../imagen.jpg" style="flex:1; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:#070707; color:#fff;" />
          <input name="photoCaption" type="text" placeholder="Pie de foto (opcional)" style="flex:1; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:#070707; color:#fff;" />
          <button type="button" class="upload-btn" data-action="upload-url">Subir URL</button>
        </div>
      </div>

      <div class="member-modal__actions">
        <button type="button" class="member-modal__cancel">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();

  modal.querySelector(".member-modal__close")?.addEventListener("click", closeModal);
  modal.querySelector(".member-modal__cancel")?.addEventListener("click", closeModal);
  modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });

  const galleryEl = modal.querySelector('[data-gallery]');
  const mainImg = modal.querySelector('[data-gallery-main-img]');
  const urlInput = modal.querySelector("[name='photoUrl']");
  const captionInput = modal.querySelector("[name='photoCaption']");
  const uploadUrlBtn = modal.querySelector('[data-action="upload-url"]');
  const prevBtn = modal.querySelector('[data-gallery-prev]');
  const nextBtn = modal.querySelector('[data-gallery-next]');

  let activeIndex = 0;

  function renderThumbs() {
    galleryEl.innerHTML = "";

    if (!photos.length) {
      galleryEl.appendChild(createEmptyState('No hay fotos para este sujeto.'));
      mainImg.src = member.photo || 'assets/images/miembros/default.png';
      return;
    }

    // ensure main image shows the favorite photo when present
    const fav = photos.find(p => p.favorite);
    if (fav) activeIndex = photos.findIndex(p => p.url === fav.url);
    if (typeof activeIndex !== 'number' || activeIndex < 0) activeIndex = 0;

    photos.forEach((photo, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-thumb';
      btn.style.position = 'relative';
      btn.innerHTML = `
        <img src="${escapeAttribute(photo.url || '')}" alt="${escapeAttribute(photo.caption || '')}" />
      `;

      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'photo-fav-btn';
      favBtn.textContent = photo.favorite ? '★' : '☆';
      favBtn.title = photo.favorite ? 'Favorita' : 'Marcar como favorita';
      if (photo.favorite) favBtn.classList.add('is-favorite');

      favBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          await setFavoritePhotoForMember(org, member, photo, membersGrid, memberIndex);
          // update local photos
          photos.forEach(p => p.favorite = p.url === photo.url);
          activeIndex = photos.findIndex(p => p.url === photo.url);
          renderThumbs();
        } catch (err) {
          console.error(err);
          setStatus('No se pudo marcar la foto como favorita.', 'is-error');
        }
      });

      btn.addEventListener('click', () => {
        activeIndex = idx;
        mainImg.src = photo.url || '';
        // update active class
        galleryEl.querySelectorAll('.photo-thumb').forEach((t, ti) => t.classList.toggle('is-active', ti === activeIndex));
      });

      // set is-active class if matches activeIndex
      if (idx === activeIndex) btn.classList.add('is-active');

      btn.appendChild(favBtn);
      galleryEl.appendChild(btn);
    });
    // set main image to activeIndex
    mainImg.src = photos[activeIndex]?.url || member.photo || 'assets/images/miembros/default.png';

    // bind prev/next
    prevBtn?.addEventListener('click', () => {
      if (!photos.length) return;
      activeIndex = (activeIndex - 1 + photos.length) % photos.length;
      mainImg.src = photos[activeIndex].url;
      galleryEl.querySelectorAll('.photo-thumb').forEach((t, ti) => t.classList.toggle('is-active', ti === activeIndex));
      // scroll thumb into view
      galleryEl.querySelectorAll('.photo-thumb')[activeIndex]?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    });

    nextBtn?.addEventListener('click', () => {
      if (!photos.length) return;
      activeIndex = (activeIndex + 1) % photos.length;
      mainImg.src = photos[activeIndex].url;
      galleryEl.querySelectorAll('.photo-thumb').forEach((t, ti) => t.classList.toggle('is-active', ti === activeIndex));
      galleryEl.querySelectorAll('.photo-thumb')[activeIndex]?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    });
  }

  uploadUrlBtn?.addEventListener('click', async () => {
    const url = (urlInput.value || '').trim();
    const caption = (captionInput.value || '').trim();
    if (!url) return setStatus('Introduce una URL válida.', 'is-error');

    uploadUrlBtn.disabled = true;
    uploadUrlBtn.textContent = 'Subiendo...';

    try {
      const newPhoto = {
        url,
        caption,
        uploadedAt: new Date().toISOString(),
        uploadedBy: auth.currentUser?.email || 'usuario'
      };

      await addPhotoUrlForMember(org, member, newPhoto, membersGrid);

      // reflect locally
      photos.unshift(newPhoto);
      urlInput.value = '';
      captionInput.value = '';
      renderThumbs();
      setStatus('Foto añadida correctamente.', 'is-success');
    } catch (err) {
      console.error(err);
      setStatus('No se pudo añadir la foto.', 'is-error');
    } finally {
      uploadUrlBtn.disabled = false;
      uploadUrlBtn.textContent = 'Subir URL';
    }
  });

  renderThumbs();
}

async function addPhotoUrlForMember(org, member, photoObject, membersGrid) {
  try {
    // remove old member object and add updated one with new photos array
    const original = member;
    const currentPhotos = Array.isArray(member.photos) ? [...member.photos] : [];

    // avoid duplicate URLs
    const exists = currentPhotos.find(p => p.url === photoObject.url);
    const newPhotos = exists ? currentPhotos : [{ ...photoObject, favorite: false }, ...currentPhotos];

    const updatedMember = { ...member, photos: newPhotos };

    await updateDoc(doc(db, 'criminalOrganizations', org.id), { members: arrayRemove(original) });
    await updateDoc(doc(db, 'criminalOrganizations', org.id), { members: arrayUnion(updatedMember) });
  } catch (err) {
    throw err;
  }
}

async function setFavoritePhotoForMember(org, member, photo, membersGrid, memberIndex = null) {
  try {
    const original = member;
    let currentPhotos = Array.isArray(member.photos) ? member.photos.map(p => ({ ...p })) : [];

    // If the selected photo is not in the photos array, add it
    if (!currentPhotos.find(p => p.url === photo.url)) {
      currentPhotos.unshift({ ...photo, favorite: true });
    }

    currentPhotos = currentPhotos.map(p => ({ ...p, favorite: p.url === photo.url }));

    const updatedMember = { ...member, photos: currentPhotos, photo: photo.url };

    await updateDoc(doc(db, 'criminalOrganizations', org.id), { members: arrayRemove(original) });
    await updateDoc(doc(db, 'criminalOrganizations', org.id), { members: arrayUnion(updatedMember) });
    // Optimistically update the member card image in the DOM that opened the modal
    try {
      if (membersGrid && typeof memberIndex === 'number') {
        const card = membersGrid.querySelector(`.member-card[data-member-index="${memberIndex}"]`);
        if (card) {
          const img = card.querySelector('.member-card__photo img');
          if (img) img.src = photo.url;
        }
      }
    } catch (err) {
      // non-fatal DOM update
      console.warn('No se pudo actualizar la tarjeta del miembro en el DOM:', err);
    }
  } catch (err) {
    throw err;
  }
}

async function deleteMember(org, member) {
  const name = member.firstName || member.name || "este miembro";
  const confirmed = confirm(`¿Seguro que quieres eliminar a ${name}?`);

  if (!confirmed) return;

  try {
    await updateDoc(doc(db, "criminalOrganizations", org.id), {
      members: arrayRemove(member)
    });

    setStatus("Miembro eliminado correctamente.", "is-success");
  } catch (error) {
    console.error(error);
    setStatus("No se pudo eliminar el miembro.", "is-error");
  }
}

function applyMemberFilter(container, org, filter) {
  const members = Array.isArray(org.members) ? org.members : [];

  const filtered = members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => {
      const status = (member.status || "").toString().toLowerCase();
      const role = (member.role || member.cargo || "").toString().toLowerCase();

      if (filter === "active") return status === "activo";
      if (filter === "inactive") return status !== "activo";
      if (filter === "camello") return role.includes("camell");
      return true;
    });

  container.innerHTML = "";

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No hay miembros que coincidan con el filtro.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(({ member, index }) => renderMemberCard(org, member, index))
    .join("");

  bindMemberCardActions(container, org);
}

function getOrgMatches(term) {
  const s = normalizeText(term || '');
  if (!s) return [];

  return organizations.filter(org => {
    if (!hasValidOrganizationName(org)) return false;

    const name = normalizeText(org.name);
    if (name.includes(s)) return true;

    const abbrev = normalizeText(org.abbreviation || org.code || org.abbr || '');
    if (abbrev && abbrev.includes(s)) return true;

    const aliases = Array.isArray(org.aliases) ? org.aliases : [];
    for (const a of aliases) {
      if (normalizeText(a).includes(s)) return true;
    }

    return false;
  });
}

function initSearch() {
  if (!searchInput) return;

  let debounceTimer = null;

  const onInput = (e) => {
    const value = e.target.value || "";
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      populateAutocomplete(value);
      renderOrganizations();
    }, 180);
  };

  searchInput.addEventListener("input", onInput);

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      populateAutocomplete(searchInput.value || '');
      renderOrganizations();
    });
  }

  if (autocompleteList) {
    autocompleteList.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-suggestion]');
      if (!el) return;
      const val = el.getAttribute('data-value') || el.textContent;
      searchInput.value = val;
      renderOrganizations();
      autocompleteList.innerHTML = '';
    });
  }
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