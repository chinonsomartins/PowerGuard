import { auth } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Resolves with the signed-in Firebase user, or sends the visitor to the login page.
export function requireUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      resolve(user);
    });
  });
}