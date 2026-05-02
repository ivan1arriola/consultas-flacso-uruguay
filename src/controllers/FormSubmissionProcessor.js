// =============================================================
//  CLASE FormProcessor (usa EmailManager y ProcessingData)
// =============================================================
class FormProcessor {
  constructor() {
    this.spreadsheetManager = new SpreadsheetManager();
    this.emailManager = new EmailManager();
    this.webhookSendOptions = {
      useReservedSenderForNoCapacity: true,
      reservedSenderEmail: DOPOST_RESERVED_SENDER_EMAIL,
    };
  }
  processRequest(processingData) {
    try {
      if (!processingData.isValid) throw new Error("Datos inválidos");
      processingData.logData();
      if (processingData.onlyEmail) {
        Logger.log(" Enviando solo correo (sin registro)");
        this.emailManager.sendEmail(processingData, this.webhookSendOptions);
        return this.createSuccessResponse("email_only");
      } else {
        Logger.log(" Procesamiento completo (con registro)");
        this.spreadsheetManager.registerData(processingData.formData, processingData.pageInfo);
        this.emailManager.sendEmail(processingData, this.webhookSendOptions);
        return this.createSuccessResponse("full");
      }
    } catch (err) {
      TelegramNotifier.getInstance().notifyError(err, {
        handler: 'FormProcessor.processRequest',
        mode: processingData?.onlyEmail ? 'email_only' : 'full',
        postId: processingData?.formData?.postId || 'sin postId'
      });
      return this.createErrorResponse(err);
    }
  }
  createSuccessResponse(mode) {
    return {
      success: true,
      mode,
      message: mode === "full" ? "Procesamiento completo exitoso" : "Correo enviado exitosamente",
      timestamp: new Date().toISOString(),
    };
  }
  createErrorResponse(error) {
    return {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString(),
    };
  }
}


