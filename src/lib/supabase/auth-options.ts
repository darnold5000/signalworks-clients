/** PKCE — auth codes in the query string work on mobile; hash tokens often do not. */
export const supabaseAuthClientOptions = {
  auth: {
    flowType: "pkce" as const,
    detectSessionInUrl: true,
  },
};
