import { Hono } from "hono";

import {
  BeneficiaryShare,
  DEFAULT_SLEEP_SECONDS,
  SocialMediaAccount,
  will_entry,
} from "./contants";
import {
  PartialWillPayload,
  WillRequestPayload,
  mutateWill,
  overwriteWill,
} from "./tools/will_executor";
import { formatError } from "./tools/base";

export function createApi(): Hono {
  const app = new Hono();

  app.get("/", (c) => c.json({ message: "App is running" }));
  app.get("/health", (c) => c.json({ status: "healthy", service: "agent-api" }));
  app.get("/will", (c) => c.json(will_entry));

  app.post("/will", async (c) => {
    try {
      const payload = await c.req.json<WillRequestPayload>();
      const now = new Date().toISOString();
      overwriteWill({
        ...payload,
        sleepSeconds: payload.sleepSeconds ?? DEFAULT_SLEEP_SECONDS,
        createdAtISO: now,
        updatedAtISO: now,
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.patch("/will", async (c) => {
    try {
      const payload = await c.req.json<PartialWillPayload>();
      mutateWill((entry) => {
        if (payload.willText !== undefined) entry.willText = payload.willText;
        if (payload.executor !== undefined) entry.executor = payload.executor;
        if (payload.beneficiaries !== undefined) entry.beneficiaries = payload.beneficiaries;
        if (payload.socialMediaAccounts !== undefined) entry.socialMediaAccounts = payload.socialMediaAccounts;
        if (payload.sleepSeconds !== undefined) entry.sleepSeconds = payload.sleepSeconds;
        if (payload.targetAmountYocto !== undefined) entry.targetAmountYocto = payload.targetAmountYocto;
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.post("/will/beneficiaries", async (c) => {
    try {
      const payload = await c.req.json<BeneficiaryShare>();
      mutateWill((entry) => {
        const idx = entry.beneficiaries.findIndex((b) => b.accountId === payload.accountId);
        if (idx >= 0) {
          entry.beneficiaries[idx] = payload;
        } else {
          entry.beneficiaries.push(payload);
        }
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.patch("/will/beneficiaries/:accountId", async (c) => {
    try {
      const accountId = c.req.param("accountId");
      const payload = await c.req.json<Partial<BeneficiaryShare>>();
      mutateWill((entry) => {
        const idx = entry.beneficiaries.findIndex((b) => b.accountId === accountId);
        if (idx < 0) throw new Error(`Beneficiary ${accountId} not found`);
        entry.beneficiaries[idx] = { ...entry.beneficiaries[idx], ...payload, accountId };
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.delete("/will/beneficiaries/:accountId", (c) => {
    try {
      const accountId = c.req.param("accountId");
      mutateWill((entry) => {
        entry.beneficiaries = entry.beneficiaries.filter((b) => b.accountId !== accountId);
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.post("/will/socials", async (c) => {
    try {
      const payload = await c.req.json<SocialMediaAccount>();
      mutateWill((entry) => {
        const idx = entry.socialMediaAccounts.findIndex(
          (acc) => acc.platform === payload.platform && acc.username === payload.username,
        );
        if (idx >= 0) {
          entry.socialMediaAccounts[idx] = payload;
        } else {
          entry.socialMediaAccounts.push(payload);
        }
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  app.patch("/will/socials/:platform/:username", async (c) => {
    try {
      const platform = c.req.param("platform") as SocialMediaAccount["platform"];
      const username = c.req.param("username");
      const payload = await c.req.json<Partial<SocialMediaAccount>>();
      mutateWill((entry) => {
        const idx = entry.socialMediaAccounts.findIndex(
          (acc) => acc.platform === platform && acc.username === username,
        );
        if (idx < 0) throw new Error(`Social account ${platform}:${username} not found`);
        entry.socialMediaAccounts[idx] = { ...entry.socialMediaAccounts[idx], ...payload };
      });
      return c.json(will_entry);
    } catch (error) {
      return c.json(formatError(error), 400);
    }
  });

  return app;
}