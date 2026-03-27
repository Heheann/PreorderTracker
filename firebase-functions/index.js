const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const REGION = "asia-east1";
const HTTP_OPTIONS = { region: REGION, cors: true, invoker: "public" };
const JOB_STATUS = {
  scheduled: "scheduled",
  sent: "sent",
  failed: "failed",
  tokenInvalid: "token_invalid",
};

function assertMethod(req, res, method = "POST") {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return false;
  }
  if (req.method !== method) {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return false;
  }
  return true;
}

function assertSecret(req, res) {
  const apiSecret = process.env.REMINDER_API_SECRET || "";
  if (!apiSecret) return true;
  const incoming = String(req.headers["x-api-secret"] || "");
  if (!incoming || incoming !== apiSecret) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

function toTrimmed(value) {
  return String(value || "").trim();
}

function normalizeJob(raw) {
  const jobId = toTrimmed(raw.jobId);
  const deviceId = toTrimmed(raw.deviceId);
  const itemId = toTrimmed(raw.itemId);
  const eventType = toTrimmed(raw.eventType);
  const triggerAt = toTrimmed(raw.triggerAt);
  const title = toTrimmed(raw.title);
  const body = toTrimmed(raw.body);
  const status = toTrimmed(raw.status) || JOB_STATUS.scheduled;

  if (!jobId || !deviceId || !itemId || !eventType || !triggerAt || !title || !body) return null;

  const triggerDate = new Date(triggerAt);
  if (Number.isNaN(triggerDate.getTime())) return null;

  return {
    jobId,
    deviceId,
    itemId,
    itemTitle: toTrimmed(raw.itemTitle),
    eventType,
    triggerAt: Timestamp.fromDate(triggerDate),
    title,
    body,
    dueDate: toTrimmed(raw.dueDate),
    status,
  };
}

exports.registerDevice = onRequest(HTTP_OPTIONS, async (req, res) => {
  if (!assertMethod(req, res)) return;
  if (!assertSecret(req, res)) return;

  const deviceId = toTrimmed(req.body?.deviceId);
  const fcmToken = toTrimmed(req.body?.fcmToken);
  const platform = toTrimmed(req.body?.platform || "web-pwa");
  const timezone = toTrimmed(req.body?.timezone || "Asia/Taipei");

  if (!deviceId || !fcmToken) {
    res.status(400).json({ ok: false, error: "deviceId and fcmToken are required" });
    return;
  }

  await db.collection("devices").doc(deviceId).set(
    {
      deviceId,
      fcmToken,
      platform,
      timezone,
      status: "active",
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  res.json({ ok: true, deviceId });
});

exports.syncReminderJobs = onRequest(HTTP_OPTIONS, async (req, res) => {
  if (!assertMethod(req, res)) return;
  if (!assertSecret(req, res)) return;

  const deviceId = toTrimmed(req.body?.deviceId);
  const incomingJobs = Array.isArray(req.body?.jobs) ? req.body.jobs : [];

  if (!deviceId) {
    res.status(400).json({ ok: false, error: "deviceId is required" });
    return;
  }

  const normalized = incomingJobs.map(normalizeJob).filter(Boolean);
  const incomingMap = new Map(normalized.map((job) => [job.jobId, job]));

  const existingSnapshot = await db.collection("reminder_jobs").where("deviceId", "==", deviceId).get();
  const existingMap = new Map();
  const batch = db.batch();
  let upserted = 0;
  let removed = 0;

  existingSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    existingMap.set(doc.id, data);
    if (!incomingMap.has(doc.id) && !data.sentAt) {
      batch.delete(doc.ref);
      removed += 1;
    }
  });

  for (const [jobId, job] of incomingMap) {
    const ref = db.collection("reminder_jobs").doc(jobId);
    const existing = existingMap.get(jobId);
    const alreadySent = Boolean(existing?.sentAt);
    batch.set(
      ref,
      {
        ...job,
        sentAt: alreadySent ? existing.sentAt : null,
        status: alreadySent ? existing.status || JOB_STATUS.sent : JOB_STATUS.scheduled,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    upserted += 1;
  }

  await batch.commit();
  res.json({ ok: true, deviceId, upserted, removed });
});

exports.dispatchReminderJobs = onSchedule(
  {
    region: REGION,
    schedule: "every 15 minutes",
    timeZone: "Asia/Taipei",
  },
  async () => {
    const now = Date.now();
    const pendingSnapshot = await db.collection("reminder_jobs").where("sentAt", "==", null).limit(300).get();

    if (pendingSnapshot.empty) {
      logger.info("No pending reminder jobs");
      return;
    }

    const dueDocs = pendingSnapshot.docs.filter((doc) => {
      const data = doc.data() || {};
      if (data.status && data.status !== JOB_STATUS.scheduled) return false;
      const triggerAt = data.triggerAt instanceof Timestamp ? data.triggerAt.toMillis() : 0;
      return triggerAt > 0 && triggerAt <= now;
    });

    if (!dueDocs.length) {
      logger.info("No due reminder jobs");
      return;
    }

    const deviceCache = new Map();
    let sent = 0;
    let failed = 0;

    for (const doc of dueDocs) {
      const job = doc.data();
      const deviceId = toTrimmed(job.deviceId);
      if (!deviceId) {
        await doc.ref.set({ status: JOB_STATUS.failed, error: "missing_device_id", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        failed += 1;
        continue;
      }

      let device = deviceCache.get(deviceId);
      if (!device) {
        const snap = await db.collection("devices").doc(deviceId).get();
        device = snap.exists ? snap.data() : null;
        deviceCache.set(deviceId, device);
      }

      const token = toTrimmed(device?.fcmToken);
      if (!token) {
        await doc.ref.set({ status: JOB_STATUS.tokenInvalid, error: "missing_fcm_token", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        failed += 1;
        continue;
      }

      try {
        await messaging.send({
          token,
          data: {
            title: toTrimmed(job.title),
            body: toTrimmed(job.body),
            itemId: toTrimmed(job.itemId),
            eventType: toTrimmed(job.eventType),
            jobId: doc.id,
          },
          webpush: {
            headers: { Urgency: "high" },
            fcmOptions: {
              link: "/preorder-tracker/index.html",
            },
          },
        });

        await doc.ref.set(
          {
            status: JOB_STATUS.sent,
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        sent += 1;
      } catch (error) {
        const code = String(error?.code || "");
        const tokenInvalid = code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
        await doc.ref.set(
          {
            status: tokenInvalid ? JOB_STATUS.tokenInvalid : JOB_STATUS.failed,
            error: String(error?.message || error),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (tokenInvalid) {
          await db.collection("devices").doc(deviceId).set(
            {
              status: "token_invalid",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        failed += 1;
      }
    }

    logger.info("Reminder dispatch completed", { due: dueDocs.length, sent, failed });
  }
);
