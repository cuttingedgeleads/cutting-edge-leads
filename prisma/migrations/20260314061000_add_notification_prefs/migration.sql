-- Add email and push notification preferences
ALTER TABLE "User"
ADD COLUMN "email_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "push_notifications" BOOLEAN NOT NULL DEFAULT true;
