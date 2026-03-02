import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendPushToUserIds } from "@/lib/push";

export async function POST() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendPushToUserIds([session.user.id], {
    title: "Test Notification",
    body: "If you see this, push notifications are working!",
    url: "/profile",
  });

  return NextResponse.json({ success: true });
}
