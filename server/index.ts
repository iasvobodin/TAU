import { buildApp } from './app';
import type { AppOptions } from './app';
import componentRoutes from './routes/component';
import barcodeRoutes from './routes/generateBar';
import operationRoutes from './routes/operation';
import operatorRoutes from './routes/operator';
import productRoutes from './routes/product';
import productionOperationRoutes from './routes/productionOperation';
import specificationRoutes from './routes/specification';
import templateRoutes from './routes/template';
import testRoutes from './routes/test';
import partNumberComponentRoutes from './routes/partNumberComponent';
const options: AppOptions = {
  logger: true,
};

const app = await buildApp(options);

barcodeRoutes(app)
componentRoutes(app)
operationRoutes(app)
operatorRoutes(app)
productRoutes(app)
productionOperationRoutes(app)
specificationRoutes(app)
templateRoutes(app)
testRoutes(app)
partNumberComponentRoutes(app)

const startServer = async (port: number | undefined) => {

  // получение PID для корректного заверщения работы сервера из приложения
  app.get('/pid', async (request, reply) => {
    try {
      const pid = process.pid;
      reply.send({ pid });
    } catch (error) {
      reply.code(500).send({ error: 'Error fetching PID' });
    }
  });


  try {
    await app.listen(
      {
        port: port,
        host: 'localhost',
      }
    );
    await Bun.write(Bun.stdout, `{"PORT":${port},"PID":${process.pid}}`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use, trying next port...`);
      startServer(port! + 1);
    } else {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  }
};

startServer(3000);
