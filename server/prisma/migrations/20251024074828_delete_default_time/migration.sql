BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ProductionOperation] DROP CONSTRAINT [ProductionOperation_endTime_df],
[ProductionOperation_startTime_df];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
