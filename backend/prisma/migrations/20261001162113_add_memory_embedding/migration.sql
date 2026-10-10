/*
  Warnings:

  - You are about to drop the column `sourceMessageId` on the `Memory` table. All the data in the column will be lost.
  - Added the required column `embedding` to the `Memory` table without a default value. This is not possible if the table is not empty.
  - Made the column `mindSpaceId` on table `Memory` required. This step will fail if there are existing NULL values in that column.

*/

-- DropForeignKey
ALTER TABLE "Memory" DROP CONSTRAINT "Memory_sourceMessageId_fkey";

-- AlterTable
ALTER TABLE "Memory" DROP COLUMN "sourceMessageId",
ADD COLUMN     "embedding" vector(1024) NOT NULL,
ADD COLUMN     "messageId" TEXT,
ALTER COLUMN "mindSpaceId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
