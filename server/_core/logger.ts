import pino from "pino";

const isProduction = process.env.NODE_ENV === 'production';

// Configuração do logger
const logger = pino({
  level: isProduction ? 'info' : 'debug', // Nível de log mais verboso em desenvolvimento
  // Em desenvolvimento, usa o pino-pretty para logs mais legíveis
  transport: !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger;
