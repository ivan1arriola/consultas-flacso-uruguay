/* =============================================================
 * Balanceador de envíos entre múltiples cuentas (Gmail API)
 * - Usa service account (delegación de dominio) para enviar como cada cuenta
 * - Respeta límite diario configurado por cuenta
 * - Persiste conteo diario en PropertiesService
 * ============================================================= */
class BalancedMailer {
  constructor() {
    this.accounts = this.normalizeAccounts(SENDER_ACCOUNTS || [], SENDER_POOL_DAILY_LIMIT);
    this.scope = GMAIL_SA_SCOPE;
    this.saKey = null;
    this.tokenCache = {};
    this.blocked = this.loadBlockedAccounts();
    this.lastBlockedLog = {};
  }
  normalizeAccounts(accounts, poolLimit) {
    const normalized = (accounts || [])
      .map((acc) => (typeof acc === "string" ? { email: acc } : (acc || {})))
      .map((acc) => ({ ...acc, email: String(acc.email || "").trim().toLowerCase() }))
      .filter((acc) => acc.email);
    if (!normalized.length) return [];
    const defaultPerAccount = Number(SENDER_BASE_DAILY_LIMIT) > 0 ? Number(SENDER_BASE_DAILY_LIMIT) : 1400;
    const parsedPool = Number(poolLimit);
    const fallbackPool = defaultPerAccount * normalized.length;
    const totalPool = Number.isFinite(parsedPool) && parsedPool > 0
      ? Math.floor(parsedPool)
      : Math.floor(fallbackPool);
    const base = Math.floor(totalPool / normalized.length);
    const remainder = totalPool % normalized.length;
    return normalized.map((acc, index) => {
      const explicitLimit = Number(acc.dailyLimit);
      if (Number.isFinite(explicitLimit) && explicitLimit > 0) {
        return { ...acc, dailyLimit: Math.floor(explicitLimit) };
      }
      return { ...acc, dailyLimit: base + (index < remainder ? 1 : 0) };
    });
  }
  send(params) {
    const { to, subject, plainBody, htmlBody, replyTo, fromName, cc } = params; // Agregar cc aquí
    if (!this.accounts.length) throw new Error("No hay cuentas configuradas en SENDER_ACCOUNTS");
    const usage = this.loadUsage();
    const tried = new Set();
    while (tried.size < this.accounts.length) {
      const { account, allBlocked, noCapacity } = this.pickAccount(usage, tried);
      if (allBlocked) {
        throw new Error("NO_SENDER_CAPACITY_ALL_BLOCKED");
      }
      if (noCapacity) {
        throw new Error("NO_SENDER_CAPACITY_DAILY_LIMIT");
      }
      if (!account) break;
      tried.add(account.email);
      try {
        this.sendWithAccount(account, { to, subject, plainBody, htmlBody, replyTo, fromName, cc }); // Pasar cc aquí
        this.incrementUsage(usage, account.email);
        this.saveUsage(usage);
        const usedToday = usage[account.email];
        if (this.shouldLogUsage(usedToday)) {
          Logger.log(
            `Correo enviado a ${to} usando ${account.email}. ` +
            `Usados hoy: ${usedToday}/${account.dailyLimit}`
          );
        }
        return account.email;
      } catch (err) {
        if (this.isInvalidRecipientError(err)) {
          const invalid = new Error(`INVALID_RECIPIENT_ADDRESS: ${to}`);
          invalid.code = "INVALID_RECIPIENT_ADDRESS";
          throw invalid;
        }
        Logger.log(`Fallo al enviar con ${account.email}: ${err}`);
        TelegramNotifier.getInstance().notifyError(err, {
          handler: 'BalancedMailer.sendWithAccount',
          account: account.email,
          to
        });
        // Intentar siguiente cuenta disponible
      }
    }
    throw new Error("ALL_SENDER_ACCOUNTS_FAILED");
  }
  pickAccount(usage, tried) {
    const now = Date.now();
    const enriched = this.accounts
      .map((acc) => {
        const used = usage[acc.email] || 0;
        return { ...acc, used, remaining: Math.max(0, acc.dailyLimit - used) };
      })
      .filter((acc) => acc.remaining > 0);
    const unblocked = enriched.filter((acc) => {
      const blocked = this.isBlocked(acc.email, now);
      if (blocked && !tried.has(acc.email)) {
        const lastLog = this.lastBlockedLog[acc.email] || 0;
        if (now - lastLog > 60000) { // logea como máximo 1 vez por minuto por cuenta
          Logger.log(
            `Cuenta bloqueada por rate limit: ${acc.email} hasta ${this.formatTimestamp(this.blocked[acc.email])}`
          );
          this.lastBlockedLog[acc.email] = now;
        }
      }
      return !blocked;
    });
    const candidates = unblocked.filter((acc) => !tried.has(acc.email));
    const allBlocked = unblocked.length === 0 && enriched.length > 0;
    const noCapacity = enriched.length === 0;
    if (!candidates.length && allBlocked) {
      return { account: null, allBlocked: true, noCapacity: false };
    }
    if (!candidates.length && noCapacity) {
      return { account: null, allBlocked: false, noCapacity: true };
    }
    if (!candidates.length) return { account: null, allBlocked: false, noCapacity: false };
    // Elegir la que tenga mayor cupo disponible; si empata, mayor capacidad total; luego la menos usada
    candidates.sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      if (b.dailyLimit !== a.dailyLimit) return b.dailyLimit - a.dailyLimit;
      return a.used - b.used;
    });
    return { account: candidates[0], allBlocked: false, noCapacity: false };
  }
  sendWithAccount(account, mail) {
    const token = this.getAccessToken(account.email);
    const raw = this.buildRawMessage(account.email, mail);
    const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(account.email)}/messages/send`;
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${token}` },
      payload: JSON.stringify({ raw }),
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) return true;
    const body = response.getContentText();
    const parsedError = this.parseGmailError(body);
    if (code === 429) {
      const retryAt = this.extractRetryAfter(body);
      if (retryAt) {
        this.blockAccount(account.email, retryAt);
        Logger.log(
          `Rate limit para ${account.email}, bloqueada hasta ${this.formatTimestamp(retryAt)} (código 429)`
        );
      }
    }
    const err = new Error(`Gmail API (${account.email}) respondió ${code}: ${body}`);
    err.gmailStatusCode = code;
    err.gmailReason = parsedError.reason;
    err.gmailMessage = parsedError.message;
    if (this.isInvalidToHeaderError(code, parsedError)) {
      err.code = "INVALID_RECIPIENT_ADDRESS";
    }
    TelegramNotifier.getInstance().notifyError(err, {
      handler: 'BalancedMailer.sendWithAccount',
      account: account.email,
      status: code
    });
    throw err;
  }
  sendWithReservedAccount(reservedEmail, mail) {
    const email = String(reservedEmail || "").trim().toLowerCase();
    if (!email) {
      throw new Error("RESERVED_SENDER_MISSING");
    }
    Logger.log(`Intentando envio con cuenta reservada: ${email}`);
    this.sendWithAccount({ email }, mail);
    return email;
  }
  buildRawMessage(fromEmail, { to, subject, plainBody, htmlBody, replyTo, fromName, cc }) { // Agregar cc en parámetros
    const boundary = "mixed_" + new Date().getTime();
    const subjectEncoded = this.encodeSubject(subject);
    const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const reply = replyTo || fromEmail;
    const mimeParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
    ];
    // Agregar CC si está definido y no está vacío
    if (cc && cc.trim()) {
      mimeParts.push(`Cc: ${cc.trim()}`);
    }
    mimeParts.push(
      `Reply-To: ${reply}`,
      `Subject: ${subjectEncoded}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Utilities.base64Encode(Utilities.newBlob(plainBody || "").getBytes()),
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Utilities.base64Encode(Utilities.newBlob(htmlBody || "").getBytes()),
      `--${boundary}--`,
      ``
    );
    const mimeString = mimeParts.join("\r\n");
    return Utilities.base64EncodeWebSafe(Utilities.newBlob(mimeString).getBytes());
  }
  encodeSubject(subject) {
    const encoded = Utilities.base64Encode(Utilities.newBlob(subject || "").getBytes());
    return `=?utf-8?B?${encoded}?=`;
  }
  loadUsage() {
    const key = this.usageKey();
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    return raw ? JSON.parse(raw) : {};
  }
  saveUsage(usage) {
    const key = this.usageKey();
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(usage));
  }
  incrementUsage(usage, email) {
    usage[email] = (usage[email] || 0) + 1;
  }
  loadBlockedAccounts() {
    const raw = PropertiesService.getScriptProperties().getProperty("BALANCED_MAIL_BLOCKED");
    return raw ? JSON.parse(raw) : {};
  }
  saveBlockedAccounts() {
    PropertiesService.getScriptProperties().setProperty("BALANCED_MAIL_BLOCKED", JSON.stringify(this.blocked));
  }
  blockAccount(email, retryAtMs) {
    this.blocked[email] = retryAtMs;
    this.saveBlockedAccounts();
  }
  isBlocked(email, now) {
    const until = this.blocked[email];
    if (!until) return false;
    if (now > until) {
      delete this.blocked[email];
      this.saveBlockedAccounts();
      Logger.log(`Cuenta desbloqueada automáticamente: ${email}`);
      return false;
    }
    return true;
  }
  usageKey() {
    const today = new Date();
    const y = today.getFullYear();
    const m = (today.getMonth() + 1).toString().padStart(2, "0");
    const d = today.getDate().toString().padStart(2, "0");
    return `BALANCED_MAIL_USAGE_${y}-${m}-${d}`;
  }
  getAccessToken(userEmail) {
    const cached = this.tokenCache[userEmail];
    if (cached && cached.token && Date.now() < cached.expiresAt) {
      return cached.token;
    }
    if (!this.saKey) this.saKey = this.loadServiceAccountKey();
    const jwt = this.createJwt(this.saKey, userEmail);
    const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      },
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    const data = JSON.parse(response.getContentText() || "{}");
    if (code >= 200 && code < 300 && data.access_token) {
      const expiresIn = Number(data.expires_in) || 3600;
      const safetyMs = 60000;
      const expiresAt = Date.now() + Math.max(0, expiresIn * 1000 - safetyMs);
      this.tokenCache[userEmail] = { token: data.access_token, expiresAt };
      return data.access_token;
    }
    throw new Error(`No se pudo obtener token para ${userEmail}: ${code} ${response.getContentText()}`);
  }
  createJwt(saKey, userEmail) {
    const header = this.base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payloadObj = {
      iss: saKey.client_email,
      scope: this.scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
      sub: userEmail,
    };
    const payload = this.base64Url(JSON.stringify(payloadObj));
    const toSign = `${header}.${payload}`;
    const signatureBytes = Utilities.computeRsaSha256Signature(toSign, saKey.private_key);
    const signature = this.base64Url(signatureBytes);
    return `${toSign}.${signature}`;
  }
  base64Url(input) {
    if (typeof input === "string") {
      return Utilities.base64EncodeWebSafe(Utilities.newBlob(input).getBytes());
    }
    return Utilities.base64EncodeWebSafe(input);
  }
  extractRetryAfter(body) {
    try {
      const parsed = JSON.parse(body);
      const msg = parsed?.error?.message || "";
      const match = msg.match(/Retry after ([0-9:T\-\.\+Z]+)/i);
      if (match && match[1]) {
        const ts = Date.parse(match[1]);
        if (!isNaN(ts)) return ts;
      }
    } catch (e) {
      // cuerpo no JSON, ignorar
    }
    return null;
  }
  parseGmailError(body) {
    try {
      const parsed = JSON.parse(body || "{}");
      const reason = parsed?.error?.errors?.[0]?.reason || "";
      const message = parsed?.error?.message || "";
      return { reason, message };
    } catch (e) {
      return { reason: "", message: String(body || "") };
    }
  }
  isInvalidToHeaderError(code, parsedError = {}) {
    if (Number(code) !== 400) return false;
    const reason = String(parsedError.reason || "").toLowerCase();
    const message = String(parsedError.message || "").toLowerCase();
    return reason === "invalidargument" && message.includes("invalid to header");
  }
  isInvalidRecipientError(error) {
    if (error && error.code === "INVALID_RECIPIENT_ADDRESS") return true;
    const msg = error && error.toString ? error.toString() : String(error || "");
    return msg.includes("INVALID_RECIPIENT_ADDRESS") || msg.toLowerCase().includes("invalid to header");
  }
  shouldLogUsage(usedToday) {
    const cfg = typeof MAILER_LOG_CONFIG === "object" && MAILER_LOG_CONFIG ? MAILER_LOG_CONFIG : {};
    const first = Number(cfg.SUCCESS_FIRST_SENDS);
    const every = Number(cfg.SUCCESS_EVERY);
    const firstValid = Number.isFinite(first) && first >= 0 ? Math.floor(first) : 3;
    const everyValid = Number.isFinite(every) && every > 0 ? Math.floor(every) : 25;
    const used = Number(usedToday);
    if (!Number.isFinite(used) || used <= 0) return false;
    if (used <= firstValid) return true;
    return everyValid > 0 && used % everyValid === 0;
  }
  formatTimestamp(ts) {
    if (!ts) return "";
    return new Date(ts).toISOString();
  }
  loadServiceAccountKey() {
    const file = DriveApp.getFileById(SA_KEY_FILE_ID);
    const json = file.getBlob().getDataAsString();
    return JSON.parse(json);
  }
}
