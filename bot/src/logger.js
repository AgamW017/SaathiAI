import pino from 'pino';

export function createLogger(config) {
  return pino({
    level: config.env === 'production' ? 'info' : 'debug',
    redact: {
      paths: ['*.body', '*.text', 'message.body', 'incoming.body'],
      remove: true
    },
    transport:
      config.env === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          }
  });
}
