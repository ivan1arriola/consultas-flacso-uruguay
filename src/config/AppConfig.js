// --- CONSTANTES GLOBALES ---
// Helper: leer variable de entorno o usar valor por defecto
function envOr(key, defaultValue) {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return defaultValue;
}

// IDs y nombres de hojas de cálculo (leer desde ENV cuando esté disponible)
const SPREADSHEET_INFO_ID = envOr('SPREADSHEET_INFO_ID', "1fdWDVhOb9cksBDc9NY97rcN--tS8Pn-36BAq7I4vLQg");
const SHEET_OFERTA_ACTUAL = "Oferta Actual - Configuración";
const SPREADSHEET_REGISTROS_ID = envOr('SPREADSHEET_REGISTROS_ID', "1cxYDK1qh6LNddutmoOJrWkk05ZD5qkbzZIXDHA2oFbk");
const SHEET_DATOS_REGISTRADOS = "Datos registrados";
const SPREADSHEET_ADICIONAL_ID = envOr('SPREADSHEET_ADICIONAL_ID', "1oOhr55SLlMMyeEKZcVzUzE1mOhk-2_ohfjJTRC55ceQ");
const SHEET_ADICIONAL = "CURSOS";
const SUBJETIVIDAD_Y_TRABAJO_ID = 14657;
// Configuración Fase 2 (listado de correos a reenviar)
const SPREADSHEET_FASE2_ID = envOr('SPREADSHEET_FASE2_ID', "1pHOadNgS4JyitjG-8aKKaqWgnDu6N6Z8hvVHdkqTH_s");
const SHEET_FASE2_LISTADO = "Resultado";
const FASE2_COLUMNS = {
  EMAIL: "Correo",
  POST_ID: "ID",
  FIRST_NAME: "Nombre",
  LAST_NAME: "Apellido",
  ORIGEN: "Origen",
  ENVIADO: "Fase 2",
};
const FASE2_DESCUENTO = {
  PORCENTAJE_MAXIMO: 25,
  FECHA_LIMITE: "2025-12-30", // Formato YYYY-MM-DD para facilitar cambios
  FECHA_LIMITE_TEXTO: "30 de diciembre",
};
const FASE2_WEB_CONFIG = {
  SPREADSHEET_ID: SPREADSHEET_REGISTROS_ID,
  SHEET_NAME: SHEET_DATOS_REGISTRADOS,
  FECHA_INICIO_MASIVO: "2025-10-01", // Inicio del rango masivo (YYYY-MM-DD)
  MASIVO_HASTA_HOY_MENOS_DIAS: 7, // Fin del rango masivo: hoy - N dias
  DIARIO_DIAS_EXACTOS: 10, // Envío diario: consultas con exactamente N días
};
const FASE2_LIST_CONFIG = {
  SPREADSHEET_ID: envOr('FASE2_LIST_SPREADSHEET_ID', "1j_3aTsCX_9N9ZG9I4AnkWYFNfXXSq1rbgAqhii30Rro"),
  SHEET_GID: 176766916,
  SHEET_NAME: "Resumen",
};
const FASE3_WEB_CONFIG = {
  SPREADSHEET_ID: SPREADSHEET_REGISTROS_ID,
  SHEET_NAME: SHEET_DATOS_REGISTRADOS,
  FECHA_INICIO_MASIVO: "2025-11-01", // Primera tanda masiva: inicio fijo (YYYY-MM-DD)
  FECHA_FIN_MASIVO: "2026-03-01", // Primera tanda masiva: fin fijo (YYYY-MM-DD)
  TANDA_DIAS_EXACTOS_DEFAULT: 7, // Tandas posteriores manuales por antiguedad exacta
};
const FASE2_SUMMARY_CONFIG = {
  RECIPIENTS: ["web@flacso.edu.uy"],
  RUN_TYPES: {
    WEB_MASIVO: "WEB_MASIVO",
    WEB_DIARIO_PREFIX: "WEB_DIARIO_EXACTO_",
    REDES_GENERAL: "REDES_GENERAL",
    LISTADO_GENERAL: "LISTADO_GENERAL",
  },
};
const FASE3_SUMMARY_CONFIG = {
  RECIPIENTS: ["web@flacso.edu.uy"],
  RUN_TYPES: {
    WEB_MASIVO: "WEB_MASIVO",
    WEB_TANDA_PREFIX: "WEB_TANDA_EXACTO_",
    WEB_RECUPERO_FASE2_ULTIMO_MES: "WEB_RECUPERO_FASE2_ULTIMO_MES",
    LISTADO_GENERAL: "LISTADO_GENERAL",
  },
};
const FASE3_LIST_CONFIG = {
  SPREADSHEET_ID: envOr('FASE3_LIST_SPREADSHEET_ID', "12V8VbTHLKkZ2HfdwU05FfGiWLrLzKzbKWSsPaie3c5s"),
  SHEET_GID: 82437024,
  SHEET_NAME: "Resultado",
};
const FASE2_REDES_AUTORUN_CONFIG = {
  BATCH_SIZE: 1000,
  REQUEUE_DELAY_MS: 60 * 1000,
};
const FASE3_LIST_AUTORUN_CONFIG = {
  BATCH_SIZE: 500,
  REQUEUE_DELAY_MS: 60 * 1000,
};
const FASE2_LOG_CONFIG = {
  DETAIL_FIRST_ITEMS: 10,
  PROGRESS_EVERY: 25,
};
const DOPOST_RESERVED_SENDER_EMAIL = envOr('DOPOST_RESERVED_SENDER_EMAIL', "web@flacso.edu.uy");
// Balanceo de envíos entre cuentas (service account + Gmail API)
const SA_KEY_FILE_ID = envOr('SA_KEY_FILE_ID', "1PgjuFt64TQqRXIv_m4fgLc3VhtewDfOT");
const GMAIL_SA_SCOPE = envOr('GMAIL_SA_SCOPE', "https://www.googleapis.com/auth/gmail.send");
const MAILER_LOG_CONFIG = {
  SUCCESS_FIRST_SENDS: 3,
  SUCCESS_EVERY: 25,
};
const SENDER_BASE_DAILY_LIMIT = 1400;
const SENDER_ACCOUNTS = (function() {
  const fromEnv = envOr('SENDER_ACCOUNTS', null);
  if (fromEnv) return fromEnv.split(',').map(s=>s.trim()).filter(Boolean);
  return [
  "no-reply@flacso.edu.uy",
  "wordpress@flacso.edu.uy",
  "noreply@flacso.edu.uy",
  "notificaciones@flacso.edu.uy",
  "programacomunicacion@flacso.edu.uy",
  "noresponder@flacso.edu.uy",
  "redes@flacso.edu.uy",
  "anfitrionalternativo@flacso.edu.uy",
  "automatico@flacso.edu.uy",
  "envios-automatico@flacso.edu.uy",
  ];
})();

