import { inngest } from '../modules/notification/inngest.client';
import { getInngestServices } from './services';

export const sendEmail = inngest.createFunction(
  {
    id: 'send-email',
    retries: 3,
    triggers: [{ event: 'notification/send-email' }],
  },
  async ({ event }) => {
    const { notifications, logger } = getInngestServices();
    const { notificationLogId } = event.data as { notificationLogId: string };

    logger.event('info', 'inngest.function.send-email.started', 'Inngest send-email function started', {
      notificationLogId,
    });

    await notifications.processEmailNotification(notificationLogId);

    logger.event('info', 'inngest.function.send-email.completed', 'Inngest send-email function completed', {
      notificationLogId,
    });

    return { notificationLogId };
  },
);

export const enqueueReminders = inngest.createFunction(
  {
    id: 'enqueue-reminders',
    triggers: [{ cron: '0 */6 * * *' }],
  },
  async ({ step }) => {
    const { notifications, logger } = getInngestServices();

    return await step.run('enqueue-due-reminders', async () => {
      logger.event('info', 'inngest.function.enqueue-reminders.started', 'Inngest enqueue-reminders function started');

      const result = await notifications.enqueueDueReminders();

      logger.event('info', 'inngest.function.enqueue-reminders.completed', 'Inngest enqueue-reminders function completed', result);

      return result;
    });
  },
);
