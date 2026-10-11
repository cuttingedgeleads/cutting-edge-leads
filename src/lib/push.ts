import webPush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject =
  process.env.VAPID_SUBJECT || "mailto:support@cuttingedgeleads.net";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export async function sendImportPush(recipientId: string, importId: string): Promise<'sent'|'pending'|'unavailable'> {
  if (!vapidPublicKey || !vapidPrivateKey) return 'unavailable';
  const recipient = await prisma.user.findFirst({where:{id:recipientId,role:'ADMIN',pushNotifications:true},include:{pushSubscriptions:true}});
  if (!recipient?.pushSubscriptions.length) return 'unavailable';
  let sent = false, retry = false;
  await Promise.all(recipient.pushSubscriptions.map(async subscription => {
    try {
      await webPush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}}, JSON.stringify({title:'New private import',body:'Open Leads to review your import.',url:`/admin/imports/${importId}`,tag:`studio-import-${importId}`}), {timeout:10000});
      sent = true;
    } catch (error: unknown) {
      const status = (error as {statusCode?:number}).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({where:{id:subscription.id}});
      else retry = true;
    }
  }));
  return sent ? 'sent' : retry ? 'pending' : 'unavailable';
}

export async function sendPushToUserIds(userIds: string[], payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[push] Missing VAPID keys; skipping push send.");
    return;
  }

  if (userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { endpoint: subscription.endpoint },
          });
        } else {
          console.error("[push] Failed to send push notification", error);
        }
      }
    })
  );
}
