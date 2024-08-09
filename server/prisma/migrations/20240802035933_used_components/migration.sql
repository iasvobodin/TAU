/*
  Warnings:

  - You are about to drop the column `components` on the `ProductionOperation` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ProductionOperation] DROP COLUMN [components];
ALTER TABLE [dbo].[ProductionOperation] ADD [usedComponents] VARCHAR(255);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
