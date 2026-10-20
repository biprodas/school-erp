import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowRightIcon,
  BellIcon,
  BoldIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ItalicIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  UnderlineIcon,
} from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "~/components/ui/button-group"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { Toggle } from "~/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/section"

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const
const TOGGLE_SIZES = ["sm", "default", "lg"] as const

const ATTENDANCE = [
  { name: "Ayesha Rahman", roll: 1, status: "present" },
  { name: "Tanvir Hossain", roll: 2, status: "absent" },
  { name: "Nusrat Jahan", roll: 3, status: "late" },
]

export function Actions() {
  return (
    <ShowcaseSection
      id="actions"
      title="Actions"
      description="Buttons start things, toggles switch them. Keep one primary button per group and use outline or ghost for the rest."
    >
      <BlockGrid>
        <Block
          wide
          name="Button"
          when="Starts an action: save the register, collect a fee, send a notice. For navigation, render it as a link."
        >
          <Example title="Variant × size" frameClassName="block overflow-x-auto">
            <div className="grid min-w-max grid-cols-[auto_repeat(4,auto)] items-center gap-x-4 gap-y-3">
              <span />
              {BUTTON_SIZES.map((size) => (
                <code key={size} className="font-mono text-xs text-muted-foreground">
                  {size}
                </code>
              ))}
              {BUTTON_VARIANTS.map((variant) => (
                <div key={variant} className="contents">
                  <code className="font-mono text-xs text-muted-foreground">
                    {variant}
                  </code>
                  {BUTTON_SIZES.map((size) => (
                    <div key={size}>
                      <Button variant={variant} size={size}>
                        Collect fee
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Example>

          <div className="grid gap-5 md:grid-cols-2">
            <Example title="Icon sizes · icon-xs, icon-sm, icon, icon-lg">
              {ICON_SIZES.map((size) => (
                <Button key={size} size={size} variant="outline" aria-label="Add student">
                  <PlusIcon />
                </Button>
              ))}
              {ICON_SIZES.map((size) => (
                <Button key={size} size={size} variant="ghost" aria-label="Print register">
                  <PrinterIcon />
                </Button>
              ))}
            </Example>

            <Example title='Icons · data-icon="inline-start" / "inline-end"'>
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

            <Example title="Disabled and loading">
              <Button disabled>Publish results</Button>
              <Button variant="outline" disabled>
                Mark all present
              </Button>
              <Button disabled>
                <Spinner data-icon="inline-start" />
                Saving register
              </Button>
              <Button variant="outline" size="icon" disabled aria-label="Loading">
                <Spinner />
              </Button>
            </Example>

            <Example title="Link rendered as a button · render={<a />}">
              <Button render={<a href="#actions" />} nativeButton={false}>
                View fee ledger
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                variant="link"
                render={<a href="#foundations" />}
                nativeButton={false}
              >
                See attendance policy
              </Button>
            </Example>
          </div>
        </Block>

        <Block
          name="ButtonGroup"
          when="Joins related actions into one control: pagination, split buttons, an input with its submit."
        >
          <Example title="Horizontal">
            <ButtonGroup>
              <Button variant="outline">Today</Button>
              <Button variant="outline">This week</Button>
              <Button variant="outline">This month</Button>
            </ButtonGroup>
            <ButtonGroup aria-label="Pagination">
              <Button variant="outline" size="icon" aria-label="Previous page">
                <ChevronLeftIcon />
              </Button>
              <ButtonGroupText>Page 2 of 9</ButtonGroupText>
              <Button variant="outline" size="icon" aria-label="Next page">
                <ChevronRightIcon />
              </Button>
            </ButtonGroup>
          </Example>

          <Example title="Split button · ButtonGroupSeparator">
            <ButtonGroup>
              <Button>Collect ৳1,200</Button>
              <ButtonGroupSeparator />
              <Button size="icon" aria-label="More payment options">
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button variant="secondary">
                <BellIcon data-icon="inline-start" />
                Notify guardians
              </Button>
              <ButtonGroupSeparator />
              <Button variant="secondary" size="icon" aria-label="Notice options">
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
          </Example>

          <Example title="With text and input">
            <ButtonGroup className="w-full max-w-sm">
              <ButtonGroupText>Roll</ButtonGroupText>
              <Input placeholder="e.g. 14" aria-label="Roll number" />
              <Button variant="outline" size="icon" aria-label="Find student">
                <SearchIcon />
              </Button>
            </ButtonGroup>
          </Example>

          <Example title='orientation="vertical"'>
            <ButtonGroup orientation="vertical" aria-label="Report actions">
              <Button variant="outline">
                <PrinterIcon data-icon="inline-start" />
                Print
              </Button>
              <Button variant="outline">
                <DownloadIcon data-icon="inline-start" />
                Export PDF
              </Button>
              <Button variant="outline">
                <StarIcon data-icon="inline-start" />
                Pin to dashboard
              </Button>
            </ButtonGroup>
          </Example>
        </Block>

        <Block
          name="Toggle"
          when="A single on/off switch that looks like a button: star a student, show only absentees, bold a notice."
        >
          <Example title="variant · default, outline">
            <Toggle aria-label="Bold">
              <BoldIcon />
            </Toggle>
            <Toggle variant="outline" aria-label="Italic">
              <ItalicIcon />
            </Toggle>
            <Toggle variant="outline">
              <StarIcon data-icon="inline-start" />
              Starred
            </Toggle>
          </Example>

          <Example title="size · sm, default, lg">
            {TOGGLE_SIZES.map((size) => (
              <Toggle key={size} size={size} variant="outline">
                Absentees only
              </Toggle>
            ))}
          </Example>

          <Example title="Pressed and disabled">
            <Toggle variant="outline" defaultPressed>
              <StarIcon data-icon="inline-start" />
              Pressed
            </Toggle>
            <Toggle variant="outline" disabled>
              Disabled
            </Toggle>
            <Toggle variant="outline" defaultPressed disabled>
              Pressed, disabled
            </Toggle>
          </Example>
        </Block>

        <Block
          name="ToggleGroup"
          when="A set of toggles. Single selection for one choice per row, such as attendance; multiple for independent options like formatting."
        >
          <Example title="Single · attendance per student" frameClassName="flex-col items-stretch">
            {ATTENDANCE.map((student) => (
              <div
                key={student.roll}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{student.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Roll {student.roll} · Class 7 · Section B
                  </span>
                </div>
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  defaultValue={[student.status]}
                  aria-label={`Attendance for ${student.name}`}
                >
                  <ToggleGroupItem value="present" aria-label="Present">
                    P
                  </ToggleGroupItem>
                  <ToggleGroupItem value="absent" aria-label="Absent">
                    A
                  </ToggleGroupItem>
                  <ToggleGroupItem value="late" aria-label="Late">
                    L
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            ))}
          </Example>

          <Example title="Multiple · notice formatting">
            <ToggleGroup multiple defaultValue={["bold"]} aria-label="Text formatting">
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
            <ToggleGroup
              variant="outline"
              spacing={0}
              defaultValue={["left"]}
              aria-label="Alignment"
            >
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

          <Example title='orientation="vertical" · disabled item'>
            <ToggleGroup
              variant="outline"
              orientation="vertical"
              spacing={0}
              defaultValue={["term-1"]}
              aria-label="Term"
            >
              <ToggleGroupItem value="term-1">First term</ToggleGroupItem>
              <ToggleGroupItem value="term-2">Half-yearly</ToggleGroupItem>
              <ToggleGroupItem value="term-3" disabled>
                Annual (locked)
              </ToggleGroupItem>
            </ToggleGroup>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
