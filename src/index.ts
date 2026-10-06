import { bootstrap } from './app/bootstrap.js';
import { createLogger } from './utils/logger.js';
import { disconnectMongo } from './database/mongo/index.js';

const logger = createLogger('Bot');

/**
 * Main application entry point.
 * Delegates lifecycle orchestration to app/bootstrap và xử lý graceful shutdown trên Railway.
 */
bootstrap()
  .then((client) => {
    let isShuttingDown = false;

    const handleShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Nhận tín hiệu ${signal}. Đang đóng ứng dụng an toàn (graceful shutdown)...`);
      try {
        if (client.database) {
          try {
            client.database.close();
            logger.info('✓ Đã đóng kết nối SQLite database.');
          } catch (e) {
            logger.warn('Lỗi khi đóng SQLite DB: ' + (e as Error).message);
          }
        }
        await disconnectMongo();
        client.destroy();
        logger.info('✓ Quá trình shutdown hoàn tất.');
        process.exit(0);
      } catch (err) {
        logger.error('Lỗi trong quá trình shutdown:', { err });
        process.exit(1);
      }
    };

    process.once('SIGTERM', () => void handleShutdown('SIGTERM'));
    process.once('SIGINT', () => void handleShutdown('SIGINT'));
  })
  .catch((error) => {
    logger.fatal('Fatal error starting bot:', { error });
    process.exit(1);
  });
