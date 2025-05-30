/*
  Warnings:

  - You are about to alter the column `comment` on the `ProductionOperation` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `Text`.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[CheckList] ADD [doc_AssebbleOK] NVARCHAR(1000),
[doc_ConstructKD] NVARCHAR(1000),
[doc_Passport] NVARCHAR(1000),
[doc_TemplateEZCAD] NVARCHAR(1000),
[doc_TestOK] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [comment] TEXT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
