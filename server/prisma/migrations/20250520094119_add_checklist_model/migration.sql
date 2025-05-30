BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[CheckList] (
    [id] INT NOT NULL IDENTITY(1,1),
    [checkListTemplate] VARCHAR(255) NOT NULL,
    [productMP] VARCHAR(255) NOT NULL,
    CONSTRAINT [CheckList_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CheckList_productMP_key] UNIQUE NONCLUSTERED ([productMP])
);

-- AddForeignKey
ALTER TABLE [dbo].[CheckList] ADD CONSTRAINT [CheckList_productMP_fkey] FOREIGN KEY ([productMP]) REFERENCES [dbo].[Specification]([productMP]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
