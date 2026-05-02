/* =============================================================
 *  Gestor de envíos Fase 2
 *  - Lee listado (correo + Post_ID + nombre/apellido opcionales)
 *  - Usa una plantilla propia de seguimiento para Fase 2
 * ============================================================= */
class Fase2Sender {
  constructor() {
    this.sheetId = SPREADSHEET_FASE2_ID;
    this.sheetName = SHEET_FASE2_LISTADO;
    this.emailManager = new EmailManager();
    this.spreadsheetManager = new SpreadsheetManager();
    this.discountInfo = this.buildDiscountInfo();
  }
  procesarListado(options = {}) {
    const { dryRun = false, limit = null } = options;
    const { sheet, map, items, totalValid, yaEnviados, invalidEmails } = this.loadListado(options);
    const subset = limit ? items.slice(0, limit) : items;
    const pageInfoCache = this.preloadPageInfo(subset);
    const logConfig = this.getLogConfig();
    const resultado = { total: subset.length, enviados: 0, errores: [], previews: [] };
    const enviados = [];
    const enviadosPorPrograma = {};
    const enviadosPorCuenta = {};
    const flowLabel = this.getFlowLabel();
    const runMetadata = typeof this.getRunMetadata === 'function' ? this.getRunMetadata(options) : {};
    Logger.log(
      `[${flowLabel}] Inicio | modo=${dryRun ? 'dry-run' : 'envio'} | candidatos=${items.length} | procesar=${subset.length}` +
      ` | ya_enviados=${yaEnviados} | total_validos=${totalValid} | emails_invalidos=${invalidEmails || 0}`
    );
    if (subset.length === 0) {
      const web = runMetadata && runMetadata.webFilters ? runMetadata.webFilters : null;
      if (web) {
        Logger.log(
          `[${flowLabel}] Sin candidatos para enviar | razones:` +
          ` fuera_fecha=${web.skippedByMinDate}, fuera_ventana=${web.skippedByWindow},` +
          ` ya_true=${web.skippedAlreadySent}, faltantes=${web.skippedMissingCore}, fecha_invalida=${web.skippedInvalidDate}`
        );
      } else {
        Logger.log(`[${flowLabel}] Sin candidatos para enviar en esta ejecución.`);
      }
    }
    subset.forEach((item, idx) => {
      try {
        const posicion = idx + 1;
        const processingData = this.createProcessingData(item, pageInfoCache);
        const programLabel = this.getProgramLabel(item, pageInfoCache, processingData.pageInfo);
        if (this.shouldLogItemDetail(posicion, subset.length, logConfig)) {
          Logger.log(
            `[${flowLabel}] ${dryRun ? 'Preview' : 'Enviar'} ${posicion}/${subset.length}` +
            ` | fila=${item.rowNumber || '-'} | email=${item.email}` +
            ` | postId=${item.postId} | programa=${programLabel}`
          );
        }
        if (dryRun) {
          const preview = this.buildPreview(processingData);
          resultado.previews.push(preview);
        } else {
          const cuenta = this.sendWorkflowEmail(processingData);
          resultado.enviados += 1;
          const cuentaKey = cuenta || 'desconocida';
          enviadosPorCuenta[cuentaKey] = (enviadosPorCuenta[cuentaKey] || 0) + 1;
          enviados.push(item.email);
          const programa = processingData.pageInfo && processingData.pageInfo.posgrado
            ? String(processingData.pageInfo.posgrado)
            : `Post_ID ${item.postId || ''}`.trim();
          if (programa) {
            enviadosPorPrograma[programa] = (enviadosPorPrograma[programa] || 0) + 1;
          }
          this.marcarEnviado(sheet, map, item.rowNumber, item);
          if (this.shouldLogProgress(posicion, subset.length, logConfig)) {
            Logger.log(
              `[${flowLabel}] Progreso | enviados=${resultado.enviados}/${subset.length}` +
              ` | errores=${resultado.errores.length} | cuenta=${cuentaKey}` +
              ` | ultimo_postId=${item.postId} | ultimo_programa=${programLabel}`
            );
          }
        }
      } catch (error) {
        const fila = item.rowNumber || idx + 2; // Fila real en la hoja
        const msg = error && error.toString ? error.toString() : String(error);
        const programLabel = this.getProgramLabel(item, pageInfoCache);
        // Si no hay capacidad de envio o fallaron todas las cuentas, detener el proceso
        if (this.isSenderStopErrorMessage(msg)) {
          Logger.log(`[${flowLabel}] Proceso detenido por capacidad/cuentas de envio: ${msg}`);
          throw error;
        }
        resultado.errores.push({
          fila,
          correo: item.email,
          postId: item.postId,
          programa: programLabel,
          mensaje: msg,
        });
        TelegramNotifier.getInstance().notifyError(error, {
          handler: 'Fase2Sender.procesarListado',
          fila,
          correo: item.email,
          postId: item.postId
        });
        Logger.log(
          `[${flowLabel}] Error | fila=${fila} | email=${item.email}` +
          ` | postId=${item.postId} | programa=${programLabel} | detalle=${msg}`
        );
      }
    });
    const procesados = dryRun ? resultado.previews.length : resultado.enviados;
    Logger.log(
      `[${flowLabel}] Fin | modo=${dryRun ? 'dry-run' : 'envio'} | procesados=${procesados}/${resultado.total}` +
      ` | errores=${resultado.errores.length}`
    );
    if (!dryRun) {
      this.enviarResumenFinal(enviados, enviadosPorPrograma, enviadosPorCuenta, resultado, options, runMetadata);
    }
    return resultado;
  }
  loadListado() {
    const sheet = SpreadsheetApp.openById(this.sheetId).getSheetByName(this.sheetName);
    if (!sheet) throw new Error(`No se encontró la hoja "${this.sheetName}"`);
    const values = sheet.getDataRange().getValues();
    if (!values.length) return { sheet, map: null, items: [], totalValid: 0, yaEnviados: 0, invalidEmails: 0 };
    const headers = values[0];
    const map = this.mapColumns(headers);
    const registeredContacts = this.spreadsheetManager.getRegisteredContactsByEmailAndPostId();
    let yaEnviados = 0;
    let totalValid = 0;
    let invalidEmails = 0;
    const items = values
      .slice(1)
      .map((row, idx) => {
        const email = this.normalizeEmail(row[map.email]);
        const postId = this.cleanCell(row[map.postId]);
        if (!email || !postId) return null;
        if (!this.isValidEmail(email)) {
          invalidEmails += 1;
          return null;
        }
        totalValid += 1;
        const fueEnviado =
          map.enviado !== -1 &&
          (typeof row[map.enviado] === "boolean"
            ? row[map.enviado]
            : String(row[map.enviado]).toLowerCase() === "true");
        if (fueEnviado) {
          yaEnviados += 1;
          return null;
        }
        return this.buildItem(row, map, idx + 2, registeredContacts);
      })
      .filter(Boolean);
    return { sheet, map, items, totalValid, yaEnviados, invalidEmails };
  }
  getFlowLabel() {
    return this.constructor && this.constructor.name ? this.constructor.name : 'Fase2';
  }
  getPhaseLabel() {
    return 'Fase 2';
  }
  getLogConfig() {
    const cfg = typeof FASE2_LOG_CONFIG === 'object' && FASE2_LOG_CONFIG ? FASE2_LOG_CONFIG : {};
    const detailFirstItems = Number(cfg.DETAIL_FIRST_ITEMS);
    const progressEvery = Number(cfg.PROGRESS_EVERY);
    return {
      detailFirstItems: Number.isFinite(detailFirstItems) && detailFirstItems >= 0 ? Math.floor(detailFirstItems) : 10,
      progressEvery: Number.isFinite(progressEvery) && progressEvery > 0 ? Math.floor(progressEvery) : 25,
    };
  }
  shouldLogItemDetail(position, total, config) {
    if (position === total) return true;
    if (position <= config.detailFirstItems) return true;
    return this.shouldLogProgress(position, total, config);
  }
  shouldLogProgress(position, total, config) {
    if (position === total) return true;
    return config.progressEvery > 0 && position % config.progressEvery === 0;
  }
  getProgramLabel(item, pageInfoCache = null, pageInfo = null) {
    const directProgram = pageInfo && pageInfo.posgrado ? String(pageInfo.posgrado).trim() : '';
    if (directProgram) return directProgram;
    const cached = pageInfoCache && item ? pageInfoCache[item.postId] : null;
    const cachedProgram = cached && cached.pageInfo && cached.pageInfo.posgrado
      ? String(cached.pageInfo.posgrado).trim()
      : '';
    if (cachedProgram) return cachedProgram;
    const postId = item && item.postId ? String(item.postId).trim() : '';
    return postId ? `Post_ID ${postId}` : 'programa_no_disponible';
  }
  getRunType(options = {}) {
    const isWeb = this.getFlowLabel() === 'Fase2WebSender';
    if (isWeb && options.exactDays !== null && options.exactDays !== undefined) {
      return `${FASE2_SUMMARY_CONFIG.RUN_TYPES.WEB_DIARIO_PREFIX}${options.exactDays}D`;
    }
    if (isWeb) return FASE2_SUMMARY_CONFIG.RUN_TYPES.WEB_MASIVO;
    return FASE2_SUMMARY_CONFIG.RUN_TYPES.REDES_GENERAL;
  }
  getSummaryRecipients() {
    return FASE2_SUMMARY_CONFIG.RECIPIENTS;
  }
  preloadPageInfo(items) {
    const uniqueIds = Array.from(new Set(items.map((i) => i.postId).filter(Boolean)));
    const cache = {};
    uniqueIds.forEach((id) => {
      const pageInfo = this.spreadsheetManager.getPageInfo(id);
      if (pageInfo) {
        const links = this.buildProgramLinks(pageInfo);
        if (!pageInfo.enlaceWordpress && links.base) {
          pageInfo.enlaceWordpress = links.base;
        }
        cache[id] = { pageInfo, links };
      }
    });
    return cache;
  }
  mapColumns(headers) {
    const findCol = (expected) => {
      const idx = headers.findIndex((h) => String(h).trim() === expected);
      if (idx === -1) throw new Error(`No se encontró la columna "${expected}"`);
      return idx;
    };
    const findOptionalCol = (expected) =>
      headers.findIndex((h) => String(h).trim() === expected);
    return {
      email: findCol(FASE2_COLUMNS.EMAIL),
      postId: findCol(FASE2_COLUMNS.POST_ID),
      firstName: findOptionalCol(FASE2_COLUMNS.FIRST_NAME),
      lastName: findOptionalCol(FASE2_COLUMNS.LAST_NAME),
      origen: findOptionalCol(FASE2_COLUMNS.ORIGEN),
      enviado: findOptionalCol(FASE2_COLUMNS.ENVIADO),
    };
  }
  buildItem(row, map, rowNumber, registeredContacts = {}) {
    const email = this.normalizeEmail(row[map.email]);
    const postId = this.cleanCell(row[map.postId]);
    if (!email || !postId || !this.isValidEmail(email)) return null;
    // Si ya está marcado como enviado, no lo procesamos nuevamente
    if (map.enviado !== -1) {
      const enviadoVal = row[map.enviado];
      if (typeof enviadoVal === "boolean" ? enviadoVal : String(enviadoVal).toLowerCase() === "true") return null;
    }
    const fallback = this.getRegisteredContactFallback(email, postId, registeredContacts);
    const firstName = (map.firstName !== -1 ? this.cleanCell(row[map.firstName]) : '') || fallback.firstName || '';
    const lastName = (map.lastName !== -1 ? this.cleanCell(row[map.lastName]) : '') || fallback.lastName || '';
    return {
      email,
      postId,
      firstName,
      lastName,
      origen: map.origen !== -1 ? this.cleanCell(row[map.origen]) : "",
      rowNumber,
    };
  }
  getRegisteredContactFallback(email, postId, registeredContacts) {
    const key = `${this.normalizeEmail(email)}::${String(postId || '').trim()}`;
    return registeredContacts[key] || {};
  }
  cleanCell(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }
  normalizeEmail(value) {
    let email = this.cleanCell(value).toLowerCase();
    if (!email) return '';
    email = email.replace(/^mailto:/i, '');
    email = email.replace(/\s+/g, '');
    email = email.replace(/^[\"'`<>\(\)\[\]\{\},;:]+/, '');
    email = email.replace(/[\"'`<>\(\)\[\]\{\},;:]+$/, '');
    email = email.replace(/[.!?,;:]+$/, '');
    return email;
  }
  isValidEmail(email) {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return false;
    const domain = normalized.split("@")[1] || "";
    const tld = domain.includes(".") ? domain.substring(domain.lastIndexOf(".") + 1) : "";
    return tld.length >= 2;
  }
  isSenderStopErrorMessage(msg) {
    const text = String(msg || "");
    return (
      text.includes("NO_SENDER_CAPACITY_") ||
      text.includes("ALL_SENDER_ACCOUNTS_FAILED") ||
      text.includes("ALL_ACCOUNTS_BLOCKED")
    );
  }
  createProcessingData(item, pageInfoCache) {
    const cached = pageInfoCache && pageInfoCache[item.postId];
    const pageInfo = cached ? cached.pageInfo : this.spreadsheetManager.getPageInfo(item.postId);
    if (!pageInfo) throw new Error(`No se encontró información del posgrado para Post_ID ${item.postId}`);
    const links = cached ? cached.links : this.buildProgramLinks(pageInfo);
    if (!pageInfo.enlaceWordpress && links.base) {
      pageInfo.enlaceWordpress = links.base;
    }
    const formData = {
      postId: item.postId,
      postTitle: pageInfo.posgrado,
      first_name: item.firstName || '',
      last_name: item.lastName || '',
      name: this.buildFullName(item.firstName, item.lastName),
      email: item.email,
      url_base: links.base,
    };
    return {
      formData,
      pageInfo,
      getProgramLinks: () => links,
    };
  }
  buildProgramLinks(pageInfo) {
    const sanitize = (url) => (url ? String(url).trim() : null);
    const stripSlug = (url, slug) => {
      const clean = sanitize(url);
      if (!clean) return null;
      const regex = new RegExp(`/${slug}\\/?$`, 'i');
      return regex.test(clean) ? clean.replace(regex, '') : null;
    };
    const carta = sanitize(pageInfo.enlaceCarta);
    const pre = sanitize(pageInfo.enlacePreinscripcion);
    const base = stripSlug(carta, 'carta') || stripSlug(pre, 'preinscripcion') || sanitize(pageInfo.enlaceWordpress);
    return {
      base,
      carta,
      preinscripcion: pre,
    };
  }
  buildFullName(first, last) {
    const parts = [];
    if (first) parts.push(first);
    if (last) parts.push(last);
    return parts.join(' ').trim();
  }
  buildDiscountInfo() {
    const fechaLimite = new Date(FASE2_DESCUENTO.FECHA_LIMITE);
    const hoy = new Date();
    const unDia = 24 * 60 * 60 * 1000;
    const diasRestantes = Math.ceil((fechaLimite - hoy) / unDia);
    const fechaTexto =
      FASE2_DESCUENTO.FECHA_LIMITE_TEXTO ||
      fechaLimite.toLocaleDateString('es-UY', { day: 'numeric', month: 'long' });
    if (isNaN(fechaLimite.getTime())) return null;
    if (diasRestantes < 0) return null;
    return {
      porcentaje: FASE2_DESCUENTO.PORCENTAJE_MAXIMO,
      fechaLimiteTexto: fechaTexto,
      diasRestantes,
    };
  }
  marcarEnviado(sheet, map, rowNumber, item) {
    if (map.enviado === -1) return;
    sheet.getRange(rowNumber, map.enviado + 1).setValue(true);
  }
  buildPreview(processingData) {
    const subject = this.buildWorkflowSubject(processingData.pageInfo);
    const htmlBody = this.buildWorkflowHtml(processingData);
    return {
      correo: processingData.formData.email,
      postId: processingData.formData.postId,
      subject,
      htmlBody,
    };
  }
  sendWorkflowEmail(processingData) {
    return this.emailManager.sendPhase2Email(processingData, this.discountInfo);
  }
  buildWorkflowSubject(pageInfo) {
    return this.emailManager.buildPhase2Subject(pageInfo, this.discountInfo);
  }
  buildWorkflowHtml(processingData) {
    return this.emailManager.buildPhase2Email(processingData, this.discountInfo);
  }
  enviarResumenFinal(enviados, enviadosPorPrograma, enviadosPorCuenta, resultado, options = {}, metadata = {}) {
    const phaseLabel = this.getPhaseLabel();
    const destinatarios = this.getSummaryRecipients();
    const runType = this.getRunType(options);
    const timestamp = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
    const subject = `${phaseLabel}: resumen del envio (${resultado.enviados} enviados, ${resultado.errores.length} con error)`;
    const lista = enviados.length
      ? enviados.map((email) => `- ${email}`).join("\n")
      : "- (sin envíos)";
    const porPrograma = Object.keys(enviadosPorPrograma)
      .sort()
      .map((programa) => `- ${programa}: ${enviadosPorPrograma[programa]}`)
      .join("\n") || "- (sin datos)";
    const porCuenta = Object.keys(enviadosPorCuenta)
      .sort()
      .map((cuenta) => `- ${cuenta}: ${enviadosPorCuenta[cuenta]}`)
      .join("\n") || "- (sin datos)";
    const webFilters = metadata.webFilters || null;
    const webFilterBlock = webFilters
      ? [
          "",
          "Resumen WEB:",
          `- Hoja usada: ${webFilters.sheetUrl || `${this.sheetName} (${this.sheetId})`}`,
          `- Periodo evaluado: ${webFilters.massStartDate} -> ${webFilters.massEndDate || '-'}`,
          `- Tuplas repetidas detectadas (sin deduplicar): ${webFilters.duplicateTuplesDetected || 0}`,
          `- Ya enviados (${phaseLabel} = TRUE): ${webFilters.skippedAlreadySent}`,
          `- Periodo elegible para envio: ${webFilters.sentOldest} -> ${webFilters.sentNewest}`,
          `- Periodo de los ya enviados: ${webFilters.alreadySentOldest} -> ${webFilters.alreadySentNewest}`,
          "",
          "Detalle de filtros WEB:",
          `- Total filas (sin encabezado): ${webFilters.totalRows}`,
          `- Elegibles para procesar: ${webFilters.elegibles}`,
          `- Saltadas por email/postId faltante: ${webFilters.skippedMissingCore}`,
          `- Saltadas por fecha invalida: ${webFilters.skippedInvalidDate}`,
          `- Saltadas por inicio masivo (${webFilters.massStartDate}): ${webFilters.skippedByMinDate}`,
          `- Saltadas por ventana de dias: ${webFilters.skippedByWindow}`,
          `- Saltadas por ${phaseLabel} ya TRUE: ${webFilters.skippedAlreadySent}`,
        ]
      : [];

    const noEnviosExplicacion =
      webFilters && resultado.enviados === 0
        ? [
            "",
            "Sin envíos en esta ejecución.",
            `- Periodo evaluado: ${webFilters.massStartDate} -> ${webFilters.massEndDate || '-'}`,
            "Motivos principales:",
            `- Ya enviados (${phaseLabel} = TRUE): ${webFilters.skippedAlreadySent}`,
            `- Fuera de período por fecha: ${webFilters.skippedByMinDate}`,
            `- Fuera de ventana diaria/masiva: ${webFilters.skippedByWindow}`,
            `- Faltantes (email/postId): ${webFilters.skippedMissingCore}`,
            `- Fecha inválida: ${webFilters.skippedInvalidDate}`,
          ]
        : [];

    let body = [
      `Resumen de ejecución ${phaseLabel}`,
      "",
      "Contexto:",
      `- Tipo: ${runType}`,
      `- Flujo: ${this.getFlowLabel()}`,
      `- Fecha y hora: ${timestamp}`,
      `- Hoja origen: ${this.sheetName}`,
      `- Spreadsheet ID: ${this.sheetId}`,
      webFilters ? `- Periodo evaluado: ${webFilters.massStartDate} -> ${webFilters.massEndDate || '-'}` : null,
      `- Límite aplicado: ${options.limit ? options.limit : 'sin límite'}`,
      `- Criterio exactDays: ${options.exactDays !== null && options.exactDays !== undefined ? options.exactDays : 'no aplica'}`,
      "",
      "Resultado:",
      `- Total enviados: ${resultado.enviados}`,
      `- Total errores: ${resultado.errores.length}`,
      "",
      "Envíos por programa:",
      porPrograma,
      "",
      "Envíos por cuenta de envío:",
      porCuenta,
      "",
      "Listado de correos enviados:",
      lista,
      ...webFilterBlock,
      ...noEnviosExplicacion
    ].filter(Boolean).join("\n");

    const noEnviosBloque = [];
    if (resultado.enviados === 0) {
      noEnviosBloque.push("", "No se enviaron correos en esta corrida.");
      if (webFilters) {
        noEnviosBloque.push(
          "Motivos mas comunes detectados:",
          `- Ya estaban marcados como enviados: ${webFilters.skippedAlreadySent}`,
          `- Fuera del rango de fecha esperado: ${webFilters.skippedByMinDate + webFilters.skippedByWindow}`,
          webFilters.skippedByFase2False !== undefined
            ? `- Sin Fase 2 en TRUE: ${webFilters.skippedByFase2False}`
            : null,
          `- Registros con datos incompletos (email/postId): ${webFilters.skippedMissingCore}`,
          `- Registros con fecha invalida: ${webFilters.skippedInvalidDate}`
        );
      }
    }

    const resumenWebBloque = webFilters
      ? [
          "",
          "Resumen de la seleccion (WEB):",
          `- Registros revisados: ${webFilters.totalRows}`,
          `- Registros elegibles: ${webFilters.elegibles}`,
          `- Periodo evaluado: ${webFilters.massStartDate} -> ${webFilters.massEndDate || '-'}`,
          webFilters.skippedByFase2False !== undefined
            ? `- Filtrados por Fase 2 != TRUE: ${webFilters.skippedByFase2False}`
            : null,
        ]
      : [];

    const listaAmigable = enviados.length ? lista : "- (sin envios)";
    const descripcionCorrida =
      options.exactDays !== null && options.exactDays !== undefined
        ? `Envio por antiguedad exacta: ${options.exactDays} dias`
        : "Envio general";

    body = [
      "Hola equipo,",
      "",
      `Finalizo la corrida de ${phaseLabel}.`,
      `Fecha y hora: ${timestamp}`,
      `Tipo de corrida: ${descripcionCorrida}`,
      "",
      "Resultado principal:",
      `- Correos enviados: ${resultado.enviados}`,
      `- Errores: ${resultado.errores.length}`,
      ...noEnviosBloque,
      ...resumenWebBloque,
      "",
      "Distribucion de envios por programa:",
      porPrograma,
      "",
      "Distribucion de envios por cuenta remitente:",
      porCuenta,
      "",
      "Listado de correos enviados:",
      listaAmigable,
      "",
      "Datos tecnicos (referencia):",
      `- Tipo de corrida: ${runType}`,
      `- Flujo: ${this.getFlowLabel()}`,
      `- Hoja origen: ${this.sheetName}`,
      `- Spreadsheet ID: ${this.sheetId}`,
      webFilters ? `- URL de hoja: ${webFilters.sheetUrl || `${this.sheetName} (${this.sheetId})`}` : null,
      `- Limite aplicado: ${options.limit ? options.limit : 'sin limite'}`,
      `- Criterio exactDays: ${options.exactDays !== null && options.exactDays !== undefined ? options.exactDays : 'no aplica'}`,
    ].filter(Boolean).join("\n");
    MailApp.sendEmail({
      to: destinatarios.join(","),
      subject,
      body
    });

    const telegramLines = [
      `${phaseLabel} finalizada | ${runType}`,
      `Flujo: ${this.getFlowLabel()}`,
      `Fecha: ${timestamp}`,
      `Enviados: ${resultado.enviados}`,
      `Errores: ${resultado.errores.length}`,
    ];
    if (webFilters) {
      telegramLines.push(
        `Hoja: ${webFilters.sheetUrl || `${this.sheetName} (${this.sheetId})`}`,
        `Periodo evaluado: ${webFilters.massStartDate} -> ${webFilters.massEndDate || '-'}`,
        `Tuplas repetidas detectadas (sin deduplicar): ${webFilters.duplicateTuplesDetected || 0}`,
        `Ya enviados (${phaseLabel}=TRUE): ${webFilters.skippedAlreadySent}`,
        `Periodo elegible: ${webFilters.sentOldest} -> ${webFilters.sentNewest}`,
        `Periodo ya enviados: ${webFilters.alreadySentOldest} -> ${webFilters.alreadySentNewest}`
      );
    }
    if (resultado.enviados === 0 && webFilters) {
      telegramLines.push(
        "Sin envíos. Motivos:",
        `- fuera_fecha=${webFilters.skippedByMinDate}`,
        `- fuera_ventana=${webFilters.skippedByWindow}`,
        `- ya_true=${webFilters.skippedAlreadySent}`,
        `- faltantes=${webFilters.skippedMissingCore}`,
        `- fecha_invalida=${webFilters.skippedInvalidDate}`
      );
    }
    TelegramNotifier.getInstance().sendPlainMessage(telegramLines.join("\n"));
  }
}
