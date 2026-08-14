import {
  completeTelegramLoginIfPresent,
  fetchTelegramSession,
  isTelegramAuthConfigured,
  logoutTelegramSession,
  recheckTelegramMembership,
  startTelegramLogin
} from "../shared/telegram-auth.js";

async function refreshMembership({ runtime, showMessage }) {
  runtime.telegramSession = await recheckTelegramMembership(runtime.config);
  const joined = Boolean(runtime.telegramSession?.membership?.isMember);
  showMessage(
    joined ? "Telegram membership confirmed." : "Telegram membership was not found yet. Use Recheck after Telegram finishes updating.",
    joined ? "success" : "error"
  );
  return joined;
}

export const telegramProvider = {
  id: "telegram",
  title: "Telegram",
  sessionKey: "telegramSession",
  connectingKey: "isConnectingTelegram",
  configKeys: ["telegramAuth"],
  requirementLabel: "One required",
  footerLink: { label: "Telegram", hrefKey: "telegram", defaultHref: "https://t.me/liberdusofficial" },
  links: [
    { label: "Join", hrefKey: "telegram", defaultHref: "https://t.me/liberdusofficial" }
  ],
  isConfigured: isTelegramAuthConfigured,
  isReady(session) {
    return Boolean(session?.profile?.id);
  },
  getAuthButtonText({ connecting }) {
    return connecting ? "Opening..." : "Sign in";
  },
  async start({ runtime, showMessage }) {
    runtime.telegramSession = await startTelegramLogin(runtime.config);
    showMessage("Telegram account connected.", "success");
    return { staysOnPage: true };
  },
  async recheck({ runtime, showMessage }) {
    await refreshMembership({ runtime, showMessage });
    return { staysOnPage: true };
  },
  onLinkClick({ runtime, syncUi, showMessage }) {
    if (!runtime.telegramSession?.profile?.id) return;

    window.addEventListener("focus", async () => {
      if (runtime.isConnectingTelegram) return;
      runtime.isConnectingTelegram = true;
      syncUi();
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        await refreshMembership({ runtime, showMessage });
      } catch (error) {
        showMessage(error?.message || "Unable to recheck Telegram membership.", "error");
      } finally {
        runtime.isConnectingTelegram = false;
        syncUi();
      }
    }, { once: true });
  },
  async disconnect({ runtime }) {
    await logoutTelegramSession(runtime.config);
  },
  complete: completeTelegramLoginIfPresent,
  fetchSession: fetchTelegramSession,
  getSuccessMessage() {
    return "Telegram account connected.";
  }
};
