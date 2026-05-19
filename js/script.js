import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
const links = document.querySelectorAll(".cid-nav__link");
const light = document.querySelector(".cid-nav__light");
const authNavBtn = document.getElementById("authNavBtn");
let navInitialized = false;

function redirectToLogin() {
  window.location.href = "login.html";
}

function moveLight(linkElement) {
  if (!light || !linkElement || !linkElement.parentElement) return;

  const linkRect = linkElement.getBoundingClientRect();
  const parentRect = linkElement.parentElement.getBoundingClientRect();
  const left =
    linkRect.left -
    parentRect.left +
    (linkRect.width / 2) -
    (light.offsetWidth / 2);

  light.style.left = `${left}px`;
}



function initNav() {
  if (navInitialized) return;
  navInitialized = true;

  if (!links.length || !light) return;

  links.forEach((link) => {
    link.addEventListener("click", () => {
      links.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      moveLight(link);
    });
  });

  const active = document.querySelector(".cid-nav__link.active");
  if (active) {
    moveLight(active);
  }

  window.addEventListener("resize", () => {
    const currentActive = document.querySelector(".cid-nav__link.active");
    if (currentActive) moveLight(currentActive);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  initNav();

  if (authNavBtn) {
    const username = user.email?.split("@")[0] || "Usuario";

    authNavBtn.textContent = username;

    authNavBtn.onclick = async () => {
      await signOut(auth);
      window.location.href = "login.html";
    };
  }

  requestAnimationFrame(() => {
    const active = document.querySelector(".cid-nav__link.active");
    if (active) {
      moveLight(active);
    }

    document.body.classList.remove("auth-loading");
  });
});
