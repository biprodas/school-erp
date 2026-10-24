"use client"

import { Fragment, useState } from "react"
import type { DateRange } from "react-day-picker"
import { PhoneIcon, SearchIcon, XIcon } from "lucide-react"

import { Calendar } from "~/components/ui/calendar"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "~/components/ui/combobox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "~/components/ui/input-group"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "~/components/ui/input-otp"
import { Label } from "~/components/ui/label"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "~/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Slider } from "~/components/ui/slider"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import {
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

const CLASSES = [
  { label: "Class 6 · Section A", value: "6a" },
  { label: "Class 6 · Section B", value: "6b" },
  { label: "Class 7 · Section A", value: "7a" },
  { label: "Class 7 · Section B", value: "7b" },
  { label: "Class 8 · Section A", value: "8a" },
  { label: "Class 9 · Science", value: "9sci" },
  { label: "Class 9 · Commerce", value: "9com" },
  { label: "Class 10 · Science", value: "10sci" },
]

const STUDENTS = [
  "Ayesha Rahman",
  "Rafi Ahmed",
  "Nusrat Jahan",
  "Tanvir Hasan",
  "Sadia Islam",
  "Arif Hossain",
  "Mehjabin Akter",
  "Fahim Chowdhury",
  "Tasnim Kabir",
  "Imran Sarker",
]

const SUBJECTS = [
  "Bangla",
  "English",
  "Mathematics",
  "General Science",
  "Bangladesh and Global Studies",
  "Religion and Moral Education",
  "ICT",
  "Physical Education",
]

// Pinned dates so the specimens are stable and prerender without reading the clock.
const TODAY = new Date(2026, 9, 20)
const MONTH = new Date(2026, 9, 1)

function SliderExamples() {
  const [passMark, setPassMark] = useState<readonly number[]>([33])
  const [feeRange, setFeeRange] = useState<readonly number[]>([1500, 4500])

  return (
    <FieldGroup>
      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="ds-pass-mark">Pass mark</FieldLabel>
          <span className="text-sm text-muted-foreground tabular-nums">
            {passMark[0]}%
          </span>
        </div>
        <Slider
          id="ds-pass-mark"
          value={passMark}
          onValueChange={(value) =>
            setPassMark(Array.isArray(value) ? value : [value as number])
          }
          max={100}
          step={1}
        />
        <FieldDescription>Board default is 33%.</FieldDescription>
      </Field>
      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Monthly tuition</FieldLabel>
          <span className="text-sm text-muted-foreground tabular-nums">
            ৳{feeRange[0]?.toLocaleString("en-US")} – ৳
            {feeRange[1]?.toLocaleString("en-US")}
          </span>
        </div>
        <Slider
          aria-label="Monthly tuition range"
          value={feeRange}
          onValueChange={(value) =>
            setFeeRange(Array.isArray(value) ? value : [value as number])
          }
          min={0}
          max={6000}
          step={100}
        />
        <FieldDescription>
          Filters the fee report to this band.
        </FieldDescription>
      </Field>
      <Field data-disabled>
        <FieldLabel>Late fee (locked)</FieldLabel>
        <Slider aria-label="Late fee" defaultValue={[20]} disabled />
      </Field>
    </FieldGroup>
  )
}

// Controlled on purpose: input-otp forwards `defaultValue` to its <input> next to
// its own `value`, which React reports as an error.
function OtpExamples() {
  const [code, setCode] = useState("4817")
  const [expiredCode, setExpiredCode] = useState("209381")

  return (
    <Example title="6 digits · invalid" frameClassName="flex-col items-start">
      <Field>
        <FieldLabel htmlFor="ds-otp">Code sent to 01712 ••• 678</FieldLabel>
        <InputOTP id="ds-otp" maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="ds-otp-bad">Verification code</FieldLabel>
        <InputOTP
          id="ds-otp-bad"
          maxLength={6}
          value={expiredCode}
          onChange={setExpiredCode}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <FieldError>That code has expired. Request a new one.</FieldError>
      </Field>
    </Example>
  )
}

function SingleDateCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 26))
  return (
    <div className="flex flex-col gap-2">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        defaultMonth={MONTH}
        today={TODAY}
        className="rounded-lg border"
      />
      <p className="text-sm text-muted-foreground">
        Exam day:{" "}
        {date
          ? date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "not set"}
      </p>
    </div>
  )
}

