BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[CheckList] DROP CONSTRAINT [CheckList_productMP_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[Component] DROP CONSTRAINT [Component_pnComponentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[Component] DROP CONSTRAINT [Component_snProductId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[Product] DROP CONSTRAINT [Product_specificationProductMP_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[ProductionOperation] DROP CONSTRAINT [ProductionOperation_componentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[ProductionOperation] DROP CONSTRAINT [ProductionOperation_productId_fkey];

-- DropIndex
ALTER TABLE [dbo].[CheckList] DROP CONSTRAINT [CheckList_productMP_key];

-- DropIndex
ALTER TABLE [dbo].[Component] DROP CONSTRAINT [Component_snComponent_key];

-- DropIndex
ALTER TABLE [dbo].[PartNumberComponent] DROP CONSTRAINT [PartNumberComponent_partNumber_key];

-- DropIndex
ALTER TABLE [dbo].[Product] DROP CONSTRAINT [Product_snProduct_key];

-- DropIndex
ALTER TABLE [dbo].[Specification] DROP CONSTRAINT [Specification_productMP_key];

-- DropIndex
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_Login_key];

-- AlterTable
ALTER TABLE [dbo].[CheckList] ALTER COLUMN [productMP] NVARCHAR(1000) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Component] ALTER COLUMN [snComponent] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [pnComponentId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [supplier] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [invoice] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [status] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [comment] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [user] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Component] ALTER COLUMN [snProductId] NVARCHAR(1000) NULL;

-- AlterTable
ALTER TABLE [dbo].[PartNumberComponent] ALTER COLUMN [partNumber] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[PartNumberComponent] ALTER COLUMN [descriptionRU] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[PartNumberComponent] ALTER COLUMN [descriptionEN] NVARCHAR(1000) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Product] ALTER COLUMN [snProduct] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Product] ALTER COLUMN [specificationProductMP] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Product] ALTER COLUMN [comment] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[Product] ALTER COLUMN [orderToProduction] NVARCHAR(1000) NULL;

-- AlterTable
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [stageType] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [status] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [user] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [productSN] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [comment] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [productId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [componentId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ProductionOperation] ALTER COLUMN [usedComponents] NVARCHAR(1000) NULL;

-- AlterTable
ALTER TABLE [dbo].[Specification] ALTER COLUMN [type] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [productName] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [productMP] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [productMM] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard1] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard2] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard3] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard4] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard5] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [electronicBoard6] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [otherCirciutry] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [enclosureType] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [mountingScrew] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Specification] ALTER COLUMN [packingBox] NVARCHAR(1000) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Template] ALTER COLUMN [markingTemplate] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [markingEquipment] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [stendForHiPot] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [stendForTest] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [verificationProtocol] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [RE] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [PS] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Template] ALTER COLUMN [boxLabel] NVARCHAR(1000) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Test] ALTER COLUMN [HiPot] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Test] ALTER COLUMN [checklist] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[Test] ALTER COLUMN [partNumber] NVARCHAR(1000) NULL;

-- AlterTable
ALTER TABLE [dbo].[User] ALTER COLUMN [Login] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[User] ALTER COLUMN [Name] NVARCHAR(1000) NOT NULL;

-- CreateIndex
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_Login_key] UNIQUE NONCLUSTERED ([Login]);

-- CreateIndex
ALTER TABLE [dbo].[Component] ADD CONSTRAINT [Component_snComponent_key] UNIQUE NONCLUSTERED ([snComponent]);

-- CreateIndex
ALTER TABLE [dbo].[PartNumberComponent] ADD CONSTRAINT [PartNumberComponent_partNumber_key] UNIQUE NONCLUSTERED ([partNumber]);

-- CreateIndex
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_snProduct_key] UNIQUE NONCLUSTERED ([snProduct]);

-- CreateIndex
ALTER TABLE [dbo].[Specification] ADD CONSTRAINT [Specification_productMP_key] UNIQUE NONCLUSTERED ([productMP]);

-- CreateIndex
ALTER TABLE [dbo].[CheckList] ADD CONSTRAINT [CheckList_productMP_key] UNIQUE NONCLUSTERED ([productMP]);

-- AddForeignKey
ALTER TABLE [dbo].[Component] ADD CONSTRAINT [Component_pnComponentId_fkey] FOREIGN KEY ([pnComponentId]) REFERENCES [dbo].[PartNumberComponent]([partNumber]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Component] ADD CONSTRAINT [Component_snProductId_fkey] FOREIGN KEY ([snProductId]) REFERENCES [dbo].[Product]([snProduct]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductionOperation] ADD CONSTRAINT [ProductionOperation_componentId_fkey] FOREIGN KEY ([componentId]) REFERENCES [dbo].[Component]([snComponent]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductionOperation] ADD CONSTRAINT [ProductionOperation_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([snProduct]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_specificationProductMP_fkey] FOREIGN KEY ([specificationProductMP]) REFERENCES [dbo].[Specification]([productMP]) ON DELETE NO ACTION ON UPDATE CASCADE;

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
