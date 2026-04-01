const TOKEN_KEY   = 'alfred_auth_token';
const USER_ID_KEY = 'alfred_auth_user_id';

export const getToken    = (): string | null => localStorage.getItem(TOKEN_KEY);
export const saveToken   = (t: string)       => localStorage.setItem(TOKEN_KEY, t);
export const clearToken  = ()                => localStorage.removeItem(TOKEN_KEY);

export const getUserId   = (): number        => Number(localStorage.getItem(USER_ID_KEY) ?? 1);
export const saveUserId  = (id: number)      => localStorage.setItem(USER_ID_KEY, String(id));

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_ID_KEY);
}