function RangeCalendar() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 9, 12),
    to: new Date(2026, 9, 16),
  })
  const format = (d?: Date) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "…"
  return (
    <div className="flex flex-col gap-2">
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        defaultMonth={MONTH}
        today={TODAY}
        className="rounded-lg border"
      />
      <p className="text-sm text-muted-foreground">
        Leave: {format(range?.from)} – {format(range?.to)}
      </p>
    </div>
  )
}

function StudentCombobox() {
  return (
    <Field>
      <FieldLabel htmlFor="ds-student-search">Student</FieldLabel>
      <Combobox items={STUDENTS} defaultValue="Ayesha Rahman">
        <ComboboxInput
          id="ds-student-search"
          placeholder="Search students…"
          showClear
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>No students found.</ComboboxEmpty>
          <ComboboxList>
            {(student: string) => (
              <ComboboxItem key={student} value={student}>
                {student}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription>Type a name; 1,284 students in 2026.</FieldDescription>
    </Field>
  )
}

function SubjectCombobox() {
  const anchor = useComboboxAnchor()
  return (
    <Field>
      <FieldLabel>Subjects taught</FieldLabel>
      <Combobox
        multiple
        autoHighlight
        items={SUBJECTS}
        defaultValue={["Mathematics", "ICT"]}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(values: string[]) => (
              <Fragment>
                {values.map((value) => (
                  <ComboboxChip key={value}>{value}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={values.length ? "" : "Add a subject"}
                  aria-label="Add a subject"
                />
              </Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No subjects found.</ComboboxEmpty>
          <ComboboxList>
            {(subject: string) => (
              <ComboboxItem key={subject} value={subject}>
                {subject}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

export function Inputs() {
  return (
    <ShowcaseSection
      id="inputs"
      title="Inputs"
      description="Form controls, from plain text fields to date pickers. Every control sits inside a Field that carries its label, help text and error."
    >
      <BlockGrid>
        <Block
          wide
          name="Field"
          when="Wraps a control with its label, description and error. A form is a FieldGroup of Fields; related choices sit in a FieldSet with a legend."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Example title="Admission form" frameClassName="block">
              <FieldSet>
                <FieldLegend>Student details</FieldLegend>
                <FieldDescription>
                  Class 7 · Section B, academic year 2026.
                </FieldDescription>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ds-student-name">
                      Full name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="ds-student-name"
                      required
                      defaultValue="Ayesha Rahman"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ds-guardian-phone">
                      Guardian phone
                    </FieldLabel>
                    <Input
                      id="ds-guardian-phone"
                      type="tel"
                      placeholder="01712 345678"
                    />
                    <FieldDescription>
                      Absence alerts go to this number.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </Example>
            <Example title="Invalid · disabled" frameClassName="block">
              <FieldGroup>
                <Field data-invalid>
                  <FieldLabel htmlFor="ds-roll">Roll number</FieldLabel>
                  <Input id="ds-roll" aria-invalid defaultValue="14" />
                  <FieldError>
                    Roll 14 is already taken in Class 7 · Section B.
                  </FieldError>
                </Field>
                <FieldSeparator>Set by the office</FieldSeparator>
                <Field data-disabled>
                  <FieldLabel htmlFor="ds-session">Academic year</FieldLabel>
                  <Input id="ds-session" disabled defaultValue="2026" />
                  <FieldDescription>
                    Only a school admin can change this.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </Example>
          </div>
        </Block>

        <Block
          name="Label"
          when="Names a control. In forms use FieldLabel; a bare Label suits a single inline control."
        >
          <Example title="Inline">
            <div className="flex items-center gap-2">
              <Checkbox id="ds-label-sms" defaultChecked />
              <Label htmlFor="ds-label-sms">Send SMS receipt to guardian</Label>
            </div>
          </Example>
        </Block>

        <Block
          name="Input"
          when="Single-line text: names, phone numbers, roll numbers, files."
        >
          <Example
            title="Default · disabled · invalid"
            frameClassName="flex-col items-stretch"
          >
            <Input
              aria-label="Guardian email"
              placeholder="guardian@example.com"
            />
            <Input
              aria-label="Student ID"
              disabled
              defaultValue="STU-2026-0412"
            />
            <Input
              aria-label="Admission date"
              aria-invalid
              defaultValue="31/02/2026"
            />
          </Example>
          <Example title="File" frameClassName="block">
            <Field>
              <FieldLabel htmlFor="ds-birth-cert">Birth certificate</FieldLabel>
              <Input id="ds-birth-cert" type="file" accept=".pdf,image/*" />
              <FieldDescription>PDF or photo, up to 5 MB.</FieldDescription>
            </Field>
          </Example>
        </Block>

        <Block
          name="Textarea"
          when="Multi-line text such as a notice or a teacher's remark. It grows with its content."
        >
          <Example title="Default · invalid" frameClassName="block">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ds-remark">Teacher remark</FieldLabel>
                <Textarea
                  id="ds-remark"
                  placeholder="Remark for the half-yearly report card"
                  defaultValue="Ayesha participates well in class. Needs more practice with fractions."
                />
              </Field>
              <Field data-invalid>
                <FieldLabel htmlFor="ds-notice">Notice</FieldLabel>
                <Textarea
                  id="ds-notice"
                  aria-invalid
                  placeholder="Write the notice"
                />
                <FieldError>A notice needs a message.</FieldError>
              </Field>
            </FieldGroup>
          </Example>
        </Block>

        <Block
          name="InputGroup"
          when="An input with addons: a currency, an icon, a count or an inline action."
        >
          <Example title="Addons" frameClassName="flex-col items-stretch">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by name or roll"
                aria-label="Search students"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>41 results</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>৳</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                inputMode="numeric"
                defaultValue="2,500"
                aria-label="Amount received"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Clear amount" size="icon-xs">
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <PhoneIcon />
                <InputGroupText>+880</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="tel"
                placeholder="1712 345678"
                aria-label="Guardian phone"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="secondary">Verify</InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupTextarea
                placeholder="Reply to the guardian…"
                aria-label="Reply"
              />
              <InputGroupAddon align="block-end">
                <InputGroupText>0 / 160</InputGroupText>
                <InputGroupButton
                  size="sm"
                  variant="default"
                  className="ml-auto"
                >
                  Send
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Example>
        </Block>

        <Block
          name="InputOTP"
          when="One-time codes for guardian sign-in and two-step checks."
        >
          <OtpExamples />
        </Block>

        <Block
          name="Checkbox"
          when="Independent on/off choices, such as which channels notify a guardian."
        >
          <Example title="Group · disabled · invalid" frameClassName="block">
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Notify guardians by</FieldLegend>
                <FieldGroup className="gap-3">
                  <Field orientation="horizontal">
                    <Checkbox id="ds-notify-sms" defaultChecked />
                    <FieldLabel htmlFor="ds-notify-sms" className="font-normal">
                      SMS
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox id="ds-notify-app" />
                    <FieldLabel htmlFor="ds-notify-app" className="font-normal">
                      Guardian app
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" data-disabled>
                    <Checkbox id="ds-notify-email" disabled />
                    <FieldLabel
                      htmlFor="ds-notify-email"
                      className="font-normal"
                    >
                      Email (no address on file)
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              </FieldSet>
              <Field orientation="horizontal" data-invalid>
                <Checkbox id="ds-consent" aria-invalid />
                <FieldContent>
                  <FieldLabel htmlFor="ds-consent">
                    Guardian consent received
                  </FieldLabel>
                  <FieldDescription>
                    Required before the admission is confirmed.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </Example>
        </Block>

        <Block
          name="RadioGroup"
          when="Exactly one of a few options that should all stay visible."
        >
          <Example title="Typical" frameClassName="block">
            <FieldSet>
              <FieldLegend variant="label">Payment method</FieldLegend>
              <RadioGroup defaultValue="mobile">
                <Field orientation="horizontal">
                  <RadioGroupItem value="cash" id="ds-pay-cash" />
                  <FieldLabel htmlFor="ds-pay-cash" className="font-normal">
                    Cash at the office
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="mobile" id="ds-pay-mobile" />
                  <FieldLabel htmlFor="ds-pay-mobile" className="font-normal">
                    Mobile banking
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal" data-disabled>
                  <RadioGroupItem value="card" id="ds-pay-card" disabled />
                  <FieldLabel htmlFor="ds-pay-card" className="font-normal">
                    Card (not enabled)
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
          </Example>
          <Example title="Choice cards" frameClassName="block">
            <RadioGroup defaultValue="monthly" aria-label="Fee plan">
              <FieldLabel htmlFor="ds-plan-monthly">
                <Field orientation="horizontal">
                  <FieldContent>
                    <span className="text-sm font-medium">Monthly</span>
                    <FieldDescription>৳2,500 due on the 10th.</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="monthly" id="ds-plan-monthly" />
                </Field>
              </FieldLabel>
              <FieldLabel htmlFor="ds-plan-yearly">
                <Field orientation="horizontal">
                  <FieldContent>
                    <span className="text-sm font-medium">Yearly</span>
                    <FieldDescription>
                      ৳27,000 for 2026, one payment.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="yearly" id="ds-plan-yearly" />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </Example>
        </Block>

        <Block
          name="Switch"
          when="A setting that takes effect immediately, like turning on absence alerts."
        >
          <Example title="Typical · small · disabled" frameClassName="block">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="ds-absence-sms">
                    Absence alerts
                  </FieldLabel>
                  <FieldDescription>
                    Sent at 9:15 AM to guardians of absent students.
                  </FieldDescription>
                </FieldContent>
                <Switch id="ds-absence-sms" defaultChecked />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="ds-weekly">
                  Weekly attendance summary
                </FieldLabel>
                <Switch id="ds-weekly" size="sm" />
              </Field>
              <Field orientation="horizontal" data-disabled>
                <FieldLabel htmlFor="ds-results">
                  Publish results to portal
                </FieldLabel>
                <Switch id="ds-results" disabled />
              </Field>
            </FieldGroup>
          </Example>
        </Block>

        <Block
          name="Slider"
          when="A value in a range where position matters more than the exact number. Pass an array: one value for one thumb, two for a range."
        >
          <Example title="Single · range · disabled" frameClassName="block">
            <SliderExamples />
          </Example>
        </Block>

        <Block
          name="Select"
          when="Picks one option from a short, known list such as a class or a term."
        >
          <Example
            title="Grouped · small"
            frameClassName="flex-col items-stretch"
          >
            <Select items={CLASSES} defaultValue="7b">
              <SelectTrigger aria-label="Class" className="w-full sm:w-64">
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Junior</SelectLabel>
                  {CLASSES.slice(0, 5).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Secondary</SelectLabel>
                  {CLASSES.slice(5).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select items={CLASSES}>
              <SelectTrigger
                size="sm"
                aria-label="Class (small)"
                className="w-full sm:w-64"
              >
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CLASSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Example>
        </Block>

        <Block
          name="NativeSelect"
          when="The browser's own select, for long lists or low-end phones."
        >
          <Example title="Grouped · invalid · disabled">
            <NativeSelect aria-label="Term" defaultValue="t1">
              <NativeSelectOptGroup label="2026">
                <NativeSelectOption value="t1">First term</NativeSelectOption>
                <NativeSelectOption value="t2">Half-yearly</NativeSelectOption>
                <NativeSelectOption value="final">Annual</NativeSelectOption>
              </NativeSelectOptGroup>
            </NativeSelect>
            <NativeSelect aria-label="Fee head" aria-invalid defaultValue="">
              <NativeSelectOption value="" disabled>
                Choose a fee head
              </NativeSelectOption>
              <NativeSelectOption value="tuition">Tuition</NativeSelectOption>
              <NativeSelectOption value="exam">Exam fee</NativeSelectOption>
              <NativeSelectOption value="transport">
                Transport
              </NativeSelectOption>
            </NativeSelect>
            <NativeSelect
              aria-label="Shift"
              size="sm"
              disabled
              defaultValue="morning"
            >
              <NativeSelectOption value="morning">
                Morning shift
              </NativeSelectOption>
              <NativeSelectOption value="day">Day shift</NativeSelectOption>
            </NativeSelect>
          </Example>
        </Block>

        <Block
          name="Combobox"
          when="Searches a long list, such as finding one student among a thousand. Use chips to pick several."
        >
          <Example title="Single" frameClassName="block">
            <StudentCombobox />
          </Example>
          <Example title="Multiple · chips" frameClassName="block">
            <SubjectCombobox />
          </Example>
        </Block>

        <Block
          wide
          name="Calendar"
          when="Picks a date or a span of dates: an exam day, a leave request, a fee due date. Usually shown inside a Popover."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Example
              title="Single date"
              frameClassName="justify-center overflow-x-auto"
            >
              <SingleDateCalendar />
            </Example>
            <Example
              title="Range"
              frameClassName="justify-center overflow-x-auto"
            >
              <RangeCalendar />
            </Example>
          </div>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
