import prisma from '../../lib/prisma';

export async function handleWebhook(payload: any) {
  const receivedAt = new Date().toISOString();
  console.log('[Webhook SERVER] Received webhook at', receivedAt);

  const eventType = payload && (payload.event || payload.type || payload.action) ? (payload.event || payload.type || payload.action) : 'unknown';
  
  try {
    const event = await prisma.webhookEvent.create({
      data: {
        eventType: String(eventType),
        payload: JSON.stringify(payload || {}),
      },
    });

    console.log(`[Webhook SERVER] Saved event ${eventType} to DB with ID: ${event.id}`);

    return {
      success: true,
      event: eventType,
      eventId: event.id,
      message: 'Webhook processed and stored',
      timestamp: receivedAt,
    };
  } catch (error: any) {
    console.error('[Webhook SERVER] Database error:', error);
    return {
      success: false,
      error: 'Error saving webhook to database',
      details: error.message,
      timestamp: receivedAt,
    };
  }
}
