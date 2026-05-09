import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "node:http";
import { logger } from "./logger";

export type NotificationType = "message" | "alert" | "info" | "success" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

const MAX_HISTORY = 50;

const clients = new Set<WebSocket>();
const notificationHistory: Notification[] = [];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createNotification(
  type: NotificationType,
  title: string,
  body: string
): Notification {
  const notification: Notification = {
    id: generateId(),
    type,
    title,
    body,
    timestamp: new Date().toISOString(),
    read: false,
  };

  notificationHistory.unshift(notification);
  if (notificationHistory.length > MAX_HISTORY) {
    notificationHistory.pop();
  }

  broadcast(notification);
  return notification;
}

export function getNotificationHistory(): Notification[] {
  return notificationHistory;
}

export function getConnectedClients(): number {
  return clients.size;
}

function broadcast(notification: Notification): void {
  const message = JSON.stringify({ event: "notification", data: notification });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
  logger.info({ type: notification.type, clients: clients.size }, "Broadcasted notification");
}

const AUTO_NOTIFICATIONS: { type: NotificationType; title: string; body: string }[] = [
  { type: "message", title: "New Message", body: "Alice sent you a message: Hey, got a minute?" },
  { type: "alert", title: "System Alert", body: "High memory usage detected on server node-02" },
  { type: "info", title: "Deployment Complete", body: "Version 2.4.1 was deployed successfully" },
  { type: "success", title: "Payment Received", body: "Invoice #1042 has been paid ($250.00)" },
  { type: "warning", title: "SSL Expiry Soon", body: "Certificate for api.example.com expires in 7 days" },
  { type: "message", title: "Team Update", body: "Bob completed the sprint review task" },
  { type: "info", title: "New Sign-up", body: "A new user just registered: carol@example.com" },
  { type: "alert", title: "Failed Login Attempt", body: "3 failed login attempts from IP 192.168.1.55" },
  { type: "success", title: "Backup Completed", body: "Daily database backup completed (1.2 GB)" },
  { type: "warning", title: "Disk Space Low", body: "Storage is at 87% capacity on /dev/sda1" },
];

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    clients.add(ws);
    logger.info({ total: clients.size }, "WebSocket client connected");

    const welcome: Notification = {
      id: generateId(),
      type: "info",
      title: "Connected",
      body: "You are now connected to the live notification stream",
      timestamp: new Date().toISOString(),
      read: false,
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "notification", data: welcome }));
    }

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { event: string; id?: string };
        if (msg.event === "mark_read" && msg.id) {
          const n = notificationHistory.find((n) => n.id === msg.id);
          if (n) n.read = true;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      logger.info({ total: clients.size }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket client error");
      clients.delete(ws);
    });
  });

  // Auto-broadcast random notifications every 6–10 seconds
  function scheduleNext() {
    const delay = 6000 + Math.random() * 4000;
    setTimeout(() => {
      if (clients.size > 0) {
        const pick = AUTO_NOTIFICATIONS[Math.floor(Math.random() * AUTO_NOTIFICATIONS.length)];
        createNotification(pick.type, pick.title, pick.body);
      }
      scheduleNext();
    }, delay);
  }
  scheduleNext();

  logger.info("WebSocket server attached on /ws");
  return wss;
}
