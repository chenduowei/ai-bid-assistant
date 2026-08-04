/** 认证与会话 */

export function createAuth({ getClient, setState, ui, onSignedIn, onSignedOut }) {
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

  function bindAuthState() {
    const client = getClient();
    client.auth.onAuthStateChange((_event, session) => {
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

  return { handleAuth, signOut, bindAuthState, restoreSession };
}
