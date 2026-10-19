import { SITE } from "~/config/site";
import { KampasyMark } from "../brand/kampasy-mark";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KampasyMark className={light ? "size-7" : "size-8"} />
      <span className={`text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        {SITE.name}
      </span>
    </span>
  );
}
