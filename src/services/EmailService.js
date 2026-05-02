/* =============================================================
 *  ️ CLASE EmailManager
 *  - Envía correo dependiendo de Fase 1 activa o no
 *  - Mantiene texto original en Fase 1 (maquetado mejorado)
 * ============================================================= */
class EmailManager {
  constructor() {
    this.commonCSS = this.getCommonCSS();
    this.mailer = new BalancedMailer();
    this.sendSequence = 0;
  }
  sendEmail(processingData, sendOptions = {}) {
    const { formData } = processingData;
    const composer = EmailComposerFactory.forProcessingData(processingData, this);
    const { subject, htmlBody } = composer.compose(processingData);
    const programName = this.getProgramNameForLog(processingData);
    return this.sendGenericEmail(formData.email, subject, htmlBody, {
      ...(sendOptions || {}),
      programName,
    });
  }
  sendPhase2Email(processingData, discountInfo) {
    const { formData } = processingData;
    const composer = EmailComposerFactory.forPhase2(this, discountInfo);
    const { subject, htmlBody } = composer.compose(processingData);
    const programName = this.getProgramNameForLog(processingData);
    return this.sendGenericEmail(formData.email, subject, htmlBody, { programName });
  }
  sendPhase3Email(processingData) {
    const { formData } = processingData;
    const subject = this.buildPhase3Subject(processingData.pageInfo);
    const htmlBody = this.buildPhase3Email(processingData);
    const programName = this.getProgramNameForLog(processingData);
    return this.sendGenericEmail(formData.email, subject, htmlBody, { programName });
  }
  sendPhase2EmailWithOptions(processingData, discountInfo, sendOptions = {}) {
    const composer = EmailComposerFactory.forPhase2(this, discountInfo);
    const { subject, htmlBody } = composer.compose(processingData);
    const to = (sendOptions.to || (processingData.formData && processingData.formData.email) || '').toString().trim();
    if (!to) {
      throw new Error("sendPhase2EmailWithOptions requiere un destinatario");
    }
    const programName = this.getProgramNameForLog(processingData);
    return this.sendGenericEmail(to, subject, htmlBody, {
      ...(sendOptions || {}),
      programName,
    });
  }
  getProgramNameForLog(processingData) {
    const pageInfo = processingData && processingData.pageInfo ? processingData.pageInfo : null;
    const abreviacion = pageInfo && pageInfo.abreviacion ? String(pageInfo.abreviacion).trim() : '';
    if (abreviacion) return abreviacion;
    const posgrado = pageInfo && pageInfo.posgrado ? String(pageInfo.posgrado).trim() : '';
    return posgrado;
  }
  /**
   * ===========================================================
   *  Fase 1 ACTIVA  Correo principal de información detallada
   *  (Mantiene el texto original solicitado, con mejor maquetado)
   * ===========================================================
   */
  buildPhase1Email(processingData, options = {}) {
    const { formData, pageInfo } = processingData;
    const { includeContactBlock = true, discountInfo = null, saludoPersonalizado = null } = options;
    const nombrePrograma = pageInfo.posgrado || 'el programa académico';
    const rawSaludo = (saludoPersonalizado || formData.name || '').trim();
    const esGenerico = ['estimado/a', 'estimada/o', 'estimad@', 'estimadx', 'estimado', 'estimada']
      .includes(rawSaludo.toLowerCase());
    const nombreSaludo = esGenerico ? '' : rawSaludo;
    const { art } = this.getDeterminantes(nombrePrograma);
    const saludo = `
      <p style="text-align: justify;">Estimada/o${nombreSaludo ? ` <strong>${nombreSaludo}</strong>` : ''}</p>
      <p style="text-align: justify;">
        Esperamos que te encuentres muy bien. Tengo el gusto de hacerte llegar la información sobre ${art ? art + ' ' : ''}<b>${nombrePrograma}</b>.
        Recuerda que, en este primer semestre, nuestros posgrados inician entre marzo y abril de 2026.
      </p>`;
    const textoCentral = `
      <p style="text-align: justify;">
        Nuestra <b>Facultad de Posgrados</b> es un <b>organismo internacional, público y regional</b>
        que busca formar a sus estudiantes con <b>excelencia académica</b>,
        <b>proyección profesional</b> y <b>compromiso social</b>.
        Nos respaldan <b>19 años</b> de trayectoria a nivel nacional y más de <b>65 años</b> a nivel internacional,
        consolidando un <b>sistema académico regional de referencia</b> en formación e investigación.
      </p>
      <p style="text-align: justify;">
        Además, <b>más de 7000 personas egresadas</b> de <b>FLACSO Uruguay</b> trabajan en el ámbito público, privado y en organismos internacionales.
      </p>
      <p style="text-align: justify;">
        <b>Nos distingue un sistema de gestión académica eficiente y cercano</b>,
        que acompaña de forma personalizada a cada estudiante y garantiza altos niveles de egreso, superiores al 90%.
      </p>
      <p style="text-align: justify;">
        Nuestras cursadas son <b>100% online</b>, al igual que las instancias de evaluación académica,
        lo que garantiza flexibilidad y calidad en la formación.
      </p>`;
    const defaultBase = 'https://flacso.edu.uy/formacion';
    const links =
      typeof processingData.getProgramLinks === 'function'
        ? processingData.getProgramLinks()
        : { base: formData.url_base || null, carta: null, preinscripcion: null };
    const enlaceCarta = links.carta || pageInfo.enlaceCarta || `${defaultBase}/carta`;
    const enlacePre = links.preinscripcion || pageInfo.enlacePreinscripcion || `${defaultBase}/preinscripcion`;
    const { prep } = this.getDeterminantes(nombrePrograma);
    const botonCarta = this.createButton(
      ' Ver costos, programa y requisitos',
      enlaceCarta,
      '#16396f',
      '#ffffff'
    );
    const botonPre = this.createButton(
      'Formulario de Preinscripción',
      enlacePre,
      '#27a844',
      '#ffffff'
    );
    const botonConvenios = this.createButton(
      'Convenios FLACSO Uruguay',
      CONVENIOS_VIGENTES,
      '#fed222',
      '#0f1a2d'
    );
    const bloqueConveniosFinanciamiento = `
      <p style="text-align: justify;">
        Podés cursar ${nombrePrograma} abonando en <b>cuotas mensuales</b> durante toda la formación.
        Contamos con múltiples <b>descuentos por convenios institucionales</b>, beneficios para egresados,
        becas parciales y facilidades de pago adaptadas a cada situación personal.
      </p>
            <p style="text-align: justify;">
        Consultá los convenios vigentes aquí:
      </p>
      ${botonConvenios}
`;
    const reconocimiento = pageInfo.validezInternacional
      ? `
        <div style="
          background:#e9f2ff; border-left:4px solid #16396f;
          padding:12px 16px; margin:20px 0; border-radius:6px;
          font-size:15px; color:#16396f;
        ">
          <strong> Titulaciones de reconocimiento internacional:</strong><br>
          ${pageInfo.validezInternacional}
        </div>`
      : '';
    const discountBlock = this.getDiscountBlock(discountInfo);
    const headerTitle = `Información sobre ${nombrePrograma}`;
    return this.wrapHTML(
      `
      <div style="padding:24px;">
        ${saludo}
        <div style="height:1px; background:#e2e2e2; margin:10px 0 12px;"></div>
        ${textoCentral}
        ${discountBlock}
        ${reconocimiento}
      </div>
      ${botonCarta}
      ${botonPre}
      <div style="padding:24px;">
        <div style="height:1px; background:#e2e2e2; margin:10px 0 12px;"></div>
        ${bloqueConveniosFinanciamiento}
        ${includeContactBlock ? this.getContactBlock(processingData) : ''}
      </div>
      `,
      headerTitle
    );
  }
  /**
   * ===========================================================
   *  Fase 1 INACTIVA  Correo estándar de cortesía
   * ===========================================================
   */
  buildDefaultEmail(processingData) {
    const { formData, pageInfo } = processingData;
    const botonSeminarios = this.createButton(
      'Información sobre Seminarios',
      'https://flacso.edu.uy/formacion/seminarios/',
      '#e67e22',
      '#ffffff'
    );
    return this.wrapHTML(
      `
      <p style="text-align: justify;">${formData.name || 'Estimado/a'}, gracias por tu interés en nuestras propuestas de formación.</p>
      <p style="text-align: justify;">En este momento, las inscripciones para <strong>${pageInfo.posgrado}</strong> no se encuentran abiertas.</p>
      <p style="text-align: justify;">Actualmente contamos con <strong>inscripciones disponibles</strong> para nuestros <strong>seminarios</strong>.</p>
      <p style="text-align: justify;">Podés consultar más información en el siguiente enlace:</p>
      <p style="text-align:center;">${botonSeminarios}</p>
      <p style="text-align: justify;">Cuando se reabra el período de inscripciones, nos pondremos en contacto contigo.</p>
      ${this.getContactBlock(processingData)}
    `,
      'Gracias por su interés'
    );
  }
  buildPhase2Email(processingData, discountInfo) {
    const { formData, pageInfo } = processingData;
    const nombrePrograma = pageInfo.posgrado || 'esta formaci\u00f3n';
    const nombreContacto = this.getFullName(formData);
    const saludoNombre = nombreContacto ? ` ${nombreContacto}` : '';
    const saludoPhase2 = nombreContacto ? `&iexcl;Hola${saludoNombre}!` : '&iexcl;Hola estimada/o!';
    const links =
      typeof processingData.getProgramLinks === 'function'
        ? processingData.getProgramLinks()
        : { base: formData.url_base || null, carta: null, preinscripcion: null };
    const defaultBase = 'https://flacso.edu.uy/formacion';
    const baseLink = links.base || pageInfo.enlaceWordpress || formData.url_base || defaultBase;
    const cartaLink = links.carta || pageInfo.enlaceCarta || `${baseLink}/carta`;
    const preLink = links.preinscripcion || pageInfo.enlacePreinscripcion || `${baseLink}/preinscripcion`;
    const inicioTexto = this.getPhase2StartText(pageInfo);
    const detalleInicio = inicioTexto
      ? `<p style="margin:0 0 12px; line-height:1.55; text-align: justify;">${nombrePrograma} inicia ${inicioTexto} y cuenta con un destacado equipo docente y una propuesta acad&eacute;mica de excelencia. Gracias a nuestra modalidad 100% a distancia, podr&aacute;s realizar todas las actividades acad&eacute;micas desde donde est&eacute;s y organizar la cursada seg&uacute;n tu disponibilidad horaria.</p>`
      : `<p style="margin:0 0 12px; line-height:1.55; text-align: justify;">${nombrePrograma} cuenta con un destacado equipo docente y una propuesta acad&eacute;mica de excelencia. Gracias a nuestra modalidad 100% a distancia, podr&aacute;s realizar todas las actividades acad&eacute;micas desde donde est&eacute;s y organizar la cursada seg&uacute;n tu disponibilidad horaria.</p>`;
    const botonMasInfo = this.createButton(
      'Ver costos, programa y requisitos',
      cartaLink,
      '#16396f',
      '#ffffff'
    );
    const botonConvenios = this.createButton(
      'Ver convenios',
      CONVENIOS_VIGENTES,
      '#fed222',
      '#0f1a2d'
    );
    const botonInscripcion = this.createButton(
      'Formulario de Preinscripci&oacute;n',
      preLink,
      '#27a844',
      '#ffffff'
    );
    const footerHtml = `
      <p style="margin:0 0 6px;">Saludos cordiales,</p>
      <p style="margin:0;"><strong>Equipo FLACSO Uruguay</strong></p>
      <p style="margin:6px 0 0;"><a href="mailto:${EMAIL_CONFIG.REPLY_TO}" style="color:#ffffff;">${EMAIL_CONFIG.REPLY_TO}</a></p>
    `;
    const heroHtml = `
      <h1 style="margin:0; font-size:28px; line-height:1.25; font-weight:700; color:#ffffff;">
        ${this.getPhase2InterestLine(nombrePrograma)}
      </h1>
    `;
    return this.wrapHTMLWithFooter(
      `
      <div style="padding:20px 24px 8px;">
        <p style="margin:0 0 12px; font-size:15px; line-height:1.45; color:#16396f; font-weight:bold;">${saludoPhase2}</p>
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Queremos brindarte m&aacute;s informaci&oacute;n sobre este posgrado para que puedas tomar una decisi&oacute;n informada.</p>
        ${detalleInicio}
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Consulta el calendario acad&eacute;mico, la malla curricular, el plantel docente, los costos y c&oacute;mo postular a la cursada en el siguiente bot&oacute;n:</p>
      </div>
      ${botonMasInfo}
      <div style="padding:18px 24px 8px;">
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">En FLACSO Uruguay nos enorgullece contar con una tasa de egreso superior al 90%, lo que nos posiciona entre las instituciones de referencia en la regi&oacute;n.</p>
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">
          <span style="background:#fff4d6; color:#5b4700; padding:2px 6px; border-radius:4px;">Por tiempo limitado, ofrecemos descuentos especiales.</span>
        </p>
        <p style="margin:12px 0 8px; line-height:1.55; text-align: justify;">Puedes consultar los convenios vigentes y acceder a beneficios adicionales aqu&iacute;:</p>
      </div>
      ${botonConvenios}
      <div style="padding:18px 24px 8px;">
        <p style="margin:0; line-height:1.55; text-align: justify;">Los cupos son limitados. Si tienes dudas, responde este correo y con gusto te asesoraremos.</p>
      </div>
      ${botonInscripcion}
      <div style="padding:18px 24px 20px;">
        <p style="margin:0 0 16px; line-height:1.45; text-align: justify;"><em>* Si ya te inscribiste o est&aacute;s en proceso de postulaci&oacute;n, desestima este mensaje.</em></p>
      </div>
      `,
      `Informaci&oacute;n sobre ${nombrePrograma}`,
      footerHtml,
      heroHtml
    );
  }
  buildPhase2Subject(pageInfo, discountInfo) {
    return this.getPhase2InterestLine(pageInfo.posgrado);
  }
  /* =========================
   *  Envío genérico de email
   * ========================= */
  sendGenericEmail(to, subject, htmlBody, ccOrOptions) {
    const recipient = this.normalizeEmailAddress(to);
    if (!recipient) {
      throw new Error("Failed to send email: no recipient");
    }
    const options = this.normalizeSendOptions(ccOrOptions);
    // Política: no se envía Cc en ningún flujo (consultas ni Fase 2).
    const cc = '';
    const replyTo = options.replyTo || EMAIL_CONFIG.REPLY_TO;
    const fromName = options.fromName || EMAIL_CONFIG.FROM_NAME;
    const programName = options.programName ? String(options.programName).trim() : '';
    const resolvedHtmlBody = this.resolveHtmlBody(htmlBody, options);
    const plain = this.htmlToText(resolvedHtmlBody);
    this.sendSequence += 1;
    const sendNumber = this.sendSequence;
    try {
      const accountUsed = this.mailer.send({
        to: recipient,
        subject,
        plainBody: plain,
        htmlBody: resolvedHtmlBody,
        replyTo,
        fromName,
        cc
      });
      Logger.log(
        `#${sendNumber} | to=${recipient} | via=${accountUsed}` +
        ` | programa=${programName || '-'}`
      );
      return accountUsed;
    } catch (error) {
      if (this.isInvalidRecipientError(error)) {
        Logger.log(`Destinatario invalido, se omite envio: ${error}`);
        throw error;
      }
      if (this.isSenderStopError(error)) {
        Logger.log(`Freno de envio por capacidad/cuentas: ${error}`);
        if (options.useReservedSenderForNoCapacity) {
          const reservedSender = options.reservedSenderEmail || DOPOST_RESERVED_SENDER_EMAIL;
          try {
            const reservedUsed = this.mailer.sendWithReservedAccount(reservedSender, {
              to: recipient,
              subject,
              plainBody: plain,
              htmlBody: resolvedHtmlBody,
              replyTo,
              fromName,
              cc
            });
            Logger.log(`Correo enviado a ${recipient} (cuenta reservada: ${reservedUsed})`);
            Logger.log(
              `#${sendNumber} | to=${recipient} | via=${reservedUsed}` +
              ` | programa=${programName || '-'}`
            );
            return reservedUsed;
          } catch (reservedError) {
            Logger.log(`Fallo en cuenta reservada (${reservedSender}): ${reservedError}`);
          }
        } else {
          throw error;
        }
      }
      Logger.log(`Balanceador fallo, se usa MailApp: ${error}`);
      const mailOptions = {
        to: recipient,
        subject,
        body: plain,
        htmlBody: resolvedHtmlBody,
        replyTo,
        name: fromName
      };
      MailApp.sendEmail(mailOptions);
      Logger.log(`Correo enviado a ${recipient} (fallback MailApp)`);
      Logger.log(
        `#${sendNumber} | to=${recipient} | via=MailApp` +
        ` | programa=${programName || '-'}`
      );
      return "MailApp";
    }
  }
  resolveHtmlBody(htmlBody, options = {}) {
    const directHtml = htmlBody ? String(htmlBody) : '';
    if (directHtml) return directHtml;
    const originalHtml = options.originalHtmlBody ? String(options.originalHtmlBody) : '';
    if (originalHtml) return originalHtml;
    const originalPlain = options.originalPlainBody ? String(options.originalPlainBody) : '';
    if (!originalPlain) return '<div style="font-family:Arial,sans-serif;"></div>';
    const safe = originalPlain
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div style="font-family:Arial,sans-serif; line-height:1.5;">${safe.replace(/\n/g, '<br>')}</div>`;
  }
  normalizeEmailAddress(value) {
    let email = value === null || value === undefined ? "" : String(value).trim().toLowerCase();
    if (!email) return "";
    email = email.replace(/^mailto:/i, "");
    email = email.replace(/\s+/g, "");
    email = email.replace(/^[\"'`<>\(\)\[\]\{\},;:]+/, "");
    email = email.replace(/[\"'`<>\(\)\[\]\{\},;:]+$/, "");
    email = email.replace(/[.!?,;:]+$/, "");
    return email;
  }
  isSenderStopError(error) {
    const msg = error && error.toString ? error.toString() : String(error || "");
    return (
      msg.includes("NO_SENDER_CAPACITY_") ||
      msg.includes("ALL_SENDER_ACCOUNTS_FAILED") ||
      msg.includes("ALL_ACCOUNTS_BLOCKED")
    );
  }
  isInvalidRecipientError(error) {
    const msg = error && error.toString ? error.toString() : String(error || "");
    return (
      msg.includes("INVALID_RECIPIENT_ADDRESS") ||
      msg.toLowerCase().includes("invalid to header")
    );
  }
  /* =========================
   *  Botón compatible con todos los clientes
   * ========================= */
  createButton(text, url, bgColor, textColor) {
    return `
    <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${url}" style="height:52px;v-text-anchor:middle;width:100%;"
        arcsize="6%" stroke="f" fillcolor="${bgColor}">
        <w:anchorlock/>
        <center style="color:${textColor};font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">
          ${text}
        </center>
      </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px; margin:0 auto;">
      <tr>
        <td align="center" style="padding:12px 24px;">
          <a href="${url}" target="_blank"
            style="display:block;width:100%;background-color:${bgColor};color:${textColor};text-decoration:none;
                   font-family:Arial,sans-serif;font-size:17px;font-weight:bold;line-height:1.35;
                   text-align:center;padding:16px 18px;border-radius:6px;box-sizing:border-box;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
    <!--<![endif]-->
    `;
  }
  normalizeSendOptions(ccOrOptions) {
    if (!ccOrOptions) {
      return {
        cc: '',
        replyTo: '',
        fromName: '',
        useReservedSenderForNoCapacity: false,
        reservedSenderEmail: '',
        programName: '',
        originalHtmlBody: '',
        originalPlainBody: ''
      };
    }
    if (typeof ccOrOptions === 'string') {
      return {
        cc: '',
        replyTo: '',
        fromName: '',
        useReservedSenderForNoCapacity: false,
        reservedSenderEmail: '',
        programName: '',
        originalHtmlBody: '',
        originalPlainBody: ''
      };
    }
    if (typeof ccOrOptions === 'object') {
      const cc = '';
      const replyTo = ccOrOptions.replyTo ? String(ccOrOptions.replyTo).trim() : '';
      const fromName = ccOrOptions.fromName ? String(ccOrOptions.fromName).trim() : '';
      const useReservedSenderForNoCapacity = !!ccOrOptions.useReservedSenderForNoCapacity;
      const reservedSenderEmail = ccOrOptions.reservedSenderEmail
        ? String(ccOrOptions.reservedSenderEmail).trim().toLowerCase()
        : '';
      const programName = ccOrOptions.programName ? String(ccOrOptions.programName).trim() : '';
      const originalHtmlBody = ccOrOptions.originalHtmlBody ? String(ccOrOptions.originalHtmlBody) : '';
      const originalPlainBody = ccOrOptions.originalPlainBody ? String(ccOrOptions.originalPlainBody) : '';
      return {
        cc,
        replyTo,
        fromName,
        useReservedSenderForNoCapacity,
        reservedSenderEmail,
        programName,
        originalHtmlBody,
        originalPlainBody
      };
    }
    return {
      cc: '',
      replyTo: '',
      fromName: '',
      useReservedSenderForNoCapacity: false,
      reservedSenderEmail: '',
      programName: '',
      originalHtmlBody: '',
      originalPlainBody: ''
    };
  }
  wrapHTMLWithFooter(content, title, footerHtml, heroHtml = null) {
    return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${title}</title>
      </head>
      <body style="font-family:Arial,sans-serif; background:#f4f7fb; color:#333333; margin:0; padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f4f7fb; border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
          <tr>
            <td align="center" style="padding:20px 8px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                <tr>
                  <td align="center" bgcolor="#16396f" style="background:#16396f; color:#ffffff; padding:20px 24px;">
                    <img src="${EMAIL_CONFIG.LOGO_URL}" width="160" alt="FLACSO" style="display:block; margin:0 auto 10px; width:160px; max-width:160px; height:auto; border:0; outline:none; text-decoration:none;">
                    ${heroHtml || `<h2 style="margin:0; font-size:20px; line-height:1.4; color:#ffffff;">${title}</h2>`}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;">${content}</td>
                </tr>
                ${footerHtml ? `
                <tr>
                  <td align="center" bgcolor="#16396f" style="background:#16396f; color:#ffffff; padding:18px; font-size:14px;">
                    ${footerHtml}
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
  }
  buildPhase2Subject(pageInfo, discountInfo) {
    return this.getPhase2InterestLine(pageInfo.posgrado);
  }
  buildPhase2Subject(pageInfo, discountInfo) {
    return this.getPhase2InterestLine(pageInfo.posgrado);
  }
  /* =========================
   *  HTML wrapper del correo
   * ========================= */
  wrapHTML(content, title = '¡Gracias por tu interés en FLACSO Uruguay!') {
    return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${title}</title>
      </head>
      <body style="font-family:Arial,sans-serif; background:#f4f7fb; color:#333333; margin:0; padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f4f7fb; border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
          <tr>
            <td align="center" style="padding:20px 8px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                <tr>
                  <td align="center" bgcolor="#16396f" style="background:#16396f; color:#ffffff; padding:20px;">
                    <img src="${EMAIL_CONFIG.LOGO_URL}" width="160" alt="FLACSO" style="display:block; margin:0 auto 10px; width:160px; max-width:160px; height:auto; border:0; outline:none; text-decoration:none;">
                    <h2 style="margin:0; font-size:20px; line-height:1.4; color:#ffffff;">${title}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;">${content}</td>
                </tr>
                <tr>
                  <td align="center" bgcolor="#16396f" style="background:#16396f; color:#ffffff; padding:18px; font-size:14px;">
                    <p style="margin:5px 0;">Saludos cordiales,</p>
                    <p style="margin:5px 0;"><strong>Equipo FLACSO Uruguay</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
  }
  htmlToText(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  getDiscountBlock(discountInfo) {
    if (!discountInfo) return '';
    const dias = typeof discountInfo.diasRestantes === 'number'
      ? Math.max(0, discountInfo.diasRestantes)
      : null;
    const diasTexto = dias && dias > 0
      ? `Quedan ${dias} día${dias === 1 ? '' : 's'} para aprovecharlo.`
      : 'Beneficio vigente hasta la fecha indicada.';
    return `
      <div style="
        background:#fff6e5; border-left:4px solid #e6a500;
        padding:12px 16px; margin:20px 0; border-radius:6px;
        font-size:15px; color:#6b4b00;">
        <strong>Descuento de hasta ${discountInfo.porcentaje}%.</strong>
        Vigente hasta el ${discountInfo.fechaLimiteTexto}. ${diasTexto}
      </div>`;
  }
  getPhase2StartText(pageInfo) {
    const raw = pageInfo && pageInfo.proximoInicio ? String(pageInfo.proximoInicio).trim() : '';
    if (!raw) return '';
    if (/^(el|este|esta|pr[oó]ximamente|durante|a partir)/i.test(raw)) return raw;
    return `el ${raw}`;
  }
  getPhase2InterestLine(nombrePrograma) {
    return `¿Aún tienes interés en la ${nombrePrograma} de FLACSO Uruguay?`;
  }
  getPhase3LastCallLine(nombrePrograma) {
    return 'El posgrado que elijas hoy define tu lugar mañana';
  }
  buildPhase3Subject(pageInfo) {
    return this.getPhase3LastCallLine();
  }
  buildPhase3Email(processingData) {
    const { formData, pageInfo } = processingData;
    const nombrePrograma = pageInfo && pageInfo.posgrado ? String(pageInfo.posgrado).trim() : 'posgrado';
    const { art } = this.getDeterminantes(nombrePrograma);
    const programaConArticulo = art ? `${art} <strong>${nombrePrograma}</strong>` : `<strong>${nombrePrograma}</strong>`;
    const nombreContacto = this.getFullName(formData);
    const saludoNombre = nombreContacto ? ` ${nombreContacto}` : '';
    const saludoPhase3 = nombreContacto ? `Hola ${saludoNombre.trim()},` : 'Hola estimada/o,';
    const links =
      typeof processingData.getProgramLinks === 'function'
        ? processingData.getProgramLinks()
        : { base: formData.url_base || null, carta: null, preinscripcion: null };
    const defaultBase = 'https://flacso.edu.uy/formacion';
    const baseLink = links.base || pageInfo.enlaceWordpress || formData.url_base || defaultBase;
    const cartaLink = links.carta || pageInfo.enlaceCarta || `${baseLink}/carta`;
    const botonMasInfo = this.createButton(
      '👉🏻 Ver programa y preinscripción',
      cartaLink,
      '#248138',
      '#ffffff'
    );
    const footerHtml = `
      <p style="margin:0 0 6px;">Saludos,</p>
      <p style="margin:0;"><strong>Equipo FLACSO Uruguay</strong></p>
      <p style="margin:8px 0 6px;">Contacto: <a href="tel:+59824817459" style="color:#ffffff; text-decoration:underline;">+598 2481 7459</a> | WhatsApp: <a href="https://wa.me/59894300822" style="color:#ffffff; text-decoration:underline;">+598 94 300 822</a></p>
      <p style="margin:0;"><a href="mailto:${EMAIL_CONFIG.REPLY_TO}" style="color:#ffffff;">${EMAIL_CONFIG.REPLY_TO}</a></p>
    `;
    const heroHtml = `
      <h1 style="margin:0; font-size:26px; line-height:1.25; font-weight:700; color:#ffffff;">
        ${this.getPhase3LastCallLine(nombrePrograma)}
      </h1>
    `;
    return this.wrapHTMLWithFooter(
      `
      <div style="padding:20px 24px 8px;">
        <p style="margin:0 0 12px; font-size:15px; line-height:1.45; color:#16396f; font-weight:bold;">${saludoPhase3}</p>
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Te escribo porque estamos en los últimos días de inscripciones para ${programaConArticulo} de FLACSO Uruguay.</p>
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Si todavía lo estás considerando, hay cupos disponibles y estamos ofreciendo un <strong>25% de descuento</strong> para esta cohorte.</p>
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Si te interesa, podés ver el programa y preinscribirte acá</p>
      </div>
      ${botonMasInfo}
      <div style="padding:18px 24px 20px;">
        <p style="margin:0 0 12px; line-height:1.55; text-align: justify;">Y si querés, respondé este mail y te ayudo personalmente con la inscripción o cualquier duda.</p>
        <p style="margin:0; line-height:1.45; text-align: justify;"><em>Si ya te inscribiste o estás en proceso de postulación, desestimá este mensaje.</em></p>
      </div>
      `,
      this.getPhase3LastCallLine(),
      footerHtml,
      heroHtml
    );
  }
  buildPhase2Subject(pageInfo, discountInfo) {
    return this.getPhase2InterestLine(pageInfo.posgrado);
  }
  /* =========================
   *  Bloque Tus datos
   * ========================= */
  buildPhase2Subject(pageInfo, discountInfo) {
    return this.getPhase2InterestLine(pageInfo.posgrado);
  }
  getContactBlock(processingData) {
    const { formData, pageInfo } = processingData;
    const links =
      typeof processingData.getProgramLinks === 'function'
        ? processingData.getProgramLinks()
        : { base: formData.url_base || pageInfo?.enlaceWordpress || null };
    const baseLink = links.base || formData.url_base || pageInfo?.enlaceWordpress || null;
    const items = [
      formData.name && `<li><b>Nombre y apellido:</b> ${formData.name}</li>`,
      formData.country && `<li><b>Pa&iacute;s de residencia:</b> ${formData.country}</li>`,
      formData.email && `<li><b>Correo electr&oacute;nico:</b> ${formData.email}</li>`,
      formData.educationLevel && `<li><b>Nivel educativo:</b> ${formData.educationLevel}</li>`,
      formData.profession && `<li><b>Profesi&oacute;n:</b> ${formData.profession}</li>`,
      (formData.date || formData.time) &&
        `<li><b>Fecha/Hora de consulta:</b> ${formData.date || ''} ${formData.time || ''}</li>`,
      baseLink &&
        `<li><b>Link consultado:</b> <a href="${baseLink}" target="_blank" style="color:#16396f;">${baseLink}</a></li>`
    ]
      .filter(Boolean)
      .join('');
    return items
      ? `<h3 style="margin-top:30px;">Tus datos de contacto</h3>
         <ul style="background:#edf2f6; border-radius:8px; padding:15px; list-style:none; margin:0;">${items}</ul>`
      : '';
  }
  getFullName(formData) {
    const parts = [];
    if (formData.first_name) parts.push(formData.first_name);
    if (formData.last_name) parts.push(formData.last_name);
    const combined = parts.join(' ').trim();
    return combined || formData.name || '';
  }
  /* =========================
   *  Artículos y preposiciones
   * ========================= */
  getDeterminantes(nombrePrograma) {
    const s = (nombrePrograma || '').trim().toLowerCase();
    const fem = ['maestría', 'especialización', 'diplomatura'];
    const masc = ['diploma', 'diplomado', 'doctorado'];
    const startsWith = (arr) => arr.some((x) => s.startsWith(x + ' '));
    if (startsWith(fem)) return { art: 'la', prep: 'de la' };
    if (startsWith(masc)) return { art: 'el', prep: 'del' };
    return { art: '', prep: 'de' };
  }
  getCommonCSS() {
    return `
      <style>
        @media only screen and (max-width:480px){
          table[width="600"]{width:100%!important;}
          .mobile-padding {padding:15px !important;}
          h2 {font-size:18px !important;}
          h1 {font-size:24px !important; line-height:1.3 !important;}
          a {font-size:16px !important;}
        }
        .button-container {display: block; width: 100%;}
      </style>`;
  }
}
