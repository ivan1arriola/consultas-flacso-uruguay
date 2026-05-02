// --- GESTIN DE DATOS DE PROGRAMAS ACADMICOS ---
/**
 * Clase para gestionar los datos adicionales de los programas
 */
class ProgramDataManager {
  constructor() {
    this.spreadsheetId = SPREADSHEET_INFO_ID;
  }
  getSheetData(sheetName) {
    try {
      const sheet = SpreadsheetApp
        .openById(this.spreadsheetId)
        .getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`No se encontró la hoja: ${sheetName}`);
        return [];
      }
      return sheet.getDataRange().getValues().slice(1); // Excluir encabezados
    } catch (error) {
      Logger.log(`Error al cargar datos de ${sheetName}: ${error}`);
      TelegramNotifier.getInstance().notifyError(error, { handler: 'ProgramDataManager.getSheetData', sheetName });
      return [];
    }
  }
}
