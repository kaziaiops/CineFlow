-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "scriptText" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'unset',
    "sceneNumber" INTEGER NOT NULL DEFAULT 1,
    "durationMs" INTEGER NOT NULL DEFAULT 4000,
    "posePrompt" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL DEFAULT '',
    "imageNegativePrompt" TEXT NOT NULL DEFAULT '',
    "motionPromptPos" TEXT NOT NULL DEFAULT '',
    "motionPromptNeg" TEXT NOT NULL DEFAULT '',
    "promptInputs" TEXT NOT NULL DEFAULT '{}',
    "caption" TEXT NOT NULL DEFAULT '',
    "capcutDraftId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Shot" ("capcutDraftId", "caption", "createdAt", "durationMs", "id", "imagePrompt", "index", "kind", "motionPromptNeg", "motionPromptPos", "notes", "posePrompt", "projectId", "promptInputs", "sceneNumber", "scriptText", "status", "updatedAt") SELECT "capcutDraftId", "caption", "createdAt", "durationMs", "id", "imagePrompt", "index", "kind", "motionPromptNeg", "motionPromptPos", "notes", "posePrompt", "projectId", "promptInputs", "sceneNumber", "scriptText", "status", "updatedAt" FROM "Shot";
DROP TABLE "Shot";
ALTER TABLE "new_Shot" RENAME TO "Shot";
CREATE INDEX "Shot_projectId_idx" ON "Shot"("projectId");
CREATE UNIQUE INDEX "Shot_projectId_index_key" ON "Shot"("projectId", "index");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
