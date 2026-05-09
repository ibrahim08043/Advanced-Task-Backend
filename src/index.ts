import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachWebSocket } from "./lib/websocket";

const port = Number(process.env.PORT) || 3000;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const server = createServer(app);

attachWebSocket(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});