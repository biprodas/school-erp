"use client"

import {
  BellIcon,
  CalendarCheckIcon,
  CopyIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"
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
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
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
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"

function SchoolCommands() {
  return (
    <>
      <CommandEmpty>No students or pages match that.</CommandEmpty>
      <CommandGroup heading="Students">
        <CommandItem>
          <UserIcon />
          Rafi Ahmed · Class 7 B · Roll 12
        </CommandItem>
        <CommandItem>
          <UserIcon />
          Nusrat Jahan · Class 9 A · Roll 4
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Go to">
        <CommandItem>
          <CalendarCheckIcon />
          Take attendance
          <CommandShortcut>A</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <ReceiptTextIcon />
          Collect a fee
          <CommandShortcut>F</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <BellIcon />
          Send a notice
          <CommandShortcut>N</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </>
  )
}

export function Overlays() {
  // Controlled so cmdk doesn't scroll its first item (and the page) into view on mount.
  const [commandValue, setCommandValue] = useState("none")
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <ShowcaseSection
      id="overlays"
      eyebrow="Components"
      title="Overlays"
      description="Layers above the page. Each trigger below is labeled with what it opens."
    >
      <BlockGrid>
        <Block name="Dialog" when="A short task that needs focus, like editing one record. Always has a title.">
          <Example>
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                <PencilIcon data-icon="inline-start" />
                Open edit guardian dialog
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit guardian</DialogTitle>
                  <DialogDescription>
                    SMS alerts for Rafi Ahmed go to this number.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="guardian-name">Name</FieldLabel>
                    <Input id="guardian-name" defaultValue="Kamal Ahmed" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="guardian-phone">Mobile</FieldLabel>
                    <Input id="guardian-phone" type="tel" defaultValue="01711-234567" />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose render={<Button />}>Save guardian</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Example>
        </Block>

        <Block name="Alert dialog" when="Confirm something hard to undo. Name exactly what will happen.">
          <Example>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <Trash2Icon data-icon="inline-start" />
                Open delete receipt confirmation
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <Trash2Icon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Cancel receipt 004817?</AlertDialogTitle>
                  <AlertDialogDescription>
                    ৳4,020 goes back on Rafi Ahmed&apos;s dues, and his guardian gets an SMS
                    saying the payment was reversed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep receipt</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">Cancel receipt</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Example>
        </Block>

        <Block name="Sheet" when="Details beside a list, so people keep their place. Slides from the side.">
          <Example>
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>Open student profile sheet</SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Rafi Ahmed</SheetTitle>
                  <SheetDescription>Class 7 · Section B · Roll 12</SheetDescription>
                </SheetHeader>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 type-body">
                  <dt className="text-muted-foreground">Attendance</dt>
                  <dd className="type-numeral">92%</dd>
                  <dt className="text-muted-foreground">Dues</dt>
                  <dd className="type-numeral text-destructive">৳4,020</dd>
                  <dt className="text-muted-foreground">Guardian</dt>
                  <dd>Kamal Ahmed</dd>
                </dl>
                <SheetFooter>
                  <Button>Collect fee</Button>
                  <SheetClose render={<Button variant="outline" />}>Close</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </Example>
        </Block>

        <Block name="Drawer" when="The phone version of a sheet: a bottom panel teachers can swipe away.">
          <Example>
            <Drawer>
              <DrawerTrigger render={<Button variant="outline" />}>Open mark-absent drawer</DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Mark 3 students absent?</DrawerTitle>
                  <DrawerDescription>
                    Their guardians get an SMS at 9:15 AM: আজ আপনার সন্তান স্কুলে অনুপস্থিত।
                  </DrawerDescription>
                </DrawerHeader>
                <DrawerFooter>
                  <DrawerClose render={<Button />}>Save register</DrawerClose>
                  <DrawerClose render={<Button variant="outline" />}>Back to register</DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </Example>
        </Block>

        <Block name="Popover" when="A small panel anchored to its trigger, for a quick setting or detail.">
          <Example>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>Open SMS credit popover</PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>SMS credit</PopoverTitle>
                  <PopoverDescription>1,240 messages left, enough for about 9 school days.</PopoverDescription>
                </PopoverHeader>
                <Button size="sm">Top up with bKash</Button>
              </PopoverContent>
            </Popover>
          </Example>
        </Block>

        <Block name="Hover card" when="A preview on hover or focus of a link. Never the only way to reach the information.">
          <Example>
            <HoverCard>
              <HoverCardTrigger render={<a href="#overlays" className="type-label text-primary underline underline-offset-4" />}>
                Hover for Nusrat Jahan&apos;s card
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarFallback>NJ</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <p className="type-label">Nusrat Jahan</p>
                    <p className="type-caption text-muted-foreground">Class 9 · Section A · Roll 4</p>
                    <Badge variant="success">Present today</Badge>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </Example>
        </Block>

        <Block name="Tooltip" when="Names an icon-only control. Keep it to a few words.">
          <Example>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Print register" />}>
                <PrinterIcon />
              </TooltipTrigger>
              <TooltipContent>Print register</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Search" />}>
                <SearchIcon />
              </TooltipTrigger>
              <TooltipContent>
                Search <Kbd>/</Kbd>
              </TooltipContent>
            </Tooltip>
            <span className="type-caption text-muted-foreground">Hover or focus the icons</span>
          </Example>
        </Block>

        <Block name="Dropdown menu" when="Actions on one record, grouped, with destructive actions last.">
          <Example>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <MoreHorizontalIcon data-icon="inline-start" />
                Open student actions menu
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Rafi Ahmed</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <FileTextIcon />
                    View report card
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ReceiptTextIcon />
                    Collect fee
                    <DropdownMenuShortcut>F</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UsersIcon />
                    Move to another section
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">
                    <Trash2Icon />
                    Remove from roll
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Example>
        </Block>

        <Block name="Context menu" when="Shortcuts on right-click or long-press. Every item must also be reachable another way.">
          <Example frameClassName="p-3">
            <ContextMenu>
              <ContextMenuTrigger className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed type-body text-muted-foreground">
                Right-click this receipt to open its context menu
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuGroup>
                  <ContextMenuItem>
                    <PrinterIcon />
                    Print receipt
                    <ContextMenuShortcut>P</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem>
                    <CopyIcon />
                    Copy receipt number
                  </ContextMenuItem>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                  <ContextMenuItem variant="destructive">
                    <Trash2Icon />
                    Cancel receipt
                  </ContextMenuItem>
                </ContextMenuGroup>
              </ContextMenuContent>
            </ContextMenu>
          </Example>
        </Block>

        <Block name="Command" when="Search everything and jump. Inline on a page, or as a palette in a dialog." wide>
          <div className="grid gap-4 md:grid-cols-2">
            <Example title="inline" frameClassName="p-0">
              <Command value={commandValue} onValueChange={setCommandValue} className="rounded-2xl!">
                <CommandInput placeholder="Search students or pages…" />
                <CommandList>
                  <SchoolCommands />
                </CommandList>
              </Command>
            </Example>
            <Example title="palette">
              <Button variant="outline" onClick={() => setPaletteOpen(true)}>
                <SearchIcon data-icon="inline-start" />
                Open command palette
              </Button>
              <CommandDialog
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                title="Search Kampasy"
                description="Find a student, or jump to a page."
              >
                <Command>
                  <CommandInput placeholder="Search students or pages…" />
                  <CommandList>
                    <SchoolCommands />
                  </CommandList>
                </Command>
              </CommandDialog>
            </Example>
          </div>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
