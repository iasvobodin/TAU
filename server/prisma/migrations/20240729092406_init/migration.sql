BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Component] (
    [id] INT NOT NULL IDENTITY(1,1),
    [snComponent] VARCHAR(255) NOT NULL,
    [pnComponentId] VARCHAR(255) NOT NULL,
    [supplier] VARCHAR(255) NOT NULL,
    [invoice] VARCHAR(255) NOT NULL,
    [status] VARCHAR(255) NOT NULL,
    [comment] VARCHAR(255) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Component_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [user] VARCHAR(255) NOT NULL,
    [snProductId] VARCHAR(255),
    CONSTRAINT [Component_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Component_snComponent_key] UNIQUE NONCLUSTERED ([snComponent])
);

-- CreateTable
CREATE TABLE [dbo].[PartNumberComponent] (
    [id] INT NOT NULL IDENTITY(1,1),
    [partNumber] VARCHAR(255) NOT NULL,
    [descriptionRU] VARCHAR(255) NOT NULL,
    [descriptionEN] VARCHAR(255) NOT NULL,
    CONSTRAINT [PartNumberComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PartNumberComponent_partNumber_key] UNIQUE NONCLUSTERED ([partNumber])
);

-- CreateTable
CREATE TABLE [dbo].[ProductionOperation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [stageType] VARCHAR(255) NOT NULL,
    [date] DATETIME2 NOT NULL CONSTRAINT [ProductionOperation_date_df] DEFAULT CURRENT_TIMESTAMP,
    [status] VARCHAR(255) NOT NULL,
    [user] VARCHAR(255) NOT NULL,
    [productSN] VARCHAR(255),
    [comment] VARCHAR(255),
    [productId] VARCHAR(255),
    [componentId] VARCHAR(255),
    CONSTRAINT [ProductionOperation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] INT NOT NULL IDENTITY(1,1),
    [snProduct] VARCHAR(255) NOT NULL,
    [specificationProductMP] VARCHAR(255) NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Product_snProduct_key] UNIQUE NONCLUSTERED ([snProduct])
);

-- CreateTable
CREATE TABLE [dbo].[Specification] (
    [id] INT NOT NULL IDENTITY(1,1),
    [version] INT NOT NULL,
    [type] VARCHAR(255),
    [productName] VARCHAR(255) NOT NULL,
    [productMP] VARCHAR(255) NOT NULL,
    [productMM] VARCHAR(255) NOT NULL,
    [electronicBoard1] VARCHAR(255) NOT NULL,
    [electronicBoard2] VARCHAR(255) NOT NULL,
    [electronicBoard3] VARCHAR(255) NOT NULL,
    [electronicBoard4] VARCHAR(255) NOT NULL,
    [electronicBoard5] VARCHAR(255) NOT NULL,
    [electronicBoard6] VARCHAR(255) NOT NULL,
    [otherCirciutry] VARCHAR(255) NOT NULL,
    [enclosureType] VARCHAR(255) NOT NULL,
    [mountingScrew] VARCHAR(255) NOT NULL,
    [packingBox] VARCHAR(255) NOT NULL,
    [operationId] INT NOT NULL CONSTRAINT [Specification_operationId_df] DEFAULT 1,
    [templateId] INT NOT NULL CONSTRAINT [Specification_templateId_df] DEFAULT 1,
    [testId] INT NOT NULL CONSTRAINT [Specification_testId_df] DEFAULT 1,
    CONSTRAINT [Specification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Specification_productMP_key] UNIQUE NONCLUSTERED ([productMP])
);

-- CreateTable
CREATE TABLE [dbo].[Operation] (
    [id] INT NOT NULL IDENTITY(1,1),
    [version] INT NOT NULL,
    [issue] BIT NOT NULL,
    [preProdaction] BIT NOT NULL,
    [assembly] BIT NOT NULL,
    [marking] BIT NOT NULL,
    [functionalTest] BIT NOT NULL,
    [verification] BIT NOT NULL,
    [package] BIT NOT NULL,
    CONSTRAINT [Operation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Template] (
    [id] INT NOT NULL IDENTITY(1,1),
    [version] INT NOT NULL,
    [markingTemplate] VARCHAR(255) NOT NULL,
    [markingEquipment] VARCHAR(255) NOT NULL,
    [stendForHiPot] VARCHAR(255) NOT NULL,
    [stendForTest] VARCHAR(255) NOT NULL,
    [verificationProtocol] VARCHAR(255) NOT NULL,
    [RE] VARCHAR(255) NOT NULL,
    [PS] VARCHAR(255) NOT NULL,
    [boxLabel] VARCHAR(255) NOT NULL,
    CONSTRAINT [Template_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Test] (
    [id] INT NOT NULL IDENTITY(1,1),
    [version] INT NOT NULL,
    [HiPot] VARCHAR(255) NOT NULL,
    CONSTRAINT [Test_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Component] ADD CONSTRAINT [Component_pnComponentId_fkey] FOREIGN KEY ([pnComponentId]) REFERENCES [dbo].[PartNumberComponent]([partNumber]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Component] ADD CONSTRAINT [Component_snProductId_fkey] FOREIGN KEY ([snProductId]) REFERENCES [dbo].[Product]([snProduct]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductionOperation] ADD CONSTRAINT [ProductionOperation_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([snProduct]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductionOperation] ADD CONSTRAINT [ProductionOperation_componentId_fkey] FOREIGN KEY ([componentId]) REFERENCES [dbo].[Component]([snComponent]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_specificationProductMP_fkey] FOREIGN KEY ([specificationProductMP]) REFERENCES [dbo].[Specification]([productMP]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Specification] ADD CONSTRAINT [Specification_operationId_fkey] FOREIGN KEY ([operationId]) REFERENCES [dbo].[Operation]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Specification] ADD CONSTRAINT [Specification_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[Template]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Specification] ADD CONSTRAINT [Specification_testId_fkey] FOREIGN KEY ([testId]) REFERENCES [dbo].[Test]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