const SENDER_POOL_DAILY_LIMIT = SENDER_BASE_DAILY_LIMIT * SENDER_ACCOUNTS.length;
// Configuración de columnas
const COL_DATOS_REGISTRADOS = {
  CORREO: 0,
  NOMBRE: 1,
  OFERTA: 2,
  DIA: 3,
  HORA: 4,
  PAIS: 5,
  NIVEL: 6,
  POST_ID: 7,
  FASE_2: 8,
  FASE_3: 9
};
function normalizeSheetName_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function getSheetByFlexibleName_(spreadsheet, expectedName) {
  const direct = spreadsheet.getSheetByName(expectedName);
  if (direct) return direct;
  const normalizedExpected = normalizeSheetName_(expectedName);
  const sheets = spreadsheet.getSheets();
  const byExactNormalized = sheets.find(
    (sheet) => normalizeSheetName_(sheet.getName()) === normalizedExpected
  );
  if (byExactNormalized) return byExactNormalized;
  return sheets.find((sheet) => {
    const name = normalizeSheetName_(sheet.getName());
    return (
      name.includes('oferta actual') &&
      name.includes('config')
    );
  }) || null;
}
function obtenerColumnasOfertaActual() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_INFO_ID);
  const sheet = getSheetByFlexibleName_(ss, SHEET_OFERTA_ACTUAL);
  if (!sheet) {
    const disponibles = ss.getSheets().map((s) => s.getName()).join(', ');
    throw new Error(
      `No se encontro la hoja de oferta actual. Esperada: "${SHEET_OFERTA_ACTUAL}". Disponibles: ${disponibles}`
    );
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Definís vos las keys y el nombre exacto de la columna que aparece en la hoja
  const columnasDeseadas = {
    ID: "ID",
    ABREVIACION: "Abreviación",
    POSGRADO: "Posgrado",
    CORREO: "Correo",
    LINK_CARTA: "Link Carta",
    LINKS_POSTULACION: "Link Form Preinscripción",
    FIN_DE_INSCRIPCIONES: "Fin de inscripciones",
    SIGUE_F1: "Fase_1",
    EN_FASE_3: "Fase_3",
    FASE_2 : "Fase_2"
  };
  const map = {};
  // Buscamos el índice de cada columna según el nombre que definiste
  for (const key in columnasDeseadas) {
    const colName = columnasDeseadas[key];
    const index = headers.findIndex(h => h.toString().trim() === colName);
    if (index === -1) {
      throw new Error(`No se encontró la columna "${colName}" en la hoja`);
    }
    map[key] = index;
  }
  return map;
}
/**
 *  Formatea una cadena ISO a {fecha, hora, zona}
 * Ej: "2025-11-04T23:08:06-03:00"  { fecha: "04/11/2025", hora: "23:08", zona: "-03:00" }
 */
function formatearFechaISO(isoString) {
  try {
    const fechaObj = new Date(isoString);
    const fecha = fechaObj.toLocaleDateString('es-UY', {
      timeZone: 'America/Montevideo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hora = fechaObj.toLocaleTimeString('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,          // Fuerza formato 24h (HH:MM)
      timeZone: 'America/Montevideo' // Alinea con la zona usada para la fecha
    });
    const zona = isoString.slice(-6); // Ej: "-03:00"
    return { fecha, hora, zona };
  } catch (e) {
    return { fecha: '-', hora: '-', zona: '-' };
  }
}
// Uso
const COLS_OFERTA_ACTUAL = obtenerColumnasOfertaActual();
const CONVENIOS_VIGENTES = "https://flacso.edu.uy/convenios/"
const FORMAS_PAGO_LINK = "https://flacso.edu.uy/formas-de-pago/"
// Configuración de email
const EMAIL_CONFIG = {
  REPLY_TO: envOr('EMAIL_REPLY_TO', "inscripciones@flacso.edu.uy"),
  FROM_NAME: envOr('EMAIL_FROM_NAME', "FLACSO Uruguay"),
  LOGO_URL: envOr('EMAIL_LOGO_URL', "https://flacso.edu.uy/wp-content/uploads/2024/10/384ddefb-522d-432a-bbc8-c86f09bdceef.png")
};
// Configuración Telegram
const TELEGRAM_CONFIG = {
  BOT_TOKEN: envOr('TELEGRAM_BOT_TOKEN', ''),
  CHAT_ID: envOr('TELEGRAM_CHAT_ID', '')
};



