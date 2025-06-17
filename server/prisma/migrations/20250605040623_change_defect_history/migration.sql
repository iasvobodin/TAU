/*
  Warnings:

  - You are about to drop the column `componentId` on the `DefectHistory` table. All the data in the column will be lost.
  - You are about to drop the column `operationId` on the `DefectHistory` table. All the data in the column will be lost.
  - Added the required column `componentSN` to the `DefectHistory` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[DefectHistory] DROP CONSTRAINT [DefectHistory_componentId_fkey];

-- AlterTable
ALTER TABLE [dbo].[DefectHistory] DROP COLUMN [componentId],
[operationId];
ALTER TABLE [dbo].[DefectHistory] ADD [componentSN] NVARCHAR(1000) NOT NULL;

-- AddForeignKey
ALTER TABLE [dbo].[DefectHistory] ADD CONSTRAINT [DefectHistory_componentSN_fkey] FOREIGN KEY ([componentSN]) REFERENCES [dbo].[Component]([snComponent]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
