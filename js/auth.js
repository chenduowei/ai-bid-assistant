/** 认证与会话 */

export function createAuth({ getClient, setState, ui, onSignedIn, onSignedOut, onPasswordRecovery }) {
  async function handleAuth(event, authMode, email, password) {
    event.preventDefault();
    const client = getClient();
    const { data, error } =
      authMode === "signup"
        ? await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await client.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (authMode === "signup" && !data.session) {
      return {
        successMessage: "注册成功，请前往邮箱确认后再登录。",
      };
    }
    return { ok: true };
  }

  function signOut() {
    return getClient().auth.signOut();
  }

  /** 忘记密码：发重置链接（跳转回当前页，由 PASSWORD_RECOVERY 事件接手） */
  async function sendPasswordReset(email) {
    const client = getClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /** 重发注册验证邮件 */
  async function resendVerification(email) {
    const client = getClient();
    const { error } = await client.auth.resend({ type: "signup", email });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /** 在重置流程内设置新密码 */
  async function updatePassword(newPassword) {
    const client = getClient();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  function bindAuthState() {
    const client = getClient();
    client.auth.onAuthStateChange((event, session) => {
      // 密码重置链接回跳：优先显示重置面板，不直接进工作台
      if (event === "PASSWORD_RECOVERY") {
        if (onPasswordRecovery) onPasswordRecovery();
        else ui.showToast("设置新密码。");
        return;
      }
      if (session?.user) onSignedIn(session.user);
      else onSignedOut();
    });
  }

  async function restoreSession() {
    const client = getClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.user) onSignedIn(session.user);
    else onSignedOut();
  }

  return { handleAuth, signOut, bindAuthState, restoreSession, sendPasswordReset, resendVerification, updatePassword };
}
