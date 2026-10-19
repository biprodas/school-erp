import { Toaster } from "~/components/ui/toast"

export default function DesignSystemLayout({ children }: LayoutProps<"/design-system">) {
  return <Toaster>{children}</Toaster>
}
