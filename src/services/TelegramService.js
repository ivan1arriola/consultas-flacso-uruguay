// =============================================================
// TelegramNotifier (Singleton + Facade)
// - Envia mensajes a Telegram
// - Construye mensajes de error y de webhook
// =============================================================
class TelegramNotifier {
  constructor(config) {
    this.config = config;
  }
  static getInstance() {
    if (!TelegramNotifier.instance) {
      TelegramNotifier.instance = new TelegramNotifier(TELEGRAM_CONFIG);
    }
    return TelegramNotifier.instance;
  }
  notifyError(error, contexto = {}) {
    try {
      const mensaje = this.buildErrorMessage(error, contexto);
      this.sendMessage(mensaje);
    } catch (notifyError) {
      Logger.log('No se pudo enviar la notificacion de error a Telegram: ' + notifyError);
    }
  }
  sendWebhookMessage(data) {
    const mensaje = this.buildWebhookMessage(data);
    this.sendMessage(mensaje);
  }
  sendPlainMessage(mensaje) {
    const url = `https://api.telegram.org/bot${this.config.BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: this.config.CHAT_ID,
      text: mensaje,
    };
    const params = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, params);
    Logger.log("Telegram response (plain): " + response.getContentText());
  }
  buildErrorMessage(error, contexto = {}) {
    const detalleCrudo = (error && error.stack) ? error.stack : String(error || 'Error desconocido');
    const maxLen = 3500; // margen para no superar 4096 caracteres
    const detalle = detalleCrudo.length > maxLen ? `${detalleCrudo.slice(0, maxLen)}...` : detalleCrudo;
    const contextoLineas = Object.keys(contexto)
      .map((clave) => `- ${clave}: ${contexto[clave]}`);
    return [
      '️ Error detectado en Apps Script',
      `- Fecha: ${new Date().toISOString()}`,
      ...contextoLineas,
      '- Detalle:',
      '```',
      detalle,
      '```'
    ].join('\n');
  }
  buildWebhookMessage(data) {
    const fechaISO = data.fecha_envio || new Date().toISOString();
    const f = formatearFechaISO(fechaISO);
    return `
 *Nueva Consulta Recibida*
 *Datos del Interesado*
 *Nombre:* ${data.nombre} ${data.apellido}
 *Correo:* ${data.correo}
 *País:* ${data.pais}
 *Nivel académico:* ${data.nivel_academico}
 *Profesión:* ${data.profesion || 'Sin especificar'}
 *Posgrado Consultado*
 *Título:* ${data.titulo_posgrado}
 *ID WP:* ${data.id_pagina}
 *Fecha:* ${f.fecha}
⏰ *Hora:* ${f.hora} (GMT${f.zona})
 *Página de origen:* ${data.url_base || 'No disponible'}
  `.trim();
  }
  sendMessage(mensaje) {
    const url = `https://api.telegram.org/bot${this.config.BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: this.config.CHAT_ID,
      text: mensaje,
      parse_mode: 'Markdown'
    };
    const params = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, params);
    Logger.log("Telegram response: " + response.getContentText());
  }
}

