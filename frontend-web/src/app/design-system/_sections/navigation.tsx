"use client"

import {
  BookOpenIcon,
  CalendarCheckIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  SettingsIcon,
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
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
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
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"
import { previewState, StateMatrix } from "../_showcase/state-matrix"

const MODULES = [
  { title: "Attendance", description: "Mark a section in under a minute, alert guardians by SMS.", icon: CalendarCheckIcon },
  { title: "Exams and results", description: "Marks entry, GPA and printable report cards.", icon: GraduationCapIcon },
  { title: "Fees", description: "Invoices, bKash payments, receipts and dues.", icon: ReceiptTextIcon },
  { title: "Notices", description: "Class or school-wide notices in Bangla and English.", icon: MegaphoneIcon },
]

const NAV_MAIN = [
  { label: "Dashboard", icon: LayoutDashboardIcon, active: true },
  { label: "Students", icon: UsersIcon, badge: "1,284" },
  { label: "Attendance", icon: CalendarCheckIcon, badge: "3" },
  { label: "Exams", icon: GraduationCapIcon },
  { label: "Fees", icon: ReceiptTextIcon },
  { label: "Academics", icon: BookOpenIcon },
]

export function Navigation() {
  return (
    <ShowcaseSection
      id="navigation"
      eyebrow="Components"
      title="Navigation"
      description="How staff move between classes, modules and pages. Keep labels short and plain, the way a head teacher would say them."
    >
      <BlockGrid>
        <Block name="Tabs" when="Switch between views of the same thing, such as one class's attendance, results and fees.">
          <Example title="Typical">
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="fees">Fees</TabsTrigger>
              </TabsList>
              <TabsContent value="attendance" className="type-body pt-2 text-muted-foreground">
                Class 7 · Section B: 38 of 41 present today (92.7%).
              </TabsContent>
              <TabsContent value="results" className="type-body pt-2 text-muted-foreground">
                Half-yearly results publish on 12 November.
              </TabsContent>
              <TabsContent value="fees" className="type-body pt-2 text-muted-foreground">
                ৳18,400 due from 9 students this month.
              </TabsContent>
            </Tabs>
          </Example>
          <Example title="Line variant">
            <Tabs defaultValue="today">
              <TabsList variant="line">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This week</TabsTrigger>
                <TabsTrigger value="term">This term</TabsTrigger>
              </TabsList>
            </Tabs>
          </Example>
          <Example title="States" frameClassName="block">
            <StateMatrix
              rows={["inactive", "active"] as const}
              render={(row, state) => (
                <Tabs defaultValue={row === "active" ? "results" : "attendance"}>
                  <TabsList>
                    <TabsTrigger value="results" {...previewState(state)}>
                      Results
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
          </Example>
        </Block>

        <Block name="Breadcrumb" when="Show where a page sits, from the school down to one student. Truncate long names; never wrap.">
          <Example title="Typical">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">Students</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="#navigation">Class 7 · B</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Rafi Ahmed</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Example>
          <Example title="Collapsed with long text">
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
                  <BreadcrumbPage className="block max-w-56 truncate">
                    Half-yearly examination 2026 · Bangla first paper · Section B
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Example>
        </Block>

        <Block name="Pagination" when="Page through long lists such as the student directory. Lists default to 20 rows a page.">
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
                <PaginationItem>
                  <PaginationLink href="#navigation">7</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#navigation" isActive>
                    8
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
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

        <Block name="Menubar" when="Desktop tool rows, such as the marks-entry sheet. Not for site navigation.">
          <Example title="Typical">
            <Menubar>
              <MenubarMenu>
                <MenubarTrigger>Sheet</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarItem>
                      Save marks <MenubarShortcut>Ctrl S</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem>Print tabulation</MenubarItem>
                  </MenubarGroup>
                  <MenubarSeparator />
                  <MenubarGroup>
                    <MenubarItem>Export to Excel</MenubarItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>View</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarLabel>Columns</MenubarLabel>
                    <MenubarCheckboxItem defaultChecked>Roll number</MenubarCheckboxItem>
                    <MenubarCheckboxItem defaultChecked>Grade point</MenubarCheckboxItem>
                    <MenubarCheckboxItem>Guardian phone</MenubarCheckboxItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>Help</MenubarTrigger>
                <MenubarContent>
                  <MenubarGroup>
                    <MenubarItem>How GPA is calculated</MenubarItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </Example>
        </Block>

        <Block name="Navigation menu" when="The marketing site header, where a top item opens a panel of modules." wide>
          <Example title="Typical" frameClassName="pb-72 items-start">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Modules</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[min(32rem,80vw)] gap-1 sm:grid-cols-2">
                      {MODULES.map((module) => (
                        <li key={module.title}>
                          <NavigationMenuLink href="#navigation" className="items-start">
                            <module.icon className="mt-0.5 text-primary" />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-semibold">{module.title}</span>
                              <span className="text-muted-foreground">{module.description}</span>
                            </span>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="#navigation">Pricing</NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="#navigation">FAQ</NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </Example>
        </Block>

        <Block name="Sidebar" when="The school dashboard's main navigation. Shown inline here; in the app it is fixed and collapsible." wide>
          <Example title="Inline, not collapsible" frameClassName="block p-0 overflow-hidden">
            <SidebarProvider className="min-h-0">
              <Sidebar collapsible="none" className="h-[28rem] border-r">
                <SidebarHeader>
                  <div className="flex flex-col gap-0.5 px-2 py-1.5">
                    <span className="type-label">Dhanmondi Ideal School</span>
                    <span className="type-caption text-subtle-foreground">Academic year 2026</span>
                  </div>
                </SidebarHeader>
                <SidebarSeparator />
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel>School</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {NAV_MAIN.map((item) => (
                          <SidebarMenuItem key={item.label}>
                            <SidebarMenuButton isActive={item.active}>
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                            {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <SettingsIcon />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarFooter>
              </Sidebar>
              <div className="flex min-w-0 flex-1 flex-col gap-3 bg-background p-6">
                <p className="type-eyebrow text-primary">Good morning, Nasrin</p>
                <p className="type-title-lg">Today at a glance</p>
                <p className="type-body text-muted-foreground">
                  3 sections haven&apos;t marked attendance yet. Fee collection so far: ৳42,300.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="warning">3 registers open</Badge>
                  <Badge variant="success">96.1% present</Badge>
                </div>
              </div>
            </SidebarProvider>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
