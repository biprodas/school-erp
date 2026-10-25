import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ChildHome } from "~/features/portal/child-home"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("home") }
}

/** The portal home: the selected child's summary (M8). */
export default function PortalHomePage() {
  return <ChildHome />
}
