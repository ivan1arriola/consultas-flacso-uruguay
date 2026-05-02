/* =============================================================
 *  Gestor de envios Fase 2 - Web (historico)
 *  - Lee la hoja historica de consultas web
 *  - Masivo: desde fecha de inicio y hasta hoy menos N dias
 *  - Marca "Fase 2" en TRUE para evitar reenvios
 * ============================================================= */
class Fase2WebSender extends Fase2Sender {
  constructor() {
    super();
    this.sheetId = FASE2_WEB_CONFIG.SPREADSHEET_ID;
    this.sheetName = FASE2_WEB_CONFIG.SHEET_NAME;
    this.massStartDate = this.parseStartDate(FASE2_WEB_CONFIG.FECHA_INICIO_MASIVO);
    this.massEndOffsetDays = this.parseNonNegativeInt(
      FASE2_WEB_CONFIG.MASIVO_HASTA_HOY_MENOS_DIAS,
      "FASE2_WEB_CONFIG.MASIVO_HASTA_HOY_MENOS_DIAS"
    );
    this.lastFilterStats = null;
  }
  loadListado(options = {}) {
    const { exactDays = null } = options;
    const sheet = SpreadsheetApp.openById(this.sheetId).getSheetByName(this.sheetName);
    if (!sheet) throw new Error(`No se encontro la hoja "${this.sheetName}"`);
    const values = sheet.getDataRange().getValues();
    if (!values.length) return { sheet, map: null, items: [], totalValid: 0, yaEnviados: 0 };
    const headers = values[0];
    const map = this.mapColumnsWeb(headers);
    const registeredContacts = this.spreadsheetManager.getRegisteredContactsByEmailAndPostId();
    let yaEnviados = 0;
    let totalValid = 0;
    let skippedByMinDate = 0;
    let skippedByWindow = 0;
    let skippedMissingCore = 0;
    let skippedInvalidDate = 0;
    let skippedAlreadySent = 0;
    let duplicateTuplesDetected = 0;
    let sentOldest = null;
    let sentNewest = null;
    let alreadySentOldest = null;
    let alreadySentNewest = null;
    const massEndDate = this.getMassEndDate();
    const seenTuplesForSend = new Set();
    const items = values
      .slice(1)
      .map((row, idx) => {
        const email = this.normalizeEmail(row[map.email]);
        const postId = this.cleanCell(row[map.postId]);
        if (!email || !postId || !this.isValidEmail(email)) {
          skippedMissingCore += 1;
          return null;
        }
        const fase2Val = row[map.enviado];
        const fueEnviado =
          typeof fase2Val === "boolean"
            ? fase2Val
            : String(fase2Val || "").toLowerCase() === "true";
        if (fueEnviado) {
          yaEnviados += 1;
          skippedAlreadySent += 1;
          const submittedAt = this.parseSubmittedAt(row[map.day], row[map.hour]);
          if (submittedAt) {
            if (!alreadySentOldest || submittedAt < alreadySentOldest) alreadySentOldest = submittedAt;
            if (!alreadySentNewest || submittedAt > alreadySentNewest) alreadySentNewest = submittedAt;
          }
          return null;
        }
        const submittedAt = this.parseSubmittedAt(row[map.day], row[map.hour]);
        if (!submittedAt) {
          skippedInvalidDate += 1;
          return null;
        }
        if (submittedAt < this.massStartDate) {
          skippedByMinDate += 1;
          return null;
        }
        if (!this.matchesAgeRule(submittedAt, exactDays, massEndDate)) {
          skippedByWindow += 1;
          return null;
        }
        if (!sentOldest || submittedAt < sentOldest) sentOldest = submittedAt;
        if (!sentNewest || submittedAt > sentNewest) sentNewest = submittedAt;
        totalValid += 1;
        const tupleKey = this.buildTupleKey(email, postId);
        if (seenTuplesForSend.has(tupleKey)) {
          duplicateTuplesDetected += 1;
        } else {
          seenTuplesForSend.add(tupleKey);
        }
        const item = this.buildItem(row, map, idx + 2, registeredContacts);
        return item;
      })
      .filter(Boolean);
    this.lastFilterStats = {
      totalRows: Math.max(0, values.length - 1),
      elegibles: items.length,
      skippedMissingCore,
      skippedInvalidDate,
      skippedByMinDate,
      skippedByWindow,
      skippedAlreadySent,
      duplicateTuplesDetected,
      exactDays: exactDays === null || exactDays === undefined ? null : Number(exactDays),
      massStartDate: this.formatDateForSummary(this.massStartDate),
      massEndDate: this.formatDateForSummary(massEndDate),
      massEndOffsetDays: this.massEndOffsetDays,
      sentOldest: this.formatDateForSummary(sentOldest),
      sentNewest: this.formatDateForSummary(sentNewest),
      alreadySentOldest: this.formatDateForSummary(alreadySentOldest),
      alreadySentNewest: this.formatDateForSummary(alreadySentNewest),
      sheetUrl: `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${sheet.getSheetId()}`
    };
    const flowLabel = this.getFlowLabel();
    Logger.log(
      `[${flowLabel}] Filtros WEB | filas=${Math.max(0, values.length - 1)} | elegibles=${items.length}` +
      ` | inicio=${this.formatDateForSummary(this.massStartDate)} | fin=${this.formatDateForSummary(massEndDate)}` +
      ` | exact_days=${exactDays === null || exactDays === undefined ? 'no' : exactDays}` +
      ` | fuera_fecha=${skippedByMinDate} | fuera_ventana=${skippedByWindow}` +
      ` | ya_true=${yaEnviados} | tuplas_repetidas=${duplicateTuplesDetected}`
    );
    return { sheet, map, items, totalValid, yaEnviados };
  }

