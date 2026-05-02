// Archivo principal: solo funciones activadas por el usuario.
function doPost(e) {
  const controller = new WebhookController();
  return controller.handlePost(e);
}
function lanzarFase2() {
  return lanzarFase2Web();
}
function lanzarFase2Web() {
  return lanzarFase2WebMasivo();
}
function lanzarFase2WebMasivo() {
  const sender = new Fase2WebSender();
  return sender.procesarListado();
}
function lanzarFase2WebDiario() {
  const sender = new Fase2WebSender();
  return sender.procesarListado({ exactDays: FASE2_WEB_CONFIG.DIARIO_DIAS_EXACTOS });
}
function enviarFase2_Lista(limit) {
  const SenderClass = getFase2ListSenderClass_();
  const sender = new SenderClass();
  const options = {};
  if (typeof limit === "number" && limit > 0) {
    options.limit = limit;
  }
  return sender.procesarListado(options);
}
function lanzarFase2Listado(limit) {
  return enviarFase2_Lista(limit);
}
function enviarFase2_Diario() {
  return lanzarFase2WebDiario();
}
function lanzarFase3() {
  return lanzarFase3Web();
}
function lanzarFase3Web() {
  return lanzarFase3WebMasivo();
}
function lanzarFase3WebMasivo() {
  const sender = new Fase3WebSender();
  return sender.procesarListado();
}
function lanzarFase3WebDiario() {
  const sender = new Fase3WebSender();
  return sender.procesarListado({ exactDays: FASE3_WEB_CONFIG.TANDA_DIAS_EXACTOS_DEFAULT });
}
function LanzarFase3Diario() {
  return lanzarFase3WebDiario();
}
function lanzarFase3PendientesUltimoMes(limit) {
  const sender = new Fase3WebSender();
  const options = {
    onlyFromFase2LastMonth: true,
    lookbackDays: 30,
  };
  if (typeof limit === "number" && limit > 0) {
    options.limit = limit;
  }
  return sender.procesarListado(options);
}
function LanzarFase3PendientesUltimoMes(limit) {
  return lanzarFase3PendientesUltimoMes(limit);
}
function lanzarFase3WebTanda(exactDays) {
  const sender = new Fase3WebSender();
  const dias = exactDays === null || exactDays === undefined
    ? FASE3_WEB_CONFIG.TANDA_DIAS_EXACTOS_DEFAULT
    : exactDays;
  return sender.procesarListado({ exactDays: dias });
}
function lanzarFase3Listado() {
  return lanzarFase3ListadoAuto();
}

function lanzarFase3ListadoUnaVez(limit) {
  const sender = new Fase3ListSender();
  const n = typeof limit === "number" && limit > 0 ? limit : FASE3_LIST_AUTORUN_CONFIG.BATCH_SIZE;
  return sender.procesarListado({ limit: n });
}

function lanzarFase3ListadoAuto() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log("[Fase3ListadoAuto] Ejecucion en curso. Se omite esta corrida.");
    return { status: "running", skipped: true };
  }
  try {
    const sender = new Fase3ListSender();
    const batchSize = FASE3_LIST_AUTORUN_CONFIG.BATCH_SIZE;
    const delayMs = FASE3_LIST_AUTORUN_CONFIG.REQUEUE_DELAY_MS;
    const pendingBefore = sender.loadListado().items.length;

    if (pendingBefore === 0) {
      clearFase3ListadoAutoTriggers_();
      Logger.log("[Fase3ListadoAuto] Sin pendientes. Proceso finalizado.");
      return { status: "done", pendingBefore: 0, pendingAfter: 0, enviados: 0 };
    }

    let resultado;
    try {
      resultado = sender.procesarListado({ limit: batchSize });
    } catch (error) {
      if (isFase3ListadoSenderStopError_(error)) {
        clearFase3ListadoAutoTriggers_();
        notifyFase3ListadoSenderStop_(error, pendingBefore, batchSize);
        return {
          status: "stopped_sender_capacity",
          pendingBefore,
          enviados: 0,
          error: String(error),
        };
      }
      throw error;
    }

    const pendingAfter = sender.loadListado().items.length;
    const progress = pendingAfter < pendingBefore;
    if (pendingAfter > 0 && progress) {
      scheduleFase3ListadoNextRun_(delayMs);
      Logger.log(
        `[Fase3ListadoAuto] Lote procesado (${resultado.enviados} enviados). Pendientes: ${pendingAfter}. Proxima corrida en ${delayMs} ms.`
      );
      return {
        status: "scheduled",
        pendingBefore,
        pendingAfter,
        enviados: resultado.enviados,
        errores: resultado.errores.length,
        nextRunInMs: delayMs,
      };
    }

    clearFase3ListadoAutoTriggers_();
    if (pendingAfter > 0 && !progress) {
      Logger.log(
        `[Fase3ListadoAuto] Sin progreso en esta corrida. Pendientes: ${pendingAfter}. Se detiene la autoejecucion para evitar loop.`
      );
      return {
        status: "stopped_no_progress",
        pendingBefore,
        pendingAfter,
        enviados: resultado.enviados,
        errores: resultado.errores.length,
      };
    }

    Logger.log("[Fase3ListadoAuto] Envio completado sin pendientes.");
    return {
      status: "done",
      pendingBefore,
      pendingAfter,
      enviados: resultado.enviados,
      errores: resultado.errores.length,
    };
  } finally {
    lock.releaseLock();
  }
}

