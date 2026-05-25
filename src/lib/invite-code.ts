const INVITE_CODE_STORAGE_KEY = "forgingpathways.inviteCode";

export const sanitizeInviteCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export const readStoredInviteCode = () => {
  if (typeof window === "undefined") return "";
  return sanitizeInviteCode(window.localStorage.getItem(INVITE_CODE_STORAGE_KEY) ?? "");
};

export const writeStoredInviteCode = (value: string) => {
  if (typeof window === "undefined") return;
  const next = sanitizeInviteCode(value);
  if (next) {
    window.localStorage.setItem(INVITE_CODE_STORAGE_KEY, next);
    return;
  }
  window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
};

export const clearStoredInviteCode = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
};