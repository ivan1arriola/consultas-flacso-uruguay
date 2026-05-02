// =============================================================
// WebhookController (Facade)
// - Orquesta la validación, procesamiento y notificación
// =============================================================
class WebhookController {
  constructor() {
    this.formProcessor = new FormProcessor();
    this.telegram = TelegramNotifier.getInstance();
  }
  handlePost(e) {
    try {
      const data = this.parseRequest(e);
      this.validatePayload(data);
      const processingData = this.buildProcessingData(data, e);
      if (typeof processingData.loadWordpressLink === 'function') {
        processingData.loadWordpressLink();
      }
      const result = this.formProcessor.processRequest(processingData);
      this.telegram.sendWebhookMessage(data);
      return this.buildJsonResponse(result);
    } catch (error) {
      this.telegram.notifyError(error, {
        handler: 'WebhookController.handlePost',
        rawBody: e?.postData?.contents ? e.postData.contents.slice(0, 500) : 'sin cuerpo'
      });
      const errorPayload =
        typeof this.formProcessor.createErrorResponse === 'function'
          ? this.formProcessor.createErrorResponse(error)
          : {
              success: false,
              error: String(error),
              timestamp: new Date().toISOString(),
            };
      return this.buildJsonResponse(errorPayload);
    }
  }
  parseRequest(e) {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Solicitud inválida: cuerpo vacío.');
    }
    return JSON.parse(e.postData.contents);
  }
  validatePayload(data) {
    const {
      id_pagina: programId = null,
      titulo_posgrado: titulo = null,
      nombre = null,
      apellido = null,
      pais = null,
      correo = null,
      nivel_academico: nivel = null,
      url_base = null
    } = data;
    const faltantes = [];
    if (!programId) faltantes.push('id_pagina');
    if (!nombre) faltantes.push('nombre');
    if (!apellido) faltantes.push('apellido');
    if (!pais) faltantes.push('pais');
    if (!correo) faltantes.push('correo');
    if (!nivel) faltantes.push('nivel_academico');
    if (!titulo) faltantes.push('titulo_posgrado');
    if (!url_base) faltantes.push('url_base');
    if (faltantes.length) {
      throw new Error('Faltan campos requeridos: ' + faltantes.join(', '));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo).trim())) {
      throw new Error('El correo no tiene un formato válido.');
    }
  }
  buildProcessingData(data, e) {
    const {
      id_pagina: programId = null,
      titulo_posgrado: titulo = null,
      nombre = null,
      apellido = null,
      pais = null,
      correo = null,
      nivel_academico: nivel = null,
      profesion = null,
      url_base = null,
      fecha_envio = null
    } = data;
    const formData = {
      postId: String(programId),
      postTitle: titulo,
      first_name: String(nombre).trim(),
      last_name: String(apellido).trim(),
      name: `${String(nombre).trim()} ${String(apellido).trim()}`,
      country: String(pais).trim(),
      email: String(correo).trim(),
      educationLevel: String(nivel).trim(),
      profession: profesion || '',
      url_base: url_base || '',
      date: (fecha_envio || '').split('T')[0] || '',
      time: (fecha_envio || '').split('T')[1] || '',
      meta: {
        ts: fecha_envio || new Date().toISOString(),
        ua: e?.postData?.type || '',
      }
    };
    return new ProcessingData(formData);
  }
  buildJsonResponse(payload) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

