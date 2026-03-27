import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const form = document.getElementById("loginForm");
const alertContainer = document.getElementById("alert-container");

function showAlert(type, message, duration = 3000) {
  if (!alertContainer) return;

  alertContainer.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      <b>${message}</b>
    </div>
  `;

  const alertEl = alertContainer.querySelector(".alert");

  setTimeout(() => {
    if (!alertEl) return;

    alertEl.classList.add("alert-hide");

    setTimeout(() => {
      alertContainer.innerHTML = "";
    }, 280);
  }, duration);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.querySelector("#username")?.value.trim();
    const password = document.querySelector("#password")?.value;

    if (!username || !password) {
      showAlert("warning", "Debes introducir usuario y contraseña.", 3000);
      return;
    }

    const email = `${username}@cid.com`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showAlert("success", "Acceso autorizado. Redirigiendo...", 1500);
    } catch (error) {
      showAlert("danger", "Usuario o contraseña incorrectos.", 3000);
      console.error(error);
    }
  });
}