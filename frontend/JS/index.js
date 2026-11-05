// update code

import {
  auth,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
} from "../firebase-config.js";

import { getAdditionalUserInfo } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// ==============================
// 1. SELECT ELEMENTS
// ==============================

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const createLink = document.getElementById("createLink");
const promptText = document.getElementById("promptText");
const promptAction = document.getElementById("promptAction");

let mode = "login";

// ==============================
// 2. SWITCH BETWEEN LOGIN AND SIGNUP
// ==============================

function showLogin() {
  mode = "login";

  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");

  loginTab.classList.add("active");
  signupTab.classList.remove("active");

  promptText.textContent = "Don't have an account?";
  promptAction.textContent = "Create Account";
}

function showSignup() {
  mode = "signup";

  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");

  signupTab.classList.add("active");
  loginTab.classList.remove("active");

  promptText.textContent = "Already have an account?";
  promptAction.textContent = "Log In";
}

loginTab.addEventListener("click", showLogin);
signupTab.addEventListener("click", showSignup);

// One button, one listener: it flips whichever mode is active
createLink.addEventListener("click", () => {
  mode === "login" ? showSignup() : showLogin();
});

// ==============================
// 3. SHOW / HIDE PASSWORD
// ==============================

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const iconUse = button.querySelector("use");
    const showing = input.type === "text";

    input.type = showing ? "password" : "text";
    iconUse.setAttribute("href", showing ? "#i-eye" : "#i-eye-off");
    button.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  });
});

// ==============================
// 4. LOGIN FORM SUBMISSION
// ==============================

login.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Please complete all fields.");
    return;
  }

  // Backend authentication will be connected here.
  // alert("Login interface working! Connect backend authentication next.");

  const submitButton = login.querySelector('button[type="submit"]');

  submitButton.disabled = true;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    console.log("Authenticated user:", user.uid);

    

    window.location.href = "../HTML/dashbroad.html";
  } catch (error) {
    console.error("Login error:", error.code, error.message);

    if (error.code === "auth/invalid-credential") {
      alert("Incorrect email or password.");
    } else if (error.code === "auth/user-not-found") {
      alert("No account found with this email.");
    } else if (error.code === "auth/too-many-requests") {
      alert("Too many attempts. Please try again later.");
    } else {
      alert("Login failed. Please check your details and try again.");
    }
  } finally {
    submitButton.disabled = false;
  }
});

// ==============================
// 5. SIGNUP FORM SUBMISSION
// ==============================

signup.addEventListener("submit", async function (event) {
  event.preventDefault();

  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();

  if (!fullName || !email || !password || !confirmPassword) {
    alert("Please complete all fields.");
    return;
  }

  if (password.length < 8) {
    alert("Password must contain at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  const submitButton = signup.querySelector('button[type="submit"]');

  submitButton.disabled = true;

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    await updateProfile(user, {
      displayName: fullName,
    });

    

    console.log("Registered user:", user.uid);

    window.location.href = "../HTML/BussinessSetup.html";
    // TEMPORARY:
    // Replace this alert with dashboard navigation
    // when the dashboard page is ready.
  } catch (error) {
    console.error("Signup error:", error.code, error.message);

    if (error.code === "auth/email-already-in-use") {
      alert("This email already has an account. Please log in.");
    } else if (error.code === "auth/invalid-email") {
      alert("Please enter a valid email address.");
    } else if (error.code === "auth/weak-password") {
      alert("Your password is too weak.");
    } else {
      alert("Account creation failed. Please try again.");
    }
  } finally {
    submitButton.disabled = false;
  }
});

// ==============================
// 6. GOOGLE SIGN-IN
// ==============================

googleLogin.addEventListener("click", async function () {
  googleLogin.disabled = true;

  try {

    console.log("Google authenticated user:", user.uid);


    const info = getAdditionalUserInfo(result);

    window.location.href = info && info.isNewUser
      ? "BussinessSetup.html"
      : "Dashbroad.html";

  } catch (error) {
    console.error("Google sign-in error:", error.code, error.message);

    if (error.code === "auth/popup-closed-by-user") {
      alert("Google sign-in was cancelled.");
    } else if (error.code === "auth/popup-blocked") {
      alert("Your browser blocked the Google sign-in popup.");
    } else {
      alert("Google sign-in failed. Please try again.");
    }
  } finally {
    googleLogin.disabled = false;
  }
});

// ==============================
// 7. FORGOT PASSWORD
// ==============================

forgotPassword.localaddEventListener("click", async function (event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    alert("Please enter your email address first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    alert("Password reset email sent. Check your inbox.");
  } catch (error) {
    console.error("Password reset error:", error.code, error.message);

    if (error.code === "auth/invalid-email") {
      alert("Please enter a valid email address.");
    } else {
      alert("Unable to send password reset email. Please try again.");
    }
  }
});
