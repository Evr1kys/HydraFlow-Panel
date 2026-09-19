-- HydraFlow Agent API v1 node credentials and observable deployments.
ALTER TABLE "Node"
  ADD COLUMN "agentKeyId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "agentSecretEnc" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "agentCaCert" TEXT,
  ADD COLUMN "agentServerName" TEXT,
  ADD COLUMN "agentApiVersion" TEXT,
  ADD COLUMN "agentVersion" TEXT,
  ADD COLUMN "lastRevision" TEXT,
  ADD COLUMN "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncError" TEXT;

CREATE TABLE "NodeDeployment" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "revision" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "initiatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "NodeDeployment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NodeDeployment_idempotencyKey_key"
  ON "NodeDeployment"("idempotencyKey");
CREATE INDEX "Node_enabled_status_idx" ON "Node"("enabled", "status");
CREATE INDEX "NodeDeployment_nodeId_createdAt_idx"
  ON "NodeDeployment"("nodeId", "createdAt");
CREATE INDEX "NodeDeployment_status_createdAt_idx"
  ON "NodeDeployment"("status", "createdAt");

ALTER TABLE "NodeDeployment"
  ADD CONSTRAINT "NodeDeployment_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