  getRunMetadata() {
    return this.lastFilterStats ? { webFilters: this.lastFilterStats } : {};
  }
  mapColumnsWeb(headers) {
    const normalizedHeaders = headers.map((h) => this.normalizeHeaderName(h));
    const findCol = (expectedList, required = true) => {
      const names = Array.isArray(expectedList) ? expectedList : [expectedList];
      const normalizedExpected = names.map((name) => this.normalizeHeaderName(name));
      const idx = normalizedHeaders.findIndex((header) => normalizedExpected.includes(header));
      if (idx === -1 && required) {
        throw new Error(`No se encontro ninguna de las columnas: ${names.join(" / ")}`);
      }
      return idx;
    };
    return {
      email: findCol(["Tu correo electronico", "Tu correo electrónico", "Correo", "Email"]),
      firstName: findCol(["Nombre"], false),
      lastName: findCol(["Apellido"], false),
      postId: findCol(["Post_ID", "Post ID", "PostId", "ID"]),
      day: findCol(["Dia", "Día", "Fecha"]),
      hour: findCol(["Hora"], false),
      enviado: findCol(["Fase 2"]),
      origen: -1,
    };
  }
  normalizeHeaderName(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  buildTupleKey(email, postId) {
    return `${this.normalizeEmail(email)}::${String(postId || "").trim()}`;
  }
  parseStartDate(rawDate) {
    const parsed = new Date(`${String(rawDate || "").trim()}T00:00:00`);
    if (isNaN(parsed.getTime())) {
      throw new Error("FASE2_WEB_CONFIG.FECHA_INICIO_MASIVO invalida. Usa formato YYYY-MM-DD");
    }
    return parsed;
  }
  parseSubmittedAt(dayValue, hourValue) {
    const datePart = this.parseDatePart(dayValue);
    if (!datePart) return null;
    const timePart = this.parseHourPart(hourValue);
    datePart.setHours(timePart.hour, timePart.minute, 0, 0);
    return datePart;
  }
  parseNonNegativeInt(rawValue, fieldName) {
    const n = Number(rawValue);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`${fieldName} invalida. Usa un numero >= 0`);
    }
    return Math.floor(n);
  }
  getMassEndDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - this.massEndOffsetDays, 0, 0, 0, 0);
  }

  matchesAgeRule(submittedAt, exactDays, massEndDate = null) {
    if (exactDays === null || exactDays === undefined) {
      const endDate = massEndDate || this.getMassEndDate();
      const utcEnd = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const utcSubmitted = Date.UTC(submittedAt.getFullYear(), submittedAt.getMonth(), submittedAt.getDate());
      return utcSubmitted <= utcEnd;
    }
    const target = Number(exactDays);
    if (!Number.isFinite(target) || target < 0) {
      throw new Error("exactDays invalido. Usa un numero >= 0");
    }
    const now = new Date();
    const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const utcSubmitted = Date.UTC(submittedAt.getFullYear(), submittedAt.getMonth(), submittedAt.getDate());
    const elapsedDays = Math.floor((utcToday - utcSubmitted) / (24 * 60 * 60 * 1000));
    return elapsedDays === Math.floor(target);
  }
  parseDatePart(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
    }
    const raw = this.cleanCell(value);
    if (!raw) return null;
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      const year = Number(slashMatch[3]);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    const slashShortYear = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (slashShortYear) {
      const day = Number(slashShortYear[1]);
      const month = Number(slashShortYear[2]);
      const yy = Number(slashShortYear[3]);
      const year = yy >= 70 ? 1900 + yy : 2000 + yy;
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    const longEsMatch = raw.match(/^(?:(?:lunes|martes|mi[eÃ©]rcoles|jueves|viernes|s[aÃ¡]bado|domingo),?\s*)?(\d{1,2})\s+de\s+([a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘]+)\s+de\s+(\d{4})$/i);
    if (longEsMatch) {
      const day = Number(longEsMatch[1]);
      const monthName = this.normalizeMonthName(longEsMatch[2]);
      const year = Number(longEsMatch[3]);
      const monthMap = {
        enero: 1,
        febrero: 2,
        marzo: 3,
        abril: 4,
        mayo: 5,
        junio: 6,
        julio: 7,
        agosto: 8,
        septiembre: 9,
        setiembre: 9,
        octubre: 10,
        noviembre: 11,
        diciembre: 12
      };
      const month = monthMap[monthName];
      if (month) {
        return new Date(year, month - 1, day, 0, 0, 0, 0);
      }
    }
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  normalizeMonthName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[Ã¡Ã Ã¤]/g, "a")
      .replace(/[Ã©Ã¨Ã«]/g, "e")
      .replace(/[Ã­Ã¬Ã¯]/g, "i")
      .replace(/[Ã³Ã²Ã¶]/g, "o")
      .replace(/[ÃºÃ¹Ã¼]/g, "u");
  }
  parseHourPart(value) {
    const raw = this.cleanCell(value);
    if (!raw) return { hour: 0, minute: 0 };
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return { hour: 0, minute: 0 };
    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour, minute };
  }

  formatDateForSummary(dateObj) {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "-";
    return Utilities.formatDate(dateObj, "America/Montevideo", "yyyy-MM-dd");
  }
}

