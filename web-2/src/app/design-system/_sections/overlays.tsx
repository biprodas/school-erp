"use client"

import { useState } from "react"
import {
  ArchiveIcon,
  CalendarIcon,
  CopyIcon,
  FileTextIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PrinterIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  UserMinusIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card"
import { Input } from "~/components/ui/input"
import { Kbd } from "~/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import {
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

const SHEET_SIDES = ["right", "left", "top", "bottom"] as const

function StudentSheet({ side }: { side: (typeof SHEET_SIDES)[number] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" className="capitalize" />}
      >
        {side}
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Ayesha Rahman</SheetTitle>
          <SheetDescription>Class 7 · Section B · Roll 12</SheetDescription>
        </SheetHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 text-sm">
          <dt className="text-muted-foreground">Guardian</dt>
          <dd>Nasrin Rahman (mother)</dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>01711-234567</dd>
          <dt className="text-muted-foreground">Attendance</dt>
          <dd>94% this term</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd>৳ 2,500 (October tuition)</dd>
        </dl>
        <SheetFooter>
          <Button>Open full profile</Button>
          <SheetClose render={<Button variant="outline" />}>Close</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function Overlays() {
  const [showArchived, setShowArchived] = useState(false)
  const [showDues, setShowDues] = useState(true)
  const [sortBy, setSortBy] = useState("roll")
  const [smsOnSave, setSmsOnSave] = useState(true)

  return (
    <ShowcaseSection
      id="overlays"
      title="Overlays"
      description="Layers that open above the page: modal dialogs, side and bottom panels, and the small popups for previews, hints and menus."
    >
      <BlockGrid>
        <Block
          name="Dialog"
          when="A short focused task that blocks the page, like editing one record. Keep it to a few fields."
        >
          <Example title="form with footer">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                <PencilIcon data-icon="inline-start" />
                Edit guardian contact
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit guardian contact</DialogTitle>
                  <DialogDescription>
                    Nasrin Rahman, mother of Ayesha Rahman (Class 7 · Section
                    B).
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="guardian-phone">Phone</FieldLabel>
                    <Input
                      id="guardian-phone"
                      type="tel"
                      defaultValue="01711-234567"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="guardian-email">Email</FieldLabel>
                    <Input
                      id="guardian-email"
                      type="email"
                      defaultValue="nasrin.rahman@example.com"
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <DialogClose render={<Button />}>Save contact</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" />}>
                Read-only notice
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Admission closed</DialogTitle>
                  <DialogDescription>
                    Admission for the 2027 session closed on 15 October. New
                    applications open again in December.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton />
              </DialogContent>
            </Dialog>
          </Example>
        </Block>

        <Block
          name="AlertDialog"
          when="Confirm an action that is hard to undo. It has no close button and does not close on an outside click."
        >
          <Example title="destructive confirm">
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <UserMinusIcon data-icon="inline-start" />
                Remove from section
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive">
                    <UserMinusIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>
                    Remove student from section?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Ayesha Rahman will leave Class 7 · Section B. Her attendance
                    and marks stay on record, but she won&apos;t appear in this
                    section&apos;s register.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep in section</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Example>
          <Example title="size sm">
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                Discard draft notice
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard this notice?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;Parent-teacher meeting, 2 November&rdquo; has not
                    been sent.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Example>
        </Block>

        <Block
          name="Sheet"
          when="A side panel for details or a longer form while the page stays in view. Right is the default."
        >
          <Example title="sides">
            {SHEET_SIDES.map((side) => (
              <StudentSheet key={side} side={side} />
            ))}
          </Example>
        </Block>

        <Block
          name="Drawer"
          when="A bottom panel for phones that can be swiped away. Use it for quick actions on small screens."
        >
          <Example title="bottom, with swipe handle">
            <Drawer showSwipeHandle>
              <DrawerTrigger render={<Button variant="outline" />}>
                Mark absent
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Mark 3 students absent?</DrawerTitle>
                  <DrawerDescription>
                    Class 7 · Section B, period 1 on 20 October. Guardians get
                    an SMS when you save.
                  </DrawerDescription>
                </DrawerHeader>
                <ul className="flex flex-col gap-2 p-4 text-sm">
                  {[
                    "Ayesha Rahman · Roll 12",
                    "Tanvir Hasan · Roll 18",
                    "Sadia Islam · Roll 27",
                  ].map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <UserRoundIcon className="size-4 text-muted-foreground" />
                      {name}
                    </li>
                  ))}
                </ul>
                <DrawerFooter>
                  <DrawerClose render={<Button />}>Save register</DrawerClose>
                  <DrawerClose render={<Button variant="outline" />}>
                    Back
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </Example>
        </Block>

        <Block
          name="Popover"
          when="Extra detail or a small control anchored to a trigger. It stays open until dismissed."
        >
          <Example title="details">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>
                <SendIcon data-icon="inline-start" />
                SMS credit
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>1,240 SMS left</PopoverTitle>
                  <PopoverDescription>
                    About 9 days at this month&apos;s rate. Absence alerts stop
                    when credit runs out.
                  </PopoverDescription>
                </PopoverHeader>
                <Button size="sm">Top up · ৳ 1,000</Button>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger render={<Button variant="ghost" />}>
                <CalendarIcon data-icon="inline-start" />
                Exam date
              </PopoverTrigger>
              <PopoverContent align="start">
                <PopoverHeader>
                  <PopoverTitle>Half-yearly exam</PopoverTitle>
                  <PopoverDescription>
                    Starts Sunday, 3 November at 10:00 AM in Hall 2.
                  </PopoverDescription>
                </PopoverHeader>
              </PopoverContent>
            </Popover>
          </Example>
        </Block>

        <Block
          name="HoverCard"
          when="A preview of a linked person or record on hover or focus. Never put the only path to an action in it."
        >
          <Example title="student and teacher preview">
            <p className="text-sm">
              Reported by{" "}
              <HoverCard>
                <HoverCardTrigger
                  render={
                    <a
                      href="#overlays"
                      className="font-medium underline underline-offset-4"
                    />
                  }
                >
                  Mr. Karim
                </HoverCardTrigger>
                <HoverCardContent className="flex gap-3">
                  <Avatar>
                    <AvatarFallback>MK</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">Mr. Abdul Karim</span>
                    <span className="text-muted-foreground">
                      Class teacher, Class 7 · Section B
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Mathematics · joined 2019
                    </span>
                  </div>
                </HoverCardContent>
              </HoverCard>{" "}
              about{" "}
              <HoverCard>
                <HoverCardTrigger
                  render={
                    <a
                      href="#overlays"
                      className="font-medium underline underline-offset-4"
                    />
                  }
                >
                  Ayesha Rahman
                </HoverCardTrigger>
                <HoverCardContent className="flex gap-3">
                  <Avatar>
                    <AvatarFallback>AR</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">Ayesha Rahman</span>
                    <span className="text-muted-foreground">
                      Class 7 · Section B · Roll 12
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">94% attendance</Badge>
                      <Badge variant="destructive">৳ 2,500 due</Badge>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              .
            </p>
          </Example>
        </Block>

        <Block
          name="Tooltip"
          when="Names an icon-only control. Short text only, nothing interactive inside."
        >
          <Example title="icon buttons">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Print register"
                    />
                  }
                >
                  <PrinterIcon />
                </TooltipTrigger>
                <TooltipContent>Print register</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Search students"
                    />
                  }
                >
                  <SearchIcon />
                </TooltipTrigger>
                <TooltipContent>
                  Search students <Kbd>/</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Email guardians"
                    />
                  }
                >
                  <MailIcon />
                </TooltipTrigger>
                <TooltipContent side="bottom">Email guardians</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Example>
        </Block>

        <Block
          name="DropdownMenu"
          when="A list of actions or view options behind a button. Group related items and put destructive ones last."
        >
          <Example title="groups, checkbox, radio, submenu">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <MoreHorizontalIcon data-icon="inline-start" />
                Register options
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Class 7 · Section B</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <PencilIcon />
                    Edit register
                    <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <PrinterIcon />
                    Print
                    <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FileTextIcon />
                      Export as
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem>PDF</DropdownMenuItem>
                      <DropdownMenuItem>Excel (.xlsx)</DropdownMenuItem>
                      <DropdownMenuItem>CSV</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Show</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={showDues}
                    onCheckedChange={setShowDues}
                  >
                    Fee dues
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                  >
                    Transferred students
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortBy}
                    onValueChange={setSortBy}
                  >
                    <DropdownMenuRadioItem value="roll">
                      Roll number
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">
                      Name
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="attendance">
                      Attendance
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled>
                    <SettingsIcon />
                    Section settings
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive">
                    <Trash2Icon />
                    Delete register
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Example>
        </Block>

        <Block
          name="ContextMenu"
          when="Shortcuts on right-click or long-press. Always offer the same actions somewhere visible too."
        >
          <Example title="right-click area" frameClassName="block">
            <ContextMenu>
              <ContextMenuTrigger className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Ayesha Rahman · Roll 12
                </span>
                Right-click or long-press here
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuGroup>
                  <ContextMenuLabel>Ayesha Rahman</ContextMenuLabel>
                  <ContextMenuItem>
                    <UserRoundIcon />
                    Open profile
                  </ContextMenuItem>
                  <ContextMenuItem>
                    <CopyIcon />
                    Copy student ID
                    <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <SendIcon />
                      Message guardian
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      <ContextMenuItem>SMS</ContextMenuItem>
                      <ContextMenuItem>Email</ContextMenuItem>
                      <ContextMenuItem>In-app message</ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuCheckboxItem
                  checked={smsOnSave}
                  onCheckedChange={setSmsOnSave}
                >
                  SMS guardian on absence
                </ContextMenuCheckboxItem>
                <ContextMenuSeparator />
                <ContextMenuItem>
                  <ArchiveIcon />
                  Mark transferred
                </ContextMenuItem>
                <ContextMenuItem variant="destructive">
                  <UserMinusIcon />
                  Remove from section
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
