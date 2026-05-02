import prisma from '../../lib/prisma';

export async function handleFormSubmission(payload: any) {
  const now = new Date().toISOString();
  const formData = payload && payload.formData ? payload.formData : null;
  const pageInfo = payload && payload.pageInfo ? payload.pageInfo : null;
  const onlyEmail = !!payload.onlyEmail;

  if (!formData) {
    return {
      success: false,
      error: 'Missing formData in request body',
      timestamp: now,
    };
  }

  const email = (formData.email || formData.email_address || formData.emailAddress || '').toString().trim();
  if (!email && !onlyEmail) {
    return {
      success: false,
      error: 'Missing recipient email in formData',
      timestamp: now,
    };
  }

  console.log('[FormSubmission SERVER] Received submission for:', email || '<no-email>');

  try {
    // Store in database
    const submission = await prisma.submission.create({
      data: {
        postId: formData.postId ? String(formData.postId) : null,
        postTitle: formData.postTitle || null,
        firstName: formData.first_name || null,
        lastName: formData.last_name || null,
        name: formData.name || null,
        email: email,
        country: formData.country || null,
        educationLevel: formData.educationLevel || null,
        profession: formData.profession || null,
        urlBase: formData.url_base || null,
        meta: formData.meta ? JSON.stringify(formData.meta) : null,
      },
    });

    console.log('[FormSubmission SERVER] Saved to DB with ID:', submission.id);

    return {
      success: true,
      mode: onlyEmail ? 'email_only' : 'full',
      message: onlyEmail ? 'Correo enviado y registro guardado' : 'Registro guardado exitosamente en base de datos',
      submissionId: submission.id,
      timestamp: now,
    };
  } catch (error: any) {
    console.error('[FormSubmission SERVER] Database error:', error);
    return {
      success: false,
      error: 'Error saving to database',
      details: error.message,
      timestamp: now,
    };
  }
}
