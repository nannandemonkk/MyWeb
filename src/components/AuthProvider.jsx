import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchSession, loginRequest, logoutRequest } from "../api";
import { AuthContext } from "../contexts/AuthContext";

const AUTH_SYNC_KEY = "myweb.auth.changed";
const INITIAL_SESSION = { user: null, csrfToken: null, configured: null, loading: true, error: null, expired: false };

function checkedSession(data) {
  if (!data || typeof data.configured !== "boolean" ||
      !(data.user === null || (data.user && typeof data.user.username === "string")) ||
      !(data.csrfToken === null || typeof data.csrfToken === "string") ||
      (data.user && !data.csrfToken)) {
    throw new ApiError("会话数据格式有误，请稍后重试。", 200);
  }
  return { user: data.user, csrfToken: data.csrfToken, configured: data.configured };
}

function announceSessionChange() {
  try {
    // This is only a cross-tab notification. Credentials/tokens never enter browser storage.
    localStorage.setItem(AUTH_SYNC_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Focus/visibility checks still work when localStorage is unavailable.
  }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(INITIAL_SESSION);
  const requestSequence = useRef(0);

  const refreshSession = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const next = checkedSession(await fetchSession());
      if (sequence === requestSequence.current) {
        setSession((previous) => ({ ...next, loading: false, error: null, expired: !next.user && Boolean(previous.user || previous.expired) }));
      }
      return next;
    } catch (error) {
      if (sequence === requestSequence.current) setSession((previous) => ({ ...previous, ...(error.status === 401 ? { user: null, csrfToken: null, expired: true } : {}), loading: false, error }));
      throw error;
    }
  }, []);

  const expireSession = useCallback(() => {
    ++requestSequence.current;
    setSession((previous) => ({ ...previous, user: null, csrfToken: null, loading: false, expired: true, error: null }));
  }, []);

  const login = useCallback(async (username, password) => {
    ++requestSequence.current;
    await loginRequest(username, password, { csrfToken: session.csrfToken });
    // The session endpoint is authoritative: do not assume a successful POST established a session.
    const next = await refreshSession();
    if (!next.user) throw new ApiError("登录状态未能确认，请检查浏览器是否允许本站 Cookie 后重试。", 401);
    announceSessionChange();
    return next;
  }, [refreshSession, session.csrfToken]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest(session.csrfToken);
      expireSession();
      announceSessionChange();
    } catch (error) {
      if (error.status === 401) expireSession();
      throw error;
    }
  }, [expireSession, session.csrfToken]);

  useEffect(() => {
    const check = () => { refreshSession().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    const onStorage = (event) => { if (event.key === AUTH_SYNC_KEY) check(); };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshSession]);

  const value = useMemo(() => ({ ...session, refreshSession, expireSession, login, logout }), [session, refreshSession, expireSession, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
