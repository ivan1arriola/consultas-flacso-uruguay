// =============================================================
//  CLASE ProcessingData (actualizada con campos nuevos)
// =============================================================
class ProcessingData {
  constructor(formData) {
    this.spreadsheetManager = new SpreadsheetManager();
    // Formatear fecha ISO si existe
    const fechaISO = formData.meta?.ts || null;
    const fechaFormateada = fechaISO ? formatearFechaISO(fechaISO) : { fecha: null, hora: null };
    this.formData = {
      postId: formData.postId || null,
      postTitle: formData.postTitle || null,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      name: formData.name || null, // sigue estando por compatibilidad
      email: formData.email || null,
      country: formData.country || null,
      educationLevel: formData.educationLevel || null,
      profession: formData.profession || null,
      url_base: this._normalizeBaseUrl(formData.url_base) || null,
      date: fechaFormateada.fecha || null, // Fecha en formato dd/mm/yyyy
      time: fechaFormateada.hora || null, // Hora en hh:mm
      meta: formData.meta || {}, // metadatos opcionales (ts, ua, ip, etc.)
      timezone: fechaFormateada.zona || null,
    };
    this.pageInfo = this._getPageInfo();
    this.enlaceWordpress = this.formData.url_base;
    this._programLinks = null;
    this.hasPersonalData =
      !!(this.formData.first_name || this.formData.last_name || this.formData.country || this.formData.educationLevel);
    this.onlyEmail = !this.hasPersonalData;
    this.isValid = this._validate();
    if (this.isValid) this.loadWordpressLink();
  }
  _getPageInfo() {
    if (!this.formData.postId) return null;
    const info = this.spreadsheetManager.getPageInfo(this.formData.postId);
    if (info && info.esValida()) return info;
    Logger.log(" No se pudo obtener información de la página");
    return null;
  }
  _validate() {
    if (!this.formData.email || !this.formData.postId) return false;
    if (!this.pageInfo) return false;
    return true;
  }
  obtenerEnlaceWordPress(id) {
    if (this.formData.url_base) return this.formData.url_base;
    const base = "https://flacso.edu.uy/wp-json/wp/v2";
    const endpoints = [`${base}/posts/${id}`, `${base}/pages/${id}`];
    for (const url of endpoints) {
      try {
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (res.getResponseCode() === 200) {
          const data = JSON.parse(res.getContentText());
          return data.link || null;
        }
      } catch (e) {
        Logger.log(`️ Error obteniendo enlace WP: ${e}`);
      }
    }
    return null;
  }
  loadWordpressLink() {
    const resolved = this._normalizeBaseUrl(this.obtenerEnlaceWordPress(this.formData.postId));
    this.enlaceWordpress = resolved;
    if (this.pageInfo) this.pageInfo.enlaceWordpress = resolved;
    this._programLinks = null;
  }
  /**
   * Retorna todos los datos relevantes para ser guardados en la hoja
   */
  getSpreadsheetData() {
    return {
      formData: this.formData,
      pageInfo: this.pageInfo,
      enlaceWordpress: this.enlaceWordpress,
    };
  }
  /**
   * Log para verificar datos del formulario y la página
   */
  logData() {
    const fullName = `${this.formData.first_name || ''} ${this.formData.last_name || ''}`.trim();
    const prof = this.formData.profession || '';
    Logger.log(`
 FORMULARIO:
  ID WP: ${this.formData.postId}
  Título WP: ${this.formData.postTitle || ""}
  Nombre: ${fullName || this.formData.name || ""}
  Profesión: ${prof}
  Email: ${this.formData.email}
  País: ${this.formData.country || ""}
  Nivel Académico: ${this.formData.educationLevel || ""}
  Fecha: ${this.formData.date || ""}
  Hora: ${this.formData.time || ""} (GMT${this.formData.timezone || ""})
 PÁGINA:
  ${this.pageInfo ? `${this.pageInfo.posgrado} (${this.pageInfo.abreviacion}) | Fase 1: ${this.pageInfo.fase1Activa ? "Sí" : "No"}` : " No disponible"}
 Enlace WP: ${this.enlaceWordpress || "No encontrado"}
    `);
  }

  getProgramLinks() {
    if (!this._programLinks) {
      const base = this._resolveBaseUrl();
      const sanitize = (url) => this._sanitizeUrl(url);
      const cartaFallback = sanitize(this.pageInfo?.enlaceCarta);
      const preFallback = sanitize(this.pageInfo?.enlacePreinscripcion);

      this._programLinks = {
        base,
        carta: base ? `${base}/carta` : cartaFallback,
        preinscripcion: base ? `${base}/preinscripcion` : preFallback,
      };
    }

    return this._programLinks;
  }

  _resolveBaseUrl() {
    const candidates = [
      this.formData.url_base,
      this.enlaceWordpress,
      this.pageInfo?.enlaceWordpress,
      this._stripSlug(this.pageInfo?.enlaceCarta, 'carta'),
      this._stripSlug(this.pageInfo?.enlacePreinscripcion, 'preinscripcion'),
    ];

    for (const candidate of candidates) {
      const normalized = this._normalizeBaseUrl(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  _stripSlug(url, slug) {
    const sanitized = this._sanitizeUrl(url);
    if (!sanitized) return null;
    const regex = new RegExp(`/${slug}\\/?$`, 'i');
    if (!regex.test(sanitized)) return null;
    return sanitized.replace(regex, '');
  }

  _normalizeBaseUrl(url) {
    const sanitized = this._sanitizeUrl(url);
    if (!sanitized) return null;
    return sanitized.replace(/\/$/, '');
  }

  _sanitizeUrl(url) {
    if (!url) return null;
    return String(url).trim();
  }
}



