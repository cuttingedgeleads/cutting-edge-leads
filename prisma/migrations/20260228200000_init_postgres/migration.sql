-- CreateSchema
CREATE SCHEMA IF NOT EXISTS  public;

-- CreateEnum
CREATE TYPE Role AS ENUM ('ADMIN', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE UnlockStatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE User (
    id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    businessName TEXT NOT NULL DEFAULT '',
    passwordHash TEXT NOT NULL,
    role Role NOT NULL DEFAULT 'CONTRACTOR',
    phone TEXT NOT NULL DEFAULT '',
    serviceCities TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'America/Chicago',
    preferredContactMethod TEXT NOT NULL DEFAULT 'EMAIL',
    notifyNewLeads BOOLEAN NOT NULL DEFAULT true,
    notifyUnlockApproved BOOLEAN NOT NULL DEFAULT true,
    notifyMarketing BOOLEAN NOT NULL DEFAULT false,
    notifySms BOOLEAN NOT NULL DEFAULT false,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT User_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE Lead (
    id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    jobType TEXT NOT NULL,
    description TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    price INTEGER NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT Lead_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE LeadPhoto (
    id TEXT NOT NULL,
    leadId TEXT NOT NULL,
    url TEXT NOT NULL,

    CONSTRAINT LeadPhoto_pkey PRIMARY KEY (id)
);

-- CreateTable
CREATE TABLE LeadUnlockRequest (
    id TEXT NOT NULL,
    leadId TEXT NOT NULL,
    contractorId TEXT NOT NULL,
    status UnlockStatus NOT NULL DEFAULT 'PENDING',
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approvedAt TIMESTAMP(3),

    CONSTRAINT LeadUnlockRequest_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX User_email_key ON User(email);

-- CreateIndex
CREATE UNIQUE INDEX LeadUnlockRequest_leadId_contractorId_key ON LeadUnlockRequest(leadId, contractorId);

-- AddForeignKey
ALTER TABLE LeadPhoto ADD CONSTRAINT LeadPhoto_leadId_fkey FOREIGN KEY (leadId) REFERENCES Lead(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE LeadUnlockRequest ADD CONSTRAINT LeadUnlockRequest_leadId_fkey FOREIGN KEY (leadId) REFERENCES Lead(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE LeadUnlockRequest ADD CONSTRAINT LeadUnlockRequest_contractorId_fkey FOREIGN KEY (contractorId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE;
