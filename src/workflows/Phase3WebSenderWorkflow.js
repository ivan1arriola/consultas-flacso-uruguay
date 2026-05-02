/* =============================================================
 *  Gestor de envios Fase 3 - Web
 *  - Reutiliza la logica de Fase 2 para lectura, filtros y marcado
 *  - Primera tanda masiva: entre FECHA_INICIO_MASIVO y FECHA_FIN_MASIVO
 *  - Tandas posteriores: manuales con exactDays
 * ============================================================= */
class Fase3WebSender extends Fase2WebSender {
  constructor() {
    super();
    this.sheetId = FASE3_WEB_CONFIG.SPREADSHEET_ID;
    this.sheetName = FASE3_WEB_CONFIG.SHEET_NAME;
    this.massStartDate = this.parseStartDate(FASE3_WEB_CONFIG.FECHA_INICIO_MASIVO);
    this.massFixedEndDate = this.parseStartDate(FASE3_WEB_CONFIG.FECHA_FIN_MASIVO);
  }

  getPhaseLabel() {
    return "Fase 3";
  }

  getMassEndDate() {
    return this.massFixedEndDate;
  }

  mapColumnsWeb(headers) {
    const map = super.mapColumnsWeb(headers);
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
      ...map,
      fase2: findCol(["Fase 2"], false),
      enviado: findCol(["Fase 3"]),
    };
  }

  loadListado(options = {}) {
    if (!options.onlyFromFase2LastMonth) {
      return super.loadListado(options);
    }
    const lookbackDays = this.parseLookbackDays_(options.lookbackDays);
    const sheet = SpreadsheetApp.openById(this.sheetId).getSheetByName(this.sheetName);
    if (!sheet) throw new Error(`No se encontro la hoja "${this.sheetName}"`);
    const values = sheet.getDataRange().getValues();
    if (!values.length) return { sheet, map: null, items: [], totalValid: 0, yaEnviados: 0 };

    const headers = values[0];
    const map = this.mapColumnsWeb(headers);
    if (map.fase2 === -1 || map.fase2 === undefined) {
      throw new Error('No se encontro la columna "Fase 2"');
    }

    const registeredContacts = this.spreadsheetManager.getRegisteredContactsByEmailAndPostId();
    let yaEnviados = 0;
    let totalValid = 0;
    let skippedByMinDate = 0;
    let skippedByWindow = 0;
    let skippedMissingCore = 0;
    let skippedInvalidDate = 0;
    let skippedAlreadySent = 0;
    let skippedByFase2False = 0;
    let duplicateTuplesDetected = 0;
    let sentOldest = null;
    let sentNewest = null;
    let alreadySentOldest = null;
    let alreadySentNewest = null;
    const now = new Date();
    const lowerBound = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lookbackDays, 0, 0, 0, 0);
    const upperBound = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
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

        const fueEnviado =
          typeof row[map.enviado] === "boolean"
            ? row[map.enviado]
            : String(row[map.enviado] || "").toLowerCase() === "true";
        if (fueEnviado) {
          yaEnviados += 1;
          skippedAlreadySent += 1;
          const submittedAtSent = this.parseSubmittedAt(row[map.day], row[map.hour]);
          if (submittedAtSent) {
            if (!alreadySentOldest || submittedAtSent < alreadySentOldest) alreadySentOldest = submittedAtSent;
            if (!alreadySentNewest || submittedAtSent > alreadySentNewest) alreadySentNewest = submittedAtSent;
          }
          return null;
        }

        const tieneFase2 =
          typeof row[map.fase2] === "boolean"
            ? row[map.fase2]
            : String(row[map.fase2] || "").toLowerCase() === "true";
        if (!tieneFase2) {
          skippedByFase2False += 1;
          return null;
        }

        const submittedAt = this.parseSubmittedAt(row[map.day], row[map.hour]);
        if (!submittedAt) {
          skippedInvalidDate += 1;
          return null;
        }
        if (submittedAt < lowerBound || submittedAt > upperBound) {
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
        return this.buildItem(row, map, idx + 2, registeredContacts);
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
      skippedByFase2False,
      duplicateTuplesDetected,
      exactDays: null,
      massStartDate: this.formatDateForSummary(lowerBound),
      massEndDate: this.formatDateForSummary(upperBound),
      massEndOffsetDays: null,
      sentOldest: this.formatDateForSummary(sentOldest),
      sentNewest: this.formatDateForSummary(sentNewest),
      alreadySentOldest: this.formatDateForSummary(alreadySentOldest),
      alreadySentNewest: this.formatDateForSummary(alreadySentNewest),
      sheetUrl: `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${sheet.getSheetId()}`,
    };

    const flowLabel = this.getFlowLabel();
    Logger.log(
      `[${flowLabel}] Recupero Fase3 ultimo mes | filas=${Math.max(0, values.length - 1)} | elegibles=${items.length}` +
      ` | lookback_days=${lookbackDays}` +
      ` | sin_fase2=${skippedByFase2False} | fuera_ventana=${skippedByWindow}` +
      ` | ya_true=${yaEnviados} | tuplas_repetidas=${duplicateTuplesDetected}`
    );
    return { sheet, map, items, totalValid, yaEnviados };
  }

  parseLookbackDays_(value) {
    if (value === null || value === undefined || value === "") return 30;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("lookbackDays invalido. Usa un numero > 0");
    }
    return Math.floor(n);
  }

  getRunType(options = {}) {
    if (options.onlyFromFase2LastMonth) {
      return FASE3_SUMMARY_CONFIG.RUN_TYPES.WEB_RECUPERO_FASE2_ULTIMO_MES;
    }
    if (options.exactDays !== null && options.exactDays !== undefined) {
      return `${FASE3_SUMMARY_CONFIG.RUN_TYPES.WEB_TANDA_PREFIX}${options.exactDays}D`;
    }
    return FASE3_SUMMARY_CONFIG.RUN_TYPES.WEB_MASIVO;
  }

  getSummaryRecipients() {
    return FASE3_SUMMARY_CONFIG.RECIPIENTS;
  }

  sendWorkflowEmail(processingData) {
    return this.emailManager.sendPhase3Email(processingData);
  }

  buildWorkflowSubject(pageInfo) {
    return this.emailManager.buildPhase3Subject(pageInfo);
  }

  buildWorkflowHtml(processingData) {
    return this.emailManager.buildPhase3Email(processingData);
  }
}
