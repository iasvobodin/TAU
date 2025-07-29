import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

async function main() {
  const checkListData = [
    { doc_ConstructKD: "19.5389.202.00 СБ", productMP: "MP1501X1-BB1" },
    { doc_ConstructKD: "19.5389.201.00 СБ", productMP: "MP1501X1-BC3" },
    { doc_ConstructKD: "19.5389.102.00 СБ", productMP: "MP2003X1-BB1" },
    { doc_ConstructKD: "19.5389.103.00 СБ", productMP: "MP2005X1-BA1" },
    { doc_ConstructKD: "19.5389.101.00 СБ", productMP: "MP2201X1-BA1" },
    { doc_ConstructKD: "19.5389.502.00 СБ", productMP: "MP3003X1-EA1" },
    { doc_ConstructKD: "19.5389.305.00 СБ", productMP: "MP3201X1-BA1" },
    { doc_ConstructKD: "19.5389.514.00 СБ", productMP: "MP3201X1-EA1" },
    { doc_ConstructKD: "19.5389.306.00 СБ", productMP: "MP3202X1-BA1" },
    { doc_ConstructKD: "19.5389.308.00 СБ", productMP: "MP3203X1-BA1" },
    { doc_ConstructKD: "19.5389.307.00 СБ", productMP: "MP3204X1-BA1" },
    { doc_ConstructKD: "19.5389.304.00 СБ", productMP: "MP3221X1-BA1" },
    { doc_ConstructKD: "19.5389.513.00 СБ", productMP: "MP3221X1-EA1" },
    { doc_ConstructKD: "19.5389.303.00 СБ", productMP: "MP3222X1-BA1" },
    { doc_ConstructKD: "19.5389.512.00 СБ", productMP: "MP3222X1-EA1" },
    { doc_ConstructKD: "19.5389.309.00 СБ", productMP: "MP3223X1-BA1" },
    { doc_ConstructKD: "19.5389.515.00 СБ", productMP: "MP3223X1-EA1" },
    { doc_ConstructKD: "19.5389.301.00 СБ", productMP: "MP3241X1-BA1" },
    { doc_ConstructKD: "19.5389.510.00 СБ", productMP: "MP3241X1-EA1" },
    { doc_ConstructKD: "19.5389.302.00 СБ", productMP: "MP3242X1-BA1" },
    { doc_ConstructKD: "19.5389.503.00 СБ", productMP: "MP3242X1-EA1" },
    { doc_ConstructKD: "19.5389.511.00 СБ", productMP: "MP3242X1-FA1" },
    { doc_ConstructKD: "19.5389.403.00 СБ", productMP: "MP4001X1-BA3" },
    { doc_ConstructKD: "19.5389.404.00 СБ", productMP: "MP4001X1-BE1" },
    { doc_ConstructKD: "19.5389.505.00 СБ", productMP: "MP4001X1-CA1" },
    { doc_ConstructKD: "19.5389.506.00 СБ", productMP: "MP4001X1-CC1" },
    { doc_ConstructKD: "19.5389.504.00 СБ", productMP: "MP4001X1-CJ1" },
    { doc_ConstructKD: "19.5389.401.00 СБ", productMP: "MP4001X1-NA1" },
    { doc_ConstructKD: "19.5389.402.00 СБ", productMP: "MP4001X1-NB1" },
    { doc_ConstructKD: "19.5389.501.00 СБ", productMP: "MS2201X1-HA1" },
    { doc_ConstructKD: "19.5389.509.00 СБ", productMP: "MS2201X1-JA1" },
    { doc_ConstructKD: "19.5389.405.00 СБ", productMP: "MS4010X1-BN1" },
  ];

  for (const data of checkListData) {
    try {
      await prisma.checkList.update({
        where: { productMP: data.productMP },
        data: {
          doc_ConstructKD: data.doc_ConstructKD,
        },
      });
      console.log(`Updated CheckList for productMP: ${data.productMP}`);
    } catch (error) {
      console.warn(
        `No CheckList found for productMP: ${data.productMP}, skipping update.`
      );
    }
  }

  console.log("Update completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error updating database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
