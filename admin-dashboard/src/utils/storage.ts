// JWT token storage utilities

const TOKEN_KEY = 'logistics_auth_token';
const USER_KEY = 'logistics_auth_user';

export const storage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),

  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),

  removeToken: (): void => localStorage.removeItem(TOKEN_KEY),

  getUser: (): any | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser: (user: any): void => localStorage.setItem(USER_KEY, JSON.stringify(user)),

  removeUser: (): void => localStorage.removeItem(USER_KEY),

  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
