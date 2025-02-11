"use client";

import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
} from "lucide-react";
import { ComponentProps } from "react";

import { NavMain } from "~/components/nav-main";
import { NavProjects } from "~/components/nav-projects";
import { NavUser } from "~/components/nav-user";
import { TeamSwitcher } from "~/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "~/components/ui/sidebar";

// This is sample data.
const data = {
  user: {
    name: "Biprodas Roy",
    email: "biprodas.cse@gmail.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Student & Academic",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Finance & Administration",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Campus & Facility Management",
      logo: Command,
      plan: "Free",
    },
    {
      name: "Communication & Engagement",
      logo: Command,
      plan: "Free",
    },
    {
      name: "Technology & Learning",
      logo: Command,
      plan: "Free",
    },
    {
      name: "Security & Reports",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Student Management",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Admission & Enrollment",
          url: "#",
        },
        {
          title: "Student Profile",
          url: "#",
        },
        {
          title: "Manage Students",
          url: "#",
        },
        {
          title: "ID Card Generation",
          url: "#",
        },
        {
          title: "Health Records",
          url: "#",
        },
      ],
    },
    {
      title: "Class & Section",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Attendance & Leave",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Attendance Tracking",
          url: "#",
        },
        {
          title: "Leave Requests",
          url: "#",
        },
        {
          title: "Automated Notifications",
          url: "#",
        },
      ],
    },
    {
      title: "Academics & Exams",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Timetable & Scheduling",
          url: "#",
        },
        {
          title: "Assignments & Homework",
          url: "#",
        },
        {
          title: "Examination & Grading",
          url: "#",
        },
        {
          title: "Student Progress Reports",
          url: "#",
        },
        {
          title: "Performance Analytics",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
