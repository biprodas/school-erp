'use client';

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

// UUID pattern (matches standard UUID format)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map parent segments to readable labels for ID segments
const ID_LABEL_MAP: Record<string, string> = {
  applications: "Application Details",
  candidates: "Candidate Details",
  jobs: "Job Details",
  users: "User Details",
  interviews: "Interview Details",
};

export const SiteBreadcrumb = () => {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  const formatSegment = (segment: string, index: number) => {
    // Check if segment is a UUID
    if (UUID_PATTERN.test(segment)) {
      // Get the parent segment to determine context
      const parentSegment = index > 0 ? pathSegments[index - 1] : null;
      // Return context-aware label or fallback
      return parentSegment ? (ID_LABEL_MAP[parentSegment] || "Details") : "Details";
    }
    // Format regular segments
    return segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathSegments.map((segment, index) => {
          const href = "/" + pathSegments.slice(0, index + 1).join("/");
          const isLast = index === pathSegments.length - 1;
          const displayText = formatSegment(segment, index);

          return (
            <React.Fragment key={href}>
              <BreadcrumbItem>
                {!isLast ? (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{displayText}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{displayText}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

