import { Router, type IRouter } from "express";
import {
  TriggerNotificationBody,
  ListNotificationsResponse,
  GetNotificationStatsResponse,
} from "../../lib/api-zod/src/generated/api";
import {
  createNotification,
  getNotificationHistory,
  getConnectedClients,
} from "../lib/websocket";

const router: IRouter = Router();

router.get("/notifications", (_req, res): void => {
  const history = getNotificationHistory();
  res.json(ListNotificationsResponse.parse(history));
});

router.post("/notifications/trigger", (req, res): void => {
  const parsed = TriggerNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, title, body } = parsed.data;
  const notification = createNotification(type, title, body);
  res.status(201).json(notification);
});

router.get("/notifications/stats", (_req, res): void => {
  const history = getNotificationHistory();
  const unread = history.filter((n) => !n.read).length;
  const byType: Record<string, number> = {};
  for (const n of history) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }
  res.json(
    GetNotificationStatsResponse.parse({
      total: history.length,
      unread,
      byType,
      connectedClients: getConnectedClients(),
    })
  );
});

export default router;
