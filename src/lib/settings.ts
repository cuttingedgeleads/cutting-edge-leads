import { prisma } from "@/lib/prisma";

const GLOBAL_SETTINGS_ID = "global";

export async function getAppSettings() {
  return prisma.appSetting.upsert({
    where: { id: GLOBAL_SETTINGS_ID },
    create: { id: GLOBAL_SETTINGS_ID },
    update: {},
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
