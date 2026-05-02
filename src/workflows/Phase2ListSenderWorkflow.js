/* =============================================================
 *  Gestor de envios Fase 2 - Listado manual
 *  - Lee hoja externa con columnas: Correo destino, ID, Enviado
 *  - Marca columna Enviado en TRUE para evitar reenvios
 *  - Reutiliza el mismo contenido de correo que Fase 2
 * ============================================================= */
function getFase2ListSenderClass_() {
  if (globalThis.__Fase2ListSenderClass) return globalThis.__Fase2ListSenderClass;
  if (typeof Fase2Sender === 'undefined') {
    throw new Error('Fase2Sender no esta disponible al inicializar Fase2ListSender');
  }

  globalThis.__Fase2ListSenderClass = class Fase2ListSender extends Fase2Sender {
    constructor() {
      super();
      this.sheetId = FASE2_LIST_CONFIG.SPREADSHEET_ID;
      this.sheetGid = Number(FASE2_LIST_CONFIG.SHEET_GID);
      this.sheetName = this.resolveSheetName();
    }

    resolveSheetName() {
      const ss = SpreadsheetApp.openById(this.sheetId);
      if (Number.isFinite(this.sheetGid)) {
        const byGid = ss.getSheets().find((sheet) => sheet.getSheetId() === this.sheetGid);
        if (byGid) return byGid.getName();
      }
      const fallback = (FASE2_LIST_CONFIG.SHEET_NAME || '').toString().trim();
      if (fallback) return fallback;
      throw new Error(
        `No se encontro la hoja objetivo para Fase 2 listado (gid=${FASE2_LIST_CONFIG.SHEET_GID}).`
      );
    }

    getRunType() {
      return FASE2_SUMMARY_CONFIG.RUN_TYPES.LISTADO_GENERAL;
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

      return {
        email: findCol(['Correo destino', 'Correo']),
        postId: findCol(['ID', 'Post_ID', 'ID oferta']),
        firstName: -1,
        lastName: -1,
        origen: -1,
        enviado: findCol(['Enviado', 'Fase 2']),
      };
    }

    buildItem(row, map, rowNumber) {
      const email = this.normalizeEmail(row[map.email]);
      const postId = this.cleanCell(row[map.postId]);
      if (!email || !postId || !this.isValidEmail(email)) return null;
      if (map.enviado !== -1) {
        const enviadoVal = row[map.enviado];
        if (typeof enviadoVal === 'boolean' ? enviadoVal : String(enviadoVal).toLowerCase() === 'true') {
          return null;
        }
      }
      return {
        email,
        postId,
        firstName: '',
        lastName: '',
        origen: '',
        rowNumber,
      };
    }
  };
  return globalThis.__Fase2ListSenderClass;
}
