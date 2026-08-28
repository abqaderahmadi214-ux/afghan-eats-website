(function () {
  "use strict";

  const state = { googleCredential: "" };

  const apiBase = () => String((window.AFGHAN_EATS_CONFIG || {}).apiBaseUrl || "").replace(/\/$/, "");
  const isFa = () => (typeof window.lang !== "undefined" ? window.lang === "fa" : document.documentElement.lang === "fa");
  const text = (en, fa) => (isFa() ? fa : en);
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function parseError(raw, status) {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.json?.message || parsed?.error?.message || `Request failed (${status})`;
    } catch {
      return raw || `Request failed (${status})`;
    }
  }

  async function query(path, input) {
    const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
    const response = await fetch(`${apiBase()}/api/trpc/${path}?input=${encoded}`, {
      headers: { Accept: "application/json" },
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(parseError(raw, response.status));
    const parsed = JSON.parse(raw);
    return parsed?.result?.data?.json ?? parsed?.result?.data ?? parsed;
  }

  async function mutate(path, input) {
    const response = await fetch(`${apiBase()}/api/trpc/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ json: input }),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(parseError(raw, response.status));
    const parsed = JSON.parse(raw);
    return parsed?.result?.data?.json ?? parsed?.result?.data ?? parsed;
  }

  function loadGoogleScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.querySelector("script[data-ae-google-identity]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.aeGoogleIdentity = "1";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Google sign-in could not be loaded"));
      document.head.appendChild(script);
    });
  }

  async function googleConfig() {
    const config = await query("identity.googleConfig", null);
    if (!config?.enabled || !config?.clientId) throw new Error("Google sign-in is not available yet");
    return config;
  }

  async function renderGoogleButton(container, callback) {
    try {
      const config = await googleConfig();
      await loadGoogleScript();
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
        width: container.clientWidth || 320,
      });
    } catch {
      container.innerHTML = `<button class="btn btn-light" type="button" disabled style="width:100%">${esc(text("Google sign-in unavailable", "ورود با گوگل فعلاً در دسترس نیست"))}</button>`;
    }
  }

  function storeCustomer(data) {
    if (!data?.token) throw new Error("A secure customer session was not returned");
    sessionStorage.setItem("ae_customer_token", data.token);
    localStorage.removeItem("ae_customer_token");
    localStorage.setItem("ae_customer_hint", JSON.stringify(data.customer || {}));
    const requested = new URLSearchParams(location.search).get("return") || "";
    if (requested.startsWith("/") && !requested.startsWith("//")) location.href = requested;
    else location.reload();
  }

  function customerError(message) {
    const output = document.getElementById("customerAuthError");
    if (!output) return;
    if (message) {
      output.className = "notice error";
      output.textContent = message;
    } else {
      output.classList.add("hidden");
    }
  }

  async function customerGoogleCallback(response) {
    try {
      customerError("");
      state.googleCredential = String(response?.credential || "");
      if (!state.googleCredential) throw new Error("Google did not return a sign-in credential");
      const result = await mutate("identity.customerGoogle", { credential: state.googleCredential });
      if (result?.needsPhone) {
        const wrap = document.getElementById("aeGooglePhoneWrap");
        const email = document.getElementById("aeGoogleEmailHint");
        if (email) email.textContent = result.googleProfile?.email || "";
        wrap?.classList.remove("hidden");
        wrap?.querySelector("input")?.focus();
        return;
      }
      storeCustomer(result);
    } catch (error) {
      customerError(error instanceof Error ? error.message : "Google sign-in failed");
    }
  }

  async function finishCustomerGoogle(event) {
    event.preventDefault();
    const phone = String(new FormData(event.currentTarget).get("phone") || "");
    try {
      const result = await mutate("identity.customerGoogle", { credential: state.googleCredential, phone });
      storeCustomer(result);
    } catch (error) {
      customerError(error instanceof Error ? error.message : "Google account could not be created");
    }
  }

  async function customerEmailLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const result = await mutate("identity.customerEmailLogin", {
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      storeCustomer(result);
    } catch (error) {
      customerError(error instanceof Error ? error.message : "Email sign-in failed");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function initCustomer() {
    const auth = document.getElementById("customerAuth");
    if (!auth) return;
    const tabs = auth.querySelector(".customer-auth-tabs");
    if (!tabs || document.getElementById("aeIdentityOptions")) return;

    const block = document.createElement("div");
    block.id = "aeIdentityOptions";
    block.innerHTML = `
      <div style="margin:18px 0 16px">
        <div id="aeCustomerGoogle" style="min-height:44px"></div>
        <div style="display:flex;align-items:center;gap:12px;margin:14px 0;color:#78847f;font-size:12px"><span style="height:1px;background:#dce4e0;flex:1"></span><span>${esc(text("or", "یا"))}</span><span style="height:1px;background:#dce4e0;flex:1"></span></div>
        <details id="aeEmailLoginDetails">
          <summary style="cursor:pointer;font-weight:800;color:#1d654f;margin-bottom:12px">${esc(text("Continue with email", "ادامه با ایمیل"))}</summary>
          <form id="aeEmailLoginForm" class="grid2">
            <label class="field full"><span>${esc(text("Email address", "آدرس ایمیل"))}</span><input name="email" type="email" autocomplete="email" required></label>
            <label class="field full"><span>${esc(text("Password", "رمز عبور"))}</span><input name="password" type="password" autocomplete="current-password" required></label>
            <button class="btn btn-primary field full" type="submit">${esc(text("Sign in with email", "ورود با ایمیل"))}</button>
          </form>
        </details>
        <div id="aeGooglePhoneWrap" class="notice hidden" style="margin-top:14px">
          <b>${esc(text("One last step", "یک مرحله دیگر"))}</b>
          <p style="margin:6px 0 10px">${esc(text("Add your mobile number so Afghan Eats can contact you about deliveries. Google email:", "شماره موبایل خود را اضافه کنید تا افغان ایتس درباره تحویل سفارش با شما تماس بگیرد. ایمیل گوگل:"))} <span id="aeGoogleEmailHint"></span></p>
          <form id="aeGooglePhoneForm" class="grid2">
            <label class="field full"><span>${esc(text("Mobile number", "شماره موبایل"))}</span><input name="phone" type="tel" placeholder="+93" required></label>
            <button class="btn btn-primary field full" type="submit">${esc(text("Create account and continue", "ساخت حساب و ادامه"))}</button>
          </form>
        </div>
      </div>`;

    tabs.insertAdjacentElement("afterend", block);
    document.getElementById("aeEmailLoginForm")?.addEventListener("submit", customerEmailLogin);
    document.getElementById("aeGooglePhoneForm")?.addEventListener("submit", finishCustomerGoogle);
    const googleBox = document.getElementById("aeCustomerGoogle");
    if (googleBox) void renderGoogleButton(googleBox, customerGoogleCallback);
  }

  function decodeGoogleProfile(credential) {
    try {
      const raw = credential.split(".")[1];
      if (!raw) return {};
      const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(atob(padded));
    } catch {
      return {};
    }
  }

  async function riderApplicationGoogleCallback(response) {
    const credential = String(response?.credential || "");
    if (!credential) return;
    state.googleCredential = credential;
    const profile = decodeGoogleProfile(credential);
    const form = document.querySelector("#apply form");
    const email = form?.querySelector('input[name="email"]');
    const name = form?.querySelector('input[name="fullName"]');
    if (email && profile.email) email.value = String(profile.email);
    if (name && !name.value && profile.name) name.value = String(profile.name);
    const status = document.getElementById("aeRiderGoogleStatus");
    if (status) {
      status.className = "notice success";
      status.textContent = profile.email
        ? text(`Google email selected: ${profile.email}`, `ایمیل گوگل انتخاب شد: ${profile.email}`)
        : text("Google account selected.", "حساب گوگل انتخاب شد.");
    }
  }

  function initRiderApplication() {
    const form = document.querySelector("#apply form");
    if (!form || document.getElementById("aeRiderEmail")) return;

    const phoneLabel = form.querySelector('input[name="phone"]')?.closest("label");
    if (phoneLabel) {
      const emailLabel = document.createElement("label");
      emailLabel.className = "field";
      emailLabel.id = "aeRiderEmail";
      emailLabel.innerHTML = `<span>${esc(text("Email address", "آدرس ایمیل"))}</span><input name="email" type="email" autocomplete="email" required>`;
      phoneLabel.insertAdjacentElement("afterend", emailLabel);
    }

    const intro = document.createElement("div");
    intro.style.margin = "14px 0 18px";
    intro.innerHTML = `<div id="aeRiderGoogle" style="min-height:44px"></div><div id="aeRiderGoogleStatus" class="notice hidden" style="margin-top:10px"></div><p class="muted" style="font-size:12px;margin-top:10px">${esc(text("Google is optional. If used, Afghan Eats verifies the selected email when your application is submitted.", "استفاده از گوگل اختیاری است. در صورت استفاده، افغان ایتس هنگام ارسال درخواست ایمیل انتخاب‌شده را تأیید می‌کند."))}</p>`;
    form.insertAdjacentElement("beforebegin", intro);
    const googleBox = document.getElementById("aeRiderGoogle");
    if (googleBox) void renderGoogleButton(googleBox, riderApplicationGoogleCallback);

    window.submitRiderApplication = async function submitRiderApplication(event) {
      event.preventDefault();
      const current = event.currentTarget;
      const output = document.getElementById("riderResult");
      const button = current.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (output) output.className = "notice hidden";
      try {
        const data = new FormData(current);
        const payload = {
          fullName: String(data.get("fullName") || ""),
          phone: String(data.get("phone") || ""),
          email: String(data.get("email") || ""),
          whatsapp: String(data.get("whatsapp") || ""),
          vehicle: String(data.get("vehicle") || "motorcycle"),
          serviceArea: String(data.get("serviceArea") || ""),
          emergencyContact: String(data.get("emergencyContact") || ""),
          experience: String(data.get("experience") || ""),
          notes: String(data.get("notes") || ""),
        };
        if (state.googleCredential) payload.googleCredential = state.googleCredential;
        const result = await mutate("identity.riderApply", payload);
        if (output) {
          output.className = "notice success";
          output.innerHTML = `${result.duplicate ? "✓ Existing application found." : "✓ Rider application received."} <b>${esc(result.reference)}</b><br><span class="muted">${esc(text("Keep this reference to check your application status.", "این شماره پیگیری را نگه دارید."))}</span>`;
        }
        localStorage.setItem("ae_rider_reference", result.reference);
        if (!result.duplicate) {
          current.reset();
          state.googleCredential = "";
          document.getElementById("aeRiderGoogleStatus")?.classList.add("hidden");
        }
      } catch (error) {
        if (output) {
          output.className = "notice error";
          output.textContent = error instanceof Error ? error.message : "Application could not be submitted.";
        }
      } finally {
        if (button) button.disabled = false;
      }
    };
  }

  function riderPortalError(form, message) {
    const output = form.querySelector(".portal-login-error");
    if (!output) return;
    output.className = "notice error portal-login-error";
    output.textContent = message;
  }

  async function completeRiderPortalLogin(data) {
    if (typeof window.portalSaveSession !== "function") throw new Error("Rider portal session handler is unavailable");
    window.portalSaveSession(data, "rider");
    if (typeof window.showRiderDashboard === "function") window.showRiderDashboard();
    else location.reload();
  }

  function initRiderPortal() {
    const auth = document.getElementById("riderAuth");
    const form = auth?.querySelector("form");
    if (!form || document.getElementById("aeRiderPortalGoogle")) return;

    const username = form.querySelector('input[name="username"]');
    if (username) {
      username.inputMode = "email";
      username.placeholder = text("Email, phone or username", "ایمیل، شماره تماس یا نام کاربری");
      const label = username.closest("label")?.querySelector(".en-copy");
      if (label) label.textContent = "Email / phone / username";
    }

    const block = document.createElement("div");
    block.style.margin = "14px 0 18px";
    block.innerHTML = `<div id="aeRiderPortalGoogle" style="min-height:44px"></div><div style="display:flex;align-items:center;gap:12px;margin:12px 0;color:#78847f;font-size:12px"><span style="height:1px;background:#dce4e0;flex:1"></span><span>${esc(text("or", "یا"))}</span><span style="height:1px;background:#dce4e0;flex:1"></span></div>`;
    form.insertAdjacentElement("beforebegin", block);

    const googleBox = document.getElementById("aeRiderPortalGoogle");
    if (googleBox) {
      void renderGoogleButton(googleBox, async (response) => {
        try {
          const credential = String(response?.credential || "");
          if (!credential) throw new Error("Google did not return a sign-in credential");
          const data = await mutate("identity.riderGoogleLogin", { credential });
          await completeRiderPortalLogin(data);
        } catch (error) {
          riderPortalError(form, error instanceof Error ? error.message : "Google sign-in failed");
        }
      });
    }

    const originalPortalLogin = typeof window.portalLogin === "function" ? window.portalLogin : null;
    window.portalLogin = async function portalLogin(event, role) {
      if (role !== "rider") {
        if (originalPortalLogin) return originalPortalLogin(event, role);
        return undefined;
      }
      event.preventDefault();
      const current = event.currentTarget;
      const data = new FormData(current);
      const identifier = String(data.get("username") || "").trim();
      const password = String(data.get("password") || "");
      const button = current.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const result = identifier.includes("@")
          ? await mutate("identity.riderEmailLogin", { email: identifier, password })
          : await mutate("portal.login", { role: "rider", username: identifier, password });
        await completeRiderPortalLogin(result);
        current.querySelector(".portal-login-error")?.classList.add("hidden");
      } catch (error) {
        riderPortalError(current, error instanceof Error ? error.message : "Sign-in failed");
      } finally {
        if (button) button.disabled = false;
      }
      return undefined;
    };
  }

  function initIdentity() {
    initCustomer();
    initRiderApplication();
    initRiderPortal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIdentity, { once: true });
  } else {
    initIdentity();
  }
})();
