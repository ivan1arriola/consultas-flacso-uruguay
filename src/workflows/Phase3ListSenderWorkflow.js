/* =============================================================
 *  Gestor de envios Fase 3 - Listado manual
 *  - Lee hoja externa (incluye variante "Resultado": Fecha, Correo, Posgrado, ID, Enviado)
 *  - Marca columna de enviado en TRUE para evitar reenvios
 * ============================================================= */
class Fase3ListSender extends Fase2Sender {
  constructor() {
    super();
    this.sheetId = FASE3_LIST_CONFIG.SPREADSHEET_ID;
    this.sheetGid = Number(FASE3_LIST_CONFIG.SHEET_GID);
    this.sheetName = this.resolveSheetName();
  }

  resolveSheetName() {
    const ss = SpreadsheetApp.openById(this.sheetId);
    if (Number.isFinite(this.sheetGid)) {
      const byGid = ss.getSheets().find((sheet) => sheet.getSheetId() === this.sheetGid);
      if (byGid) return byGid.getName();
    }
    const fallback = (FASE3_LIST_CONFIG.SHEET_NAME || '').toString().trim();
    if (fallback) return fallback;
    throw new Error(
      `No se encontro la hoja objetivo para Fase 3 listado (gid=${FASE3_LIST_CONFIG.SHEET_GID}).`
    );
  }

  getPhaseLabel() {
    return 'Fase 3';
  }

  getRunType() {
    return FASE3_SUMMARY_CONFIG.RUN_TYPES.LISTADO_GENERAL;
  }

  mapColumns(headers) {
    const normalize = (value) => String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u')
      .replace(/\s+/g, ' ')
      .replace(/_/g, ' ');

    const normalizedHeaders = headers.map((h) => normalize(h));
    const findCol = (expectedCandidates) => {
      for (let i = 0; i < expectedCandidates.length; i += 1) {
        const idx = normalizedHeaders.indexOf(normalize(expectedCandidates[i]));
        if (idx !== -1) return idx;
      }
      throw new Error(`No se encontro ninguna columna esperada: ${expectedCandidates.join(', ')}`);
    };
    const findOptionalCol = (expectedCandidates) => {
      for (let i = 0; i < expectedCandidates.length; i += 1) {
        const idx = normalizedHeaders.indexOf(normalize(expectedCandidates[i]));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    return {
      email: findCol(['Correo destino', 'Correo', 'Email']),
      postId: findCol(['ID', 'Post_ID', 'Post ID', 'ID oferta', 'Id oferta']),
      firstName: findOptionalCol(['Nombre']),
      lastName: findOptionalCol(['Apellido']),
      origen: -1,
      enviado: findCol(['Enviado', 'Fase 3', 'Fase3', 'fase3']),
    };
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