function scheduleFase3ListadoNextRun_(delayMs) {
  clearFase3ListadoAutoTriggers_();
  ScriptApp.newTrigger("lanzarFase3ListadoAuto")
    .timeBased()
    .after(delayMs)
    .create();
}

function clearFase3ListadoAutoTriggers_() {
  const handler = "lanzarFase3ListadoAuto";
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function detenerFase3ListadoAuto() {
  clearFase3ListadoAutoTriggers_();
  return { status: "stopped" };
}

function isFase3ListadoSenderStopError_(error) {
  const msg = error && error.toString ? error.toString() : String(error || "");
  return (
    msg.includes("NO_SENDER_CAPACITY_") ||
    msg.includes("ALL_SENDER_ACCOUNTS_FAILED") ||
    msg.includes("ALL_ACCOUNTS_BLOCKED")
  );
}

function notifyFase3ListadoSenderStop_(error, pendingBefore, batchSize) {
  const now = new Date().toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  const detail = error && error.toString ? error.toString() : String(error || "Error desconocido");
  const subject = "Fase 3 LISTADO detenida por capacidad de envio";
  const lines = [
    "Fase 3 LISTADO detenida automaticamente.",
    `Fecha: ${now}`,
    `Motivo: ${detail}`,
    `Pendientes estimados al inicio del lote: ${pendingBefore}`,
    `Tamano de lote configurado: ${batchSize}`,
    "Accion tomada: se eliminaron triggers de autoejecucion.",
  ];
  const text = lines.join("\n");
  try {
    TelegramNotifier.getInstance().sendPlainMessage(text);
  } catch (notifyError) {
    Logger.log(`[Fase3ListadoAuto] No se pudo notificar por Telegram: ${notifyError}`);
  }
  try {
    MailApp.sendEmail({
      to: FASE3_SUMMARY_CONFIG.RECIPIENTS.join(","),
      subject,
      body: text,
    });
  } catch (mailError) {
    Logger.log(`[Fase3ListadoAuto] No se pudo enviar correo de alerta: ${mailError}`);
  }
}
function enviarFase3_Tanda(exactDays) {
  return lanzarFase3WebTanda(exactDays);
}
function lanzarFase2Redes() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log("[Fase2RedesAuto] Ejecucion en curso. Se omite esta corrida.");
    return { status: "running", skipped: true };
  }
  try {
    const sender = new Fase2Sender();
    const batchSize = FASE2_REDES_AUTORUN_CONFIG.BATCH_SIZE;
    const delayMs = FASE2_REDES_AUTORUN_CONFIG.REQUEUE_DELAY_MS;
    const pendingBefore = sender.loadListado().items.length;
    if (pendingBefore === 0) {
      clearFase2RedesAutoTriggers_();
      Logger.log("[Fase2RedesAuto] Sin pendientes. Proceso finalizado.");
      return { status: "done", pendingBefore: 0, pendingAfter: 0, enviados: 0 };
    }
    let resultado;
    try {
      resultado = sender.procesarListado({ limit: batchSize });
    } catch (error) {
      if (isFase2RedesSenderStopError_(error)) {
        clearFase2RedesAutoTriggers_();
        notifyFase2RedesSenderStop_(error, pendingBefore, batchSize);
        return {
          status: "stopped_sender_capacity",
          pendingBefore,
          enviados: 0,
          error: String(error),
        };
      }
      throw error;
    }
    const pendingAfter = sender.loadListado().items.length;
    const progress = pendingAfter < pendingBefore;
    if (pendingAfter > 0 && progress) {
      scheduleFase2RedesNextRun_(delayMs);
      Logger.log(
        `[Fase2RedesAuto] Lote procesado (${resultado.enviados} enviados). Pendientes: ${pendingAfter}. Proxima corrida en ${delayMs} ms.`
      );
      return {
        status: "scheduled",
        pendingBefore,
        pendingAfter,
        enviados: resultado.enviados,
        errores: resultado.errores.length,
        nextRunInMs: delayMs,
      };
    }
    clearFase2RedesAutoTriggers_();
    if (pendingAfter > 0 && !progress) {
      Logger.log(
        `[Fase2RedesAuto] Sin progreso en esta corrida. Pendientes: ${pendingAfter}. Se detiene la autoejecucion para evitar loop.`
      );
      return {
        status: "stopped_no_progress",
        pendingBefore,
        pendingAfter,
        enviados: resultado.enviados,
        errores: resultado.errores.length,
      };
    }
    Logger.log("[Fase2RedesAuto] Envio completado sin pendientes.");
    return {
      status: "done",
      pendingBefore,
      pendingAfter,
      enviados: resultado.enviados,
      errores: resultado.errores.length,
    };
  } finally {
    lock.releaseLock();
  }
}
function scheduleFase2RedesNextRun_(delayMs) {
  clearFase2RedesAutoTriggers_();
  ScriptApp.newTrigger("lanzarFase2Redes")
    .timeBased()
    .after(delayMs)
    .create();
}
function clearFase2RedesAutoTriggers_() {
  const handler = "lanzarFase2Redes";
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
function detenerFase2RedesAuto() {
  clearFase2RedesAutoTriggers_();
  return { status: "stopped" };
}
function isFase2RedesSenderStopError_(error) {
  const msg = error && error.toString ? error.toString() : String(error || "");
  return (
    msg.includes("NO_SENDER_CAPACITY_") ||
    msg.includes("ALL_SENDER_ACCOUNTS_FAILED") ||
    msg.includes("ALL_ACCOUNTS_BLOCKED")
  );
}
function notifyFase2RedesSenderStop_(error, pendingBefore, batchSize) {
  const now = new Date().toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  const detail = error && error.toString ? error.toString() : String(error || "Error desconocido");
  const subject = "Fase 2 REDES detenida por capacidad de envio";
  const lines = [
    "Fase 2 REDES detenida automaticamente.",
    `Fecha: ${now}`,
    `Motivo: ${detail}`,
    `Pendientes estimados al inicio del lote: ${pendingBefore}`,
    `Tamano de lote configurado: ${batchSize}`,
    "Accion tomada: se eliminaron triggers de autoejecucion.",
  ];
  const text = lines.join("\n");
  try {
    TelegramNotifier.getInstance().sendPlainMessage(text);
  } catch (notifyError) {
    Logger.log(`[Fase2RedesAuto] No se pudo notificar por Telegram: ${notifyError}`);
  }
  try {
    MailApp.sendEmail({
      to: FASE2_SUMMARY_CONFIG.RECIPIENTS.join(","),
      subject,
      body: text,
    });
  } catch (mailError) {
    Logger.log(`[Fase2RedesAuto] No se pudo enviar correo de alerta: ${mailError}`);
  }
}
function lanzarFase2RedesUnaVez(limit) {
  const sender = new Fase2Sender();
  const n = typeof limit === "number" && limit > 0 ? limit : FASE2_REDES_AUTORUN_CONFIG.BATCH_SIZE;
  return sender.procesarListado({ limit: n });
}
// Prueba local del flujo del webhook
function testFormProcessor() {
  const ahora = new Date();
  const mock = {
    id_pagina: '12330',
    titulo_posgrado: 'Maestria en Educacion, Innovacion y Tecnologias',
    nombre: 'Lucia',
    apellido: 'Fernandez',
    pais: 'Uruguay',
    nivel_academico: 'Titulo universitario',
    correo: 'ivan.arriola.t@gmail.com',
    profesion: 'Docente de secundaria',
    url_base: 'https://flacso.edu.uy/formacion/maestrias/maestria-educacion-innovacion-tecnologias/',
    fecha_envio: ahora.toISOString()
  };
  const e = { postData: { contents: JSON.stringify(mock) } };
  const out = doPost(e);
  Logger.log('Resultado test (nuevo esquema): ' + out.getContent());
  return out;
}
// Prueba rapida: no envia correos, solo devuelve previews del primer N (default 3)
function testFase2(limit) {
  return testFase2Web(limit);
}
function testFase2Web(limit) {
  return testFase2WebMasivo(limit);
}
function testFase2WebMasivo(limit) {
  const sender = new Fase2WebSender();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, limit: n });
}
function testFase2WebDiario(limit) {
  const sender = new Fase2WebSender();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({
    dryRun: true,
    limit: n,
    exactDays: FASE2_WEB_CONFIG.DIARIO_DIAS_EXACTOS
  });
}
function testFase2Redes(limit) {
  const sender = new Fase2Sender();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, limit: n });
}
function testFase2Listado(limit) {
  const SenderClass = getFase2ListSenderClass_();
  const sender = new SenderClass();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, limit: n });
}
function testFase3Web(limit) {
  const sender = new Fase3WebSender();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, limit: n });
}
function testFase3Listado(limit) {
  const sender = new Fase3ListSender();
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, limit: n });
}
function testFase3WebTanda(exactDays, limit) {
  const sender = new Fase3WebSender();
  const dias = exactDays === null || exactDays === undefined
    ? FASE3_WEB_CONFIG.TANDA_DIAS_EXACTOS_DEFAULT
    : exactDays;
  const n = typeof limit === "number" && limit > 0 ? limit : 3;
  return sender.procesarListado({ dryRun: true, exactDays: dias, limit: n });
}
function testFase3PendientesUltimoMes(limit, lookbackDays) {
  const sender = new Fase3WebSender();
  const options = {
    dryRun: true,
    onlyFromFase2LastMonth: true,
    lookbackDays: typeof lookbackDays === "number" && lookbackDays > 0 ? lookbackDays : 30,
  };
  if (typeof limit === "number" && limit > 0) {
    options.limit = limit;
  }
  return sender.procesarListado(options);
}
function getRandomPhase2TestPostId() {
  const postIds = [
    12330,
    12336,
    12343,
    12310,
    12316,
    12278,
    14444,
    12282,
    12288,
    13202,
    12295,
    12299,
    20668,
    12302,
    14657
  ];
  const index = Math.floor(Math.random() * postIds.length);
  return postIds[index];
}
function getRandomPhaseTestPerson() {
  const firstNames = [
    "Ana",
    "Diego",
    "Lucia",
    "Martin",
    "Camila",
    "Santiago",
    "Valentina",
    "Nicolas"
  ];
  const lastNames = [
    "Perez",
    "Rodriguez",
    "Gonzalez",
    "Fernandez",
    "Silva",
    "Martinez",
    "Lopez",
    "Mendez"
  ];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return { firstName, lastName };
}
// Envio de prueba unico: no marca la hoja ni recorre el listado.
// Uso: testFase2Single(<Post_ID>, "web@flacso.edu.uy")
function testFase2Single(postId, email) {
  const destinatario = (email || "ivan.arriola.t@gmail.com").toString().trim();
  if (!destinatario) {
    throw new Error("testFase2Single requiere un correo destino");
  }
  const sender = new Fase2Sender();
  const item = { postId: postId || getRandomPhase2TestPostId(), firstName: '', lastName: '', email: destinatario };
  const processingData = sender.createProcessingData(item, sender.preloadPageInfo([item]));
  sender.emailManager.sendPhase2Email(processingData, sender.discountInfo);
  return {
    to: destinatario,
    postId: item.postId,
    subject: sender.emailManager.buildPhase2Subject(processingData.pageInfo, sender.discountInfo),
    programa: processingData.pageInfo.posgrado,
  };
}
// Envio de prueba a multiples destinatarios, sin marcar hoja.
// Uso: testFase2Dual(<Post_ID opcional>, ["a@b.com","c@d.com"])
function testFase2Dual(postId, emails) {
  const sender = new Fase2Sender();
  const destinatarios = (emails && emails.length ? emails : [
    "ivan.arriola.t@gmail.com",
    "francolaviano@gmail.com"
  ]).map(e => String(e || "").trim()).filter(Boolean);
  if (!destinatarios.length) throw new Error("Debes indicar al menos un destinatario");
  const baseItem = { postId: postId || getRandomPhase2TestPostId(), firstName: '', lastName: '' };
  const results = [];
  destinatarios.forEach(dest => {
    const item = { ...baseItem, email: dest };
    const processingData = sender.createProcessingData(item, sender.preloadPageInfo([item]));
    sender.emailManager.sendPhase2Email(processingData, sender.discountInfo);
    results.push({
      to: dest,
      postId: item.postId,
      subject: sender.emailManager.buildPhase2Subject(processingData.pageInfo, sender.discountInfo),
      programa: processingData.pageInfo.posgrado,
    });
  });
  return results;
}
// Envio de prueba a multiples destinatarios para Fase 3, sin marcar hoja.
// Uso: testFase3Dual(<Post_ID opcional>, ["a@b.com","c@d.com"])
function testFase3Dual(postId, emails) {
  const sender = new Fase3WebSender();
  const destinatarios = (emails && emails.length ? emails : [
    "ivan.arriola.t@gmail.com",
    "francolaviano@gmail.com"
  ]).map(e => String(e || "").trim()).filter(Boolean);
  if (!destinatarios.length) throw new Error("Debes indicar al menos un destinatario");
  const person = getRandomPhaseTestPerson();
  const baseItem = {
    postId: postId || getRandomPhase2TestPostId(),
    firstName: person.firstName,
    lastName: person.lastName
  };
  const items = destinatarios.map((email) => ({ ...baseItem, email }));
  const pageInfoCache = sender.preloadPageInfo(items);
  const results = [];
  items.forEach((item) => {
    const processingData = sender.createProcessingData(item, pageInfoCache);
    const cuenta = sender.emailManager.sendPhase3Email(processingData);
    results.push({
      to: item.email,
      sentByAccount: cuenta,
      postId: item.postId,
      subject: sender.emailManager.buildPhase3Subject(processingData.pageInfo),
      programa: processingData.pageInfo.posgrado,
    });
  });
  return results;
}
// Envio de prueba listo para ejecutar desde la interfaz de Apps Script.
// Usa un Post_ID aleatorio de la lista de pruebas y los destinatarios solicitados.
function testFase2PruebaCorreos() {
  return testFase2Dual(getRandomPhase2TestPostId(), [
    "comunicaciones@flacso.edu.uy",
    "web@flacso.edu.uy",
    "ivan.arriola.t@gmail.com",
    "francolaviano@gmail.com"
  ]);
}
// Envio de prueba Fase 3 a los mismos destinatarios usados en Fase 2.
// Uso: lanzarFase3PruebaCorreos(<Post_ID opcional>)
function lanzarFase3PruebaCorreos(postId) {
  return testFase3Dual(postId || getRandomPhase2TestPostId(), [
    "comunicaciones@flacso.edu.uy",
    "web@flacso.edu.uy",
    "ivan.arriola.t@gmail.com",
    "francolaviano@gmail.com"
  ]);
}
// Envío de prueba para equipo de Comunicación.
// Envía correo normal de producción a todos los destinatarios listados.
// Uso: testFase2ComunicacionEquipo(<Post_ID opcional>)
function testFase2ComunicacionEquipo(postId) {
  const destinatarios = [
    "comunicaciones@flacso.edu.uy",
    "lfontela@flacso.edu.uy",
    "comunica@flacso.edu.uy",
    "ggomez@flacso.edu.uy"
  ];
  const sender = new Fase2Sender();
  const basePostId = postId || getRandomPhase2TestPostId();
  const items = destinatarios.map((email) => ({
    postId: basePostId,
    firstName: '',
    lastName: '',
    email
  }));
  const pageInfoCache = sender.preloadPageInfo(items);
  const results = [];
  items.forEach((item) => {
    const processingData = sender.createProcessingData(item, pageInfoCache);
    const cuenta = sender.emailManager.sendPhase2Email(processingData, sender.discountInfo);
    results.push({
      to: item.email,
      sentByAccount: cuenta,
      postId: item.postId,
      subject: sender.emailManager.buildPhase2Subject(processingData.pageInfo, sender.discountInfo),
      programa: processingData.pageInfo.posgrado
    });
  });
  return results;
}
