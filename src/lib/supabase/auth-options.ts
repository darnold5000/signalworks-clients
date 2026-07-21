/** PKCE for SSR — used on server and middleware (not detectSessionInUrl). */
export const supabaseServerAuthOptions = {
  auth: {
    flowType: "pkce" as const,
  },
};

/** Browser client — parses auth codes / hash from invite links. */
export const supabaseBrowserAuthOptions = {
  auth: {
    flowType: "pkce" as const,
    detectSessionInUrl: true,
  },
};
