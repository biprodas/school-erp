"use client"

import type { CSSProperties } from "react"
import {
  BookOpenIcon,
  CalendarCheckIcon,
  FileTextIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "~/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command"
import { Kbd, KbdGroup } from "~/components/ui/kbd"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "~/components/ui/menubar"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "~/components/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "~/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

const MODULES = [
  {
    title: "Attendance",
    description: "Mark a section in under a minute and alert guardians.",
    icon: CalendarCheckIcon,
  },
  {
    title: "Exams and results",
    description: "Marks entry, grade points and printable report cards.",
    icon: GraduationCapIcon,
  },
  {
    title: "Fees",
    description: "Invoices, mobile payments, receipts and dues.",
    icon: ReceiptTextIcon,
  },
  {
    title: "Notices",
    description: "Class or school-wide notices for staff and guardians.",
    icon: MegaphoneIcon,
  },
]

const SIDEBAR_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboardIcon },
  { label: "Students", icon: UsersIcon, badge: "1,284", active: true },
  { label: "Attendance", icon: CalendarCheckIcon, badge: "3" },
  { label: "Fees", icon: ReceiptTextIcon },
  { label: "Exams", icon: GraduationCapIcon },
]

export function Navigation() {
  return (
    <ShowcaseSection
      id="navigation"
      title="Navigation"
      description="How staff move between modules, pages and records. Keep labels short and plain."
    >
      <BlockGrid>
        <Block
          name="Breadcrumb"
          when="Shows where a page sits, from a module down to one record. Collapse the middle when the trail is long."
        >
          <Example title="Typical">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">Students</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">
                    Class 7 · Section B
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Ayesha Rahman</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Example>
          <Example title="Collapsed · truncated">
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">Exams</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="block max-w-48 truncate sm:max-w-72">
                    Half-yearly examination 2026 · Mathematics · Section B
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Example>
        </Block>

        <Block
          name="Tabs"
          when="Switches between views of the same thing, such as one class's attendance, results and fees."
        >
          <Example title="Default" frameClassName="block">
            <Tabs defaultValue="attendance">
              <TabsList>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="fees">Fees</TabsTrigger>
                <TabsTrigger value="timetable" disabled>
                  Timetable
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="attendance"
                className="pt-2 text-muted-foreground"
              >
                Class 7 · Section B: 38 of 41 present today.
              </TabsContent>
              <TabsContent
                value="results"
                className="pt-2 text-muted-foreground"
              >
                Half-yearly results publish on 12 November 2026.
              </TabsContent>
              <TabsContent value="fees" className="pt-2 text-muted-foreground">
                ৳18,400 due from 9 students this month.
              </TabsContent>
            </Tabs>
          </Example>
          <Example title="Line · with icons" frameClassName="block">
            <Tabs defaultValue="profile">
              <TabsList variant="line">
                <TabsTrigger value="profile">
                  <UsersIcon />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="guardians">
                  <UserPlusIcon />
                  Guardians
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileTextIcon />
                  Documents
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="profile"
                className="pt-3 text-muted-foreground"
              >
                Ayesha Rahman · Roll 12 · Class 7 · Section B
              </TabsContent>
              <TabsContent
                value="guardians"
                className="pt-3 text-muted-foreground"
              >
                Primary guardian: Karim Rahman, 01712 345678
              </TabsContent>
              <TabsContent
                value="documents"
                className="pt-3 text-muted-foreground"
              >
                Birth certificate and transfer certificate on file.
              </TabsContent>
            </Tabs>
          </Example>
          <Example title="Vertical" frameClassName="block">
            <Tabs
              defaultValue="term1"
              orientation="vertical"
              className="flex-row"
            >
              <TabsList>
                <TabsTrigger value="term1">First term</TabsTrigger>
                <TabsTrigger value="half">Half-yearly</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>
              <TabsContent value="term1" className="text-muted-foreground">
                Held 9–19 March 2026.
              </TabsContent>
              <TabsContent value="half" className="text-muted-foreground">
                Starts 2 November 2026.
              </TabsContent>
              <TabsContent value="annual" className="text-muted-foreground">
                Scheduled for December 2026.
              </TabsContent>
            </Tabs>
          </Example>
        </Block>

        <Block
          name="NavigationMenu"
          when="A site header where a top item opens a panel of links. For public pages, not the dashboard."
        >
          <Example title="Typical" frameClassName="items-start">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Modules</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[min(30rem,calc(100vw-3rem))] gap-1 sm:grid-cols-2">
                      {MODULES.map((module) => (
                        <li key={module.title}>
                          <NavigationMenuLink
                            href="#navigation"
                            className="items-start"
                          >
                            <module.icon className="mt-0.5" />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">
                                {module.title}
                              </span>
                              <span className="text-muted-foreground">
                                {module.description}
                              </span>
                            </span>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="#navigation">
                    Pricing
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="#navigation">
                    Help
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </Example>
        </Block>

        <Block
          name="Menubar"
          when="A desktop tool row, such as the marks-entry sheet. Not for site navigation."
        >
          <Example title="Typical">
            <Menubar>
              <MenubarMenu>
                <MenubarTrigger>Sheet</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarItem>
                      Save marks <MenubarShortcut>Ctrl S</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem>
                      Print tabulation <MenubarShortcut>Ctrl P</MenubarShortcut>
                    </MenubarItem>
                  </MenubarGroup>
                  <MenubarSeparator />
                  <MenubarGroup>
                    <MenubarSub>
                      <MenubarSubTrigger>Export</MenubarSubTrigger>
                      <MenubarSubContent>
                        <MenubarItem>Excel workbook</MenubarItem>
                        <MenubarItem>PDF report cards</MenubarItem>
                      </MenubarSubContent>
                    </MenubarSub>
                  </MenubarGroup>
                  <MenubarSeparator />
                  <MenubarGroup>
                    <MenubarItem variant="destructive">
                      Clear all marks
                    </MenubarItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>View</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarLabel>Columns</MenubarLabel>
                    <MenubarCheckboxItem defaultChecked>
                      Roll number
                    </MenubarCheckboxItem>
                    <MenubarCheckboxItem defaultChecked>
                      Grade point
                    </MenubarCheckboxItem>
                    <MenubarCheckboxItem>Guardian phone</MenubarCheckboxItem>
                  </MenubarGroup>
                  <MenubarSeparator />
                  <MenubarGroup>
                    <MenubarLabel>Sort by</MenubarLabel>
                    <MenubarRadioGroup defaultValue="roll">
                      <MenubarRadioItem value="roll">
                        Roll number
                      </MenubarRadioItem>
                      <MenubarRadioItem value="name">Name</MenubarRadioItem>
                      <MenubarRadioItem value="total">
                        Total marks
                      </MenubarRadioItem>
                    </MenubarRadioGroup>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>Help</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarItem>How grade points are calculated</MenubarItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </Example>
        </Block>

        <Block
          name="Pagination"
          when="Pages through long lists such as the student directory. Lists show 20 rows a page."
        >
          <Example title="With ellipsis">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#navigation" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#navigation">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem className="hidden sm:block">
                  <PaginationLink href="#navigation">7</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#navigation" isActive>
                    8
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem className="hidden sm:block">
                  <PaginationLink href="#navigation">9</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#navigation">65</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#navigation" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </Example>
        </Block>

        <Block
          name="Kbd"
          when="Shows a key or shortcut. Group keys that are pressed together."
        >
          <Example title="Keys · groups · in a button">
            <Kbd>Esc</Kbd>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <span className="text-muted-foreground">+</span>
              <Kbd>K</Kbd>
            </KbdGroup>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>B</Kbd>
            </KbdGroup>
            <Button variant="outline">
              <SearchIcon data-icon="inline-start" />
              Search students
              <Kbd>/</Kbd>
            </Button>
          </Example>
        </Block>

        <Block
          name="Command"
          when="A searchable list of actions and records. Shown inline here; in the app it opens in a dialog with Ctrl K."
        >
          <Example
            title="Inline palette"
            frameClassName="block p-0 overflow-hidden"
          >
            <Command className="rounded-none!">
              <CommandInput placeholder="Search students, pages, actions…" />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Students">
                  <CommandItem>
                    <UsersIcon />
                    Ayesha Rahman
                    <span className="text-muted-foreground">Class 7 · B</span>
                  </CommandItem>
                  <CommandItem>
                    <UsersIcon />
                    Rafi Ahmed
                    <span className="text-muted-foreground">
                      Class 9 · Science
                    </span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  <CommandItem>
                    <LayoutDashboardIcon />
                    Dashboard
                    <CommandShortcut>
                      <KbdGroup>
                        <Kbd>G</Kbd>
                        <Kbd>D</Kbd>
                      </KbdGroup>
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem>
                    <CalendarCheckIcon />
                    Attendance
                    <CommandShortcut>
                      <KbdGroup>
                        <Kbd>G</Kbd>
                        <Kbd>A</Kbd>
                      </KbdGroup>
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem>
                    <BookOpenIcon />
                    Timetable
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  <CommandItem>
                    <UserPlusIcon />
                    Admit a student
                    <CommandShortcut>
                      <KbdGroup>
                        <Kbd>Ctrl</Kbd>
                        <Kbd>N</Kbd>
                      </KbdGroup>
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem>
                    <ReceiptTextIcon />
                    Collect a fee
                  </CommandItem>
                  <CommandItem disabled>
                    <MegaphoneIcon />
                    Send a notice (no permission)
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Example>
        </Block>

        <Block
          wide
          name="Sidebar"
          when={
            'The dashboard\'s main navigation. In the app it is fixed to the viewport and collapsible; here it is contained in a frame with collapsible="none".'
          }
        >
          <Example
            title="Contained · not collapsible"
            frameClassName="block h-96 overflow-hidden p-0"
          >
            <SidebarProvider
              className="h-full min-h-0"
              style={{ "--sidebar-width": "15rem" } as CSSProperties}
            >
              <Sidebar collapsible="none" className="h-full border-r">
                <SidebarHeader>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <GraduationCapIcon className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        Green Valley High School
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Academic year 2026
                      </span>
                    </div>
                  </div>
                </SidebarHeader>
                <SidebarSeparator />
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel>School</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {SIDEBAR_ITEMS.map((item) => (
                          <SidebarMenuItem key={item.label}>
                            <SidebarMenuButton
                              isActive={item.active}
                              render={
                                <a
                                  href="#navigation"
                                  aria-current={
                                    item.active ? "page" : undefined
                                  }
                                />
                              }
                            >
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                            {item.badge ? (
                              <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                            ) : null}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton render={<a href="#navigation" />}>
                        <SettingsIcon />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarFooter>
              </Sidebar>
              <div className="hidden min-w-0 flex-1 flex-col gap-3 overflow-auto bg-background p-6 sm:flex">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#navigation">
                        Students
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>All students</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <h4 className="text-lg font-semibold">Students</h4>
                <p className="text-sm text-muted-foreground">
                  1,284 enrolled in 2026 across 24 sections. 3 sections have not
                  marked attendance today.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Class 7 · Section B</Badge>
                  <Badge variant="outline">41 students</Badge>
                </div>
              </div>
            </SidebarProvider>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
