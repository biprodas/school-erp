"use client"

import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowRightIcon,
  BoldIcon,
  ChevronDownIcon,
  DownloadIcon,
  ItalicIcon,
  PlusIcon,
  PrinterIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  UnderlineIcon,
} from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "~/components/ui/button-group"
import { Kbd, KbdGroup } from "~/components/ui/kbd"
import { Spinner } from "~/components/ui/spinner"
import { Toggle } from "~/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"
import { previewState, StateMatrix } from "../_showcase/state-matrix"

const BUTTON_VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const
const BUTTON_STATES = ["default", "disabled", "loading"]
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const

const BADGE_VARIANTS = [
  { variant: "default", label: "Paid", when: "Confirmed, settled" },
  { variant: "secondary", label: "Class 7 · B", when: "Neutral tags" },
  { variant: "outline", label: "Science", when: "Filters, quiet labels" },
  { variant: "success", label: "Present", when: "Good outcome" },
  { variant: "warning", label: "Late 10 min", when: "Needs attention soon" },
  { variant: "destructive", label: "Absent", when: "Absences, overdue dues" },
  { variant: "highlight", label: "New", when: "One callout, on forest" },
  { variant: "ghost", label: "Draft", when: "Lowest emphasis" },
] as const

export function Actions() {
  return (
    <ShowcaseSection
      id="actions"
      eyebrow="Components · Actions"
      title="Actions"
      description="Pill buttons with semibold labels. One primary per group, outline for the rest, and marigold only for the single key action on a forest surface."
    >
      <BlockGrid>
        <Block
          wide
          name="Button"
          when="Starts an action: save the register, collect a fee, send a notice. For navigation, render it as a link."
        >
          <Example title="Typical">
            <Button>
              <SendIcon data-icon="inline-start" />
              Save register
            </Button>
            <Button variant="outline">Mark all present</Button>
            <Button variant="ghost">Cancel</Button>
          </Example>

          <Example title="Variant × state" frameClassName="block">
            <StateMatrix
              rows={BUTTON_VARIANTS}
              states={BUTTON_STATES}
              render={(variant, state) =>
                state === "loading" ? (
                  <Button variant={variant} disabled>
                    <Spinner data-icon="inline-start" />
                    Saving
                  </Button>
                ) : (
                  <Button variant={variant} {...previewState(state)}>
                    Save draft
                  </Button>
                )
              }
            />
          </Example>

          <Example
            title="highlight · on a forest band (.dark)"
            frameClassName="dark block bg-band ring-0"
          >
            <StateMatrix
              rows={["highlight", "default", "outline"] as const}
              states={BUTTON_STATES}
              render={(variant, state) =>
                state === "loading" ? (
                  <Button variant={variant} disabled>
                    <Spinner data-icon="inline-start" />
                    Starting
                  </Button>
                ) : (
                  <Button variant={variant} {...previewState(state)}>
                    Start free trial
                  </Button>
                )
              }
            />
          </Example>

          <div className="grid gap-5 md:grid-cols-2">
            <Example title="Sizes · xs, sm, default, lg">
              {BUTTON_SIZES.map((size) => (
                <Button key={size} size={size}>
                  Collect fee
                </Button>
              ))}
            </Example>
            <Example title="Icon-only sizes">
              {ICON_SIZES.map((size) => (
                <Button key={size} size={size} variant="outline" aria-label="Add student">
                  <PlusIcon />
                </Button>
              ))}
            </Example>
            <Example title="With icon · leading, trailing">
              <Button>
                <DownloadIcon data-icon="inline-start" />
                Download report cards
              </Button>
              <Button variant="outline">
                Next section
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Remove fee head
              </Button>
            </Example>
            <Example title="Edge case · long label" frameClassName="max-w-full">
              <Button className="max-w-full">
                <span className="truncate">
                  Send absence SMS to guardians of all 14 students in Class 7 · Section B
                </span>
              </Button>
              <Button variant="outline" lang="bn">
                অভিভাবকদের নোটিশ পাঠান
              </Button>
            </Example>
          </div>
        </Block>

        <Block
          name="ButtonGroup"
          when="Joins related actions that act on the same thing. Segments square off; only the ends stay rounded."
        >
          <Example title="Typical">
            <ButtonGroup>
              <Button variant="outline">
                <PrinterIcon data-icon="inline-start" />
                Print
              </Button>
              <Button variant="outline">
                <DownloadIcon data-icon="inline-start" />
                PDF
              </Button>
              <Button variant="outline" size="icon" aria-label="More export options">
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
          </Example>
          <Example title="With text and separator">
            <ButtonGroup>
              <ButtonGroupText>Roll</ButtonGroupText>
              <Button variant="outline">Previous</Button>
              <ButtonGroupSeparator />
              <Button variant="outline">Next</Button>
            </ButtonGroup>
            <ButtonGroup orientation="vertical">
              <Button variant="outline" size="sm">
                Term 1
              </Button>
              <Button variant="outline" size="sm">
                Term 2
              </Button>
              <Button variant="outline" size="sm">
                Final
              </Button>
            </ButtonGroup>
          </Example>
        </Block>

        <Block name="Toggle" when="A single on/off formatting or filter control, such as starring a notice.">
          <Example title="Variant × state" frameClassName="block">
            <StateMatrix
              rows={["default", "outline"] as const}
              render={(variant, state) => (
                <Toggle variant={variant} aria-label="Pin notice" {...previewState(state)}>
                  <StarIcon data-icon="inline-start" />
                  Pin
                </Toggle>
              )}
            />
          </Example>
          <Example title="Pressed · sizes sm, default, lg">
            <Toggle size="sm" defaultPressed aria-label="Bold">
              <BoldIcon />
            </Toggle>
            <Toggle defaultPressed aria-label="Bold">
              <BoldIcon />
            </Toggle>
            <Toggle size="lg" variant="outline" defaultPressed aria-label="Bold">
              <BoldIcon />
            </Toggle>
          </Example>
        </Block>

        <Block
          name="ToggleGroup"
          when="Switches between 2–7 options, like attendance status or a report view. Use instead of a row of buttons with manual active state."
        >
          <Example title="Single · attendance status">
            <ToggleGroup variant="outline" defaultValue={["present"]} aria-label="Attendance status">
              <ToggleGroupItem value="present">Present</ToggleGroupItem>
              <ToggleGroupItem value="late">Late</ToggleGroupItem>
              <ToggleGroupItem value="absent">Absent</ToggleGroupItem>
              <ToggleGroupItem value="leave">Leave</ToggleGroupItem>
            </ToggleGroup>
          </Example>
          <Example title="Multiple · joined (spacing 0)">
            <ToggleGroup multiple spacing={0} variant="outline" defaultValue={["bold"]} aria-label="Text style">
              <ToggleGroupItem value="bold" aria-label="Bold">
                <BoldIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Italic">
                <ItalicIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="underline" aria-label="Underline">
                <UnderlineIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup size="sm" defaultValue={["left"]} aria-label="Alignment">
              <ToggleGroupItem value="left" aria-label="Align left">
                <AlignLeftIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="Align center">
                <AlignCenterIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Align right">
                <AlignRightIcon />
              </ToggleGroupItem>
            </ToggleGroup>
          </Example>
        </Block>

        <Block name="Badge" when="A short status or tag on a row, card or name. Never a button.">
          <Example title="Variants" frameClassName="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BADGE_VARIANTS.map((item) =>
              item.variant === "highlight" ? (
                <div key={item.variant} className="dark flex items-center gap-3 rounded-lg bg-band px-3 py-2">
                  <Badge variant={item.variant}>{item.label}</Badge>
                  <span className="type-caption text-muted-foreground">{item.when}</span>
                </div>
              ) : (
                <div key={item.variant} className="flex items-center gap-3 px-3 py-2">
                  <Badge variant={item.variant}>{item.label}</Badge>
                  <span className="type-caption text-subtle-foreground">{item.when}</span>
                </div>
              )
            )}
          </Example>
          <Example title="With icon · Bangla · long text" frameClassName="max-w-full">
            <Badge variant="success">
              <StarIcon data-icon="inline-start" />
              GPA 5.00
            </Badge>
            <Badge variant="secondary" lang="bn">
              অনুপস্থিত ৩ দিন
            </Badge>
            <Badge variant="outline" className="max-w-56">
              <span className="truncate">Guardian: Mohammad Abdur Rahman Chowdhury</span>
            </Badge>
          </Example>
        </Block>

        <Block name="Kbd" when="Shows a keyboard shortcut, for staff who mark registers on a laptop.">
          <Example title="Shortcuts">
            <span className="type-body flex items-center gap-2 text-muted-foreground">
              Search students
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </span>
            <span className="type-body flex items-center gap-2 text-muted-foreground">
              Mark present
              <Kbd>P</Kbd>
            </span>
            <span className="type-body flex items-center gap-2 text-muted-foreground">
              Next student
              <Kbd>↓</Kbd>
            </span>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
