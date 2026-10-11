import { prisma } from "@/lib/prisma";

const GLOBAL_SETTINGS_ID = "global";

export async function getAppSettings() {
  const existing = await prisma.appSetting.findUnique({
    where: { id: GLOBAL_SETTINGS_ID },
  });
  if (existing) return existing;
  // Empty-update Prisma upserts can race on a cold database. DO NOTHING
  // preserves a concurrently chosen mode and never rewrites a warm row.
  await prisma.appSetting.createMany({
    data: [{ id: GLOBAL_SETTINGS_ID }],
    skipDuplicates: true,
  });
  return prisma.appSetting.findUniqueOrThrow({
    where: { id: GLOBAL_SETTINGS_ID },
  });
}

export async function getTestMode() {
  const settings = await getAppSettings();
  return settings.testMode;
}

export async function setTestMode(testMode: boolean) {
  return prisma.appSetting.upsert({
    where: { id: GLOBAL_SETTINGS_ID },
    create: { id: GLOBAL_SETTINGS_ID, testMode },
    update: { testMode },
  });
}
