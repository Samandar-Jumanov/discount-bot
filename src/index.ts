import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import bot from "@/utils/bot.config"
import prisma from "./database/prisma";


const server = app.listen(env.PORT, async () => {
  const { NODE_ENV, HOST, PORT } = env;
  bot.launch(); 
  await prisma.$connect().then(( res ) => {
          logger.info("Database connected")
  }).catch(( err ) => {
        logger.error("Failed to connect to database", err)
        process.exit(1)  
  })
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const onCloseSignal = () => {
  logger.info("sigint received, shutting down");
  server.close(() => {
    logger.info("server closed");
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); 
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
