BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ProductionOperation] ADD [checkList] TEXT;

-- CreateTable
CREATE TABLE [dbo].[DefectHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [componentId] INT NOT NULL,
    [operationId] INT,
    [actionType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [description] TEXT,
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [DefectHistory_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [user] NVARCHAR(1000) NOT NULL,
    [supplierResponse] TEXT,
    CONSTRAINT [DefectHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[DefectHistory] ADD CONSTRAINT [DefectHistory_componentId_fkey] FOREIGN KEY ([componentId]) REFERENCES [dbo].[Component]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
