import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.database();

interface Order {
  tableNumber: number;
  type: "order" | "waiter_call";
  items?: { name: string; price: number; quantity: number }[];
  total?: number;
  timestamp: number;
}

interface WaiterAssignment {
  waiterName: string;
  tables: number[];
}

interface FCMTokenData {
  token: string;
  updatedAt: number;
  platform: string;
}

/**
 * Cloud Function that triggers when a new order is created.
 * Sends push notifications to all waiters assigned to the table.
 */
export const sendOrderNotification = functions
  .region("europe-west1")
  .database.ref("/orders/{orderId}")
  .onCreate(async (snapshot, context) => {
    const order = snapshot.val() as Order;
    const orderId = context.params.orderId;

    console.log("New order created:", orderId, order);

    if (!order || !order.tableNumber) {
      console.log("Invalid order data, skipping notification");
      return null;
    }

    try {
      // Get all waiter assignments
      const assignmentsSnapshot = await db.ref("waiterAssignments").once("value");
      const assignments = assignmentsSnapshot.val() as Record<string, WaiterAssignment> | null;

      if (!assignments) {
        console.log("No waiter assignments found");
        return null;
      }

      // Find waiters assigned to this table
      const assignedWaiters: string[] = [];
      for (const [waiterName, assignment] of Object.entries(assignments)) {
        if (assignment.tables && assignment.tables.includes(order.tableNumber)) {
          assignedWaiters.push(waiterName);
        }
      }

      if (assignedWaiters.length === 0) {
        console.log("No waiters assigned to table", order.tableNumber);
        return null;
      }

      console.log("Assigned waiters for table", order.tableNumber, ":", assignedWaiters);

      // Get FCM tokens for assigned waiters
      const tokens: string[] = [];
      for (const waiterName of assignedWaiters) {
        const tokenSnapshot = await db.ref(`fcmTokens/${waiterName}`).once("value");
        const tokenData = tokenSnapshot.val() as FCMTokenData | null;
        if (tokenData && tokenData.token) {
          tokens.push(tokenData.token);
        }
      }

      if (tokens.length === 0) {
        console.log("No FCM tokens found for assigned waiters");
        return null;
      }

      console.log("Sending push notification to", tokens.length, "devices");

      // Build notification message
      let title: string;
      let body: string;

      if (order.type === "waiter_call") {
        title = `🙋 Tisch ${order.tableNumber} ruft!`;
        body = "Kellner wird gerufen - Tippe zum Öffnen";
      } else {
        const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        title = `🍺 Neue Bestellung Tisch ${order.tableNumber}`;
        body = `${itemCount} Artikel - ${order.total?.toFixed(2) || "0.00"} €`;
      }

      // Send push notification via FCM
      const message: admin.messaging.MulticastMessage = {
        tokens: tokens,
        notification: {
          title: title,
          body: body,
        },
        data: {
          orderId: orderId,
          tableNumber: order.tableNumber.toString(),
          type: order.type,
          timestamp: order.timestamp.toString(),
          adminCode: process.env.ADMIN_CODE || "V26K",
        },
        android: {
          priority: "high",
          notification: {
            channelId: "orders",
            priority: "max",
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [500, 200, 500, 200, 500, 200, 500],
            defaultSound: true,
            sound: "default",
          },
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            icon: "/icons/waiters.png",
            badge: "/icons/waiters.png",
            vibrate: [500, 200, 500, 200, 500, 200, 500],
            requireInteraction: true,
            renotify: true,
            tag: `order-${orderId}`,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log(
        "Push notification sent:",
        response.successCount,
        "successful,",
        response.failureCount,
        "failed"
      );

      // Log any failures
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error("Failed to send to token", idx, ":", resp.error);
          }
        });
      }

      return { success: true, sent: response.successCount };
    } catch (error) {
      console.error("Error sending push notification:", error);
      return { success: false, error: String(error) };
    }
  });

/**
 * Cleanup function to remove invalid FCM tokens
 */
export const cleanupInvalidTokens = functions
  .region("europe-west1")
  .pubsub.schedule("every 24 hours")
  .onRun(async () => {
    console.log("Running FCM token cleanup");

    try {
      const tokensSnapshot = await db.ref("fcmTokens").once("value");
      const tokens = tokensSnapshot.val() as Record<string, FCMTokenData> | null;

      if (!tokens) {
        console.log("No tokens to clean up");
        return null;
      }

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const updates: Record<string, null> = {};

      for (const [waiterName, tokenData] of Object.entries(tokens)) {
        // Remove tokens older than 24 hours that haven't been refreshed
        if (tokenData.updatedAt < oneDayAgo) {
          console.log("Removing stale token for:", waiterName);
          updates[waiterName] = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.ref("fcmTokens").update(updates);
        console.log("Removed", Object.keys(updates).length, "stale tokens");
      }

      return { cleaned: Object.keys(updates).length };
    } catch (error) {
      console.error("Error cleaning up tokens:", error);
      return { error: String(error) };
    }
  });
