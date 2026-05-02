// =============================================================
// Email Composers (Strategy + Factory)
// - Estrategias para construir asunto y cuerpo del email
// =============================================================
class EmailComposerFactory {
  static forProcessingData(processingData, emailManager) {
    if (processingData?.pageInfo?.fase1Activa) {
      return new Phase1EmailComposer(emailManager);
    }
    return new DefaultEmailComposer(emailManager);
  }
  static forPhase2(emailManager, discountInfo) {
    return new Phase2EmailComposer(emailManager, discountInfo);
  }
}
class BaseEmailComposer {
  constructor(emailManager) {
    this.emailManager = emailManager;
  }
  compose(processingData) {
    throw new Error("Composer no implementado");
  }
}
class Phase1EmailComposer extends BaseEmailComposer {
  compose(processingData) {
    const { pageInfo, formData } = processingData;
    const htmlBody = this.emailManager.buildPhase1Email(processingData);
    const subject = `📌 ${pageInfo.posgrado} – ${formData.first_name || formData.name}, información detallada`;
    return { subject, htmlBody };
  }
}
class DefaultEmailComposer extends BaseEmailComposer {
  compose(processingData) {
    const { formData, pageInfo } = processingData;
    const htmlBody = this.emailManager.buildDefaultEmail(processingData);
    const subject = `📌 ${formData.first_name || formData.name}, gracias por tu interés en FLACSO Uruguay`;
    return { subject, htmlBody };
  }
}
class Phase2EmailComposer extends BaseEmailComposer {
  constructor(emailManager, discountInfo) {
    super(emailManager);
    this.discountInfo = discountInfo || null;
  }
  compose(processingData) {
    const { pageInfo, formData } = processingData;
    const htmlBody = this.emailManager.buildPhase2Email(processingData, this.discountInfo);
    const subject = this.emailManager.buildPhase2Subject(pageInfo, this.discountInfo);
    return { subject, htmlBody };
  }
}
