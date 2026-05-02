// =============================================================
//  CLASE SpreadsheetManager (usa hoja "Oferta Actual - Configuración")
// =============================================================
class SpreadsheetManager {
  constructor() {
    this.sheetId = SPREADSHEET_INFO_ID;
    this.sheetName = SHEET_OFERTA_ACTUAL;
    this.sheetRegistrosId = SPREADSHEET_REGISTROS_ID;
    this.sheetRegistrosName = SHEET_DATOS_REGISTRADOS;
  }
  getPageInfo(postId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.sheetId);
      const sheet = this.getOfferSheet(spreadsheet);
      if (!sheet) {
        const disponibles = spreadsheet.getSheets().map((s) => s.getName()).join(", ");
        throw new Error(
          `No se encontro la hoja "${this.sheetName}" en ${this.sheetId}. Disponibles: ${disponibles}`
        );
      }
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        Logger.log(" Hoja vacía o solo encabezados");
        return null;
      }
      const headers = data[0];
      const rows = data.slice(1);
      const match = rows.find(r => String(r[0]).trim() === String(postId).trim());
      if (!match) {
        Logger.log(` No se encontró coincidencia para ID: ${postId}`);
        return null;
      }
      const obj = {};
      headers.forEach((h, i) => obj[h] = match[i]);
      const pageInfo = new PageInfo(obj);
      return pageInfo;
    } catch (error) {
      Logger.log(` Error al obtener PageInfo: ${error}`);
      TelegramNotifier.getInstance().notifyError(error, { handler: 'SpreadsheetManager.getPageInfo', postId });
      return null;
    }
  }
  getOfferSheet(spreadsheet) {
    const direct = spreadsheet.getSheetByName(this.sheetName);
    if (direct) return direct;
    const normalizedExpected = this.normalizeSheetName(this.sheetName);
    const sheets = spreadsheet.getSheets();
    const byExactNormalized = sheets.find(
      (sheet) => this.normalizeSheetName(sheet.getName()) === normalizedExpected
    );
    if (byExactNormalized) return byExactNormalized;
    return sheets.find((sheet) => {
      const name = this.normalizeSheetName(sheet.getName());
      return name.includes("oferta actual") && name.includes("config");
    }) || null;
  }
  normalizeSheetName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  registerData(formData, pageInfo) {
    try {
      const ss = SpreadsheetApp.openById(this.sheetRegistrosId);
      const sheet = ss.getSheetByName(this.sheetRegistrosName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = new Array(headers.length).fill("");
      // Helper para ubicar columnas por encabezado
      const setColValue = (colName, value) => {
        const index = headers.indexOf(colName);
        if (index !== -1) row[index] = value;
      };
      // Asignar valores según encabezados actuales
      setColValue("Tu correo electrónico", this.normalizeEmail(formData.email));
      setColValue("Nombre", formData.first_name || formData.name || "");
      setColValue("Apellido", formData.last_name || "");
      setColValue("Profesión", formData.profession || "");
      setColValue("Oferta Consultada", pageInfo.posgrado);
      setColValue("Día", formData.date || "");
      setColValue("Hora", formData.time || "");
      setColValue("País de residencia", formData.country || "");
      setColValue("Nivel educativo", formData.educationLevel || "");
      setColValue("Post_ID", formData.postId || ""); //  Nueva columna
      // ===  Insertar en la primera fila disponible (debajo de encabezados)
      sheet.insertRowAfter(1); // Inserta una nueva fila en la posición 2
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
      Logger.log(" Registro insertado arriba correctamente");
    } catch (error) {
      Logger.log(` Error al registrar datos: ${error}`);
      TelegramNotifier.getInstance().notifyError(error, { handler: 'SpreadsheetManager.registerData', postId: formData?.postId });
    }
  }
  getRegisteredContactsByEmailAndPostId() {
    try {
      const ss = SpreadsheetApp.openById(this.sheetRegistrosId);
      const sheet = ss.getSheetByName(this.sheetRegistrosName);
      if (!sheet) return {};
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return {};
      const headers = values[0].map((h) => String(h).trim());
      const emailIdx = headers.indexOf("Tu correo electrónico");
      const postIdIdx = headers.indexOf("Post_ID");
      const firstNameIdx = headers.indexOf("Nombre");
      const lastNameIdx = headers.indexOf("Apellido");
      if (emailIdx === -1 || postIdIdx === -1) return {};
      const index = {};
      values.slice(1).forEach((row) => {
        const email = this.normalizeEmail(row[emailIdx]);
        const postId = this.cleanCell(row[postIdIdx]);
        if (!email || !postId) return;
        const key = `${email}::${postId}`;
        const firstName = firstNameIdx !== -1 ? this.cleanCell(row[firstNameIdx]) : "";
        const lastName = lastNameIdx !== -1 ? this.cleanCell(row[lastNameIdx]) : "";
        if (!firstName && !lastName) return;
        if (!index[key]) {
          index[key] = {
            firstName,
            lastName,
          };
        }
      });
      return index;
    } catch (error) {
      Logger.log(` Error al obtener contactos registrados: ${error}`);
      TelegramNotifier.getInstance().notifyError(error, { handler: 'SpreadsheetManager.getRegisteredContactsByEmailAndPostId' });
      return {};
    }
  }
  cleanCell(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
  normalizeEmail(value) {
    let email = this.cleanCell(value).toLowerCase();
    if (!email) return "";
    email = email.replace(/^mailto:/i, "");
    email = email.replace(/\s+/g, "");
    email = email.replace(/^[\"'`<>\(\)\[\]\{\},;:]+/, "");
    email = email.replace(/[\"'`<>\(\)\[\]\{\},;:]+$/, "");
    email = email.replace(/[.!?,;:]+$/, "");
    return email;
  }
}
// =============================================================
//  CLASE PageInfo (usa los campos de la hoja Oferta Actual - Configuración)
// =============================================================
class PageInfo {
  constructor(d) {
    this.id = d["ID"] || "";
    this.abreviacion = d["Abreviación"] || "";
    this.tipo = d["Tipo"] || ""; // Nuevo campo
    this.posgrado = d["Posgrado"] || "";
    this.correo = d["Correo"] || EMAIL_CONFIG.REPLY_TO;
    this.enlaceCarta = d["Link Carta"] || "";
    this.enlacePreinscripcion = d["Link Form Preinscripción"] || "";
    this.finInscripciones = d["Fin de inscripciones"] || "";
    this.fase1Activa = String(d["Fase_1"]).toLowerCase() === "true";
    this.fase2Activa = String(d["Fase_2"]).toLowerCase() === "true";
    this.fase3Activa = String(d["Fase_3"]).toLowerCase() === "true";
    this.proximoInicio = d["Próximo Inicio texto"] || "";
    this.duracion = d["Duración"] || "";
    this.validezInternacional = d["Validez Internacional"] || "";
  }
  esValida() {
    return !!this.id;
  }
}




