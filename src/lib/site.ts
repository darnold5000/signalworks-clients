export const siteConfig = {
  name: "Signal Works",
  productName: "Client Portal",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  marketingUrl: "https://hiresignalworks.com",
  supportEmail: "hello@hiresignalworks.com",
} as const;
