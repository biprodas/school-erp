import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isPlatformHost, resolveTenantSlug } from "~/lib/tenant";
import PlatformLandingView from "./_components/platform-landing-view";
import TenantLandingView from "~/features/landing";
import { getPublicTenant } from "~/features/landing/api";

export default async function HomePage() {
  const host = (await headers()).get("host");

  if (isPlatformHost(host)) {
    return <PlatformLandingView />;
  }

  const slug = await resolveTenantSlug(host);
  if (!slug) notFound();

  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  return <TenantLandingView tenant={tenant} />;
}
