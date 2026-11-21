import { SettingsWorkspace } from "@/components/settings/settings-workspace";

import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  path: "/settings",
  title: "Settings — AI Gateway",
  description: "Configure BYOK AI Provider credentials and test endpoints",
  noIndex: true,
});

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
