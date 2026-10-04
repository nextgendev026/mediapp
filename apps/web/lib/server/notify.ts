import { mutate, newId, type AppNotification } from './store';
import { str } from './security';

export type NotificationType = AppNotification['type'];

export async function notify(input: {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  href?: string;
}): Promise<void> {
  const notification: AppNotification = {
    id: newId(),
    userId: input.userId,
    title: str(input.title, 140),
    body: str(input.body, 400),
    type: input.type,
    href: input.href,
    read: false,
    createdAt: new Date().toISOString()
  };
  await mutate((db) => {
    if (!db.users.some((u) => u.id === input.userId)) return;
    db.notifications.push(notification);
    if (db.notifications.length > 2000) db.notifications.splice(0, db.notifications.length - 2000);
  });
}
