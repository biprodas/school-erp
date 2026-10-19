"use client"

import { MailIcon, PhoneIcon, SearchIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Calendar } from "~/components/ui/calendar"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox"
import { DirectionProvider } from "~/components/ui/direction"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
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
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "~/components/ui/input-otp"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "~/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Slider } from "~/components/ui/slider"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"
import { previewState, StateMatrix } from "../_showcase/state-matrix"

const FIELD_STATES = ["default", "disabled", "invalid"]

const CLASSES = [
  { label: "Class 6", value: "6" },
  { label: "Class 7", value: "7" },
  { label: "Class 8", value: "8" },
  { label: "Class 9 · Science", value: "9-sci" },
  { label: "Class 9 · Commerce", value: "9-com" },
  { label: "Class 10 · Science", value: "10-sci" },
]

const STUDENTS = [
  "Rafi Ahmed",
  "Nusrat Jahan",
  "Tanvir Hasan",
  "Sadia Islam",
  "Arif Hossain",
  "Mehjabin Akter",
  "Fahim Chowdhury",
]

function invalid(state: string) {
  return state === "invalid" || undefined
}

function SliderField() {
  const [pass, setPass] = useState([33])
  return (
    <Field>
      <FieldLabel htmlFor="pass-mark">Pass mark · {pass[0]}%</FieldLabel>
      <Slider
        id="pass-mark"
        value={pass}
        onValueChange={(value) => setPass(Array.isArray(value) ? [...value] : [value])}
        max={100}
        step={1}
      />
      <FieldDescription>Board default is 33%.</FieldDescription>
    </Field>
  )
}

function CalendarExample() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 21))
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      defaultMonth={new Date(2026, 9, 1)}
      // Pinned so the specimen is stable and prerenders without reading the clock.
      today={new Date(2026, 9, 19)}
      className="rounded-xl ring-1 ring-border"
    />
  )
}

function StudentCombobox({ empty = false }: { empty?: boolean }) {
  return (
    <Combobox items={empty ? [] : STUDENTS}>
      <ComboboxInput
        placeholder={empty ? "Search Class 12…" : "Search students…"}
        aria-label="Student"
        showClear
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
  )
}

export function Inputs() {
  return (
    <ShowcaseSection
      id="inputs"
      eyebrow="Components · Inputs"
      title="Inputs"
      description="Fields are 40px, on paper, with a strong hairline. Focus adds the forest ring; errors turn the border red and say what to fix."
    >
      <BlockGrid>
        <Block
          wide
          name="Field"
          when="Wraps every form control with its label, description and error. Forms are a FieldGroup of Fields."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Example title="Typical · admission form" frameClassName="block">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ds-student-name">
                    Student name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input id="ds-student-name" required defaultValue="Nusrat Jahan" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ds-guardian-phone">Guardian phone</FieldLabel>
                  <Input id="ds-guardian-phone" type="tel" placeholder="01712 345678" />
                  <FieldDescription>Absence SMS goes to this number.</FieldDescription>
                </Field>
              </FieldGroup>
            </Example>
            <Example title="Error · disabled" frameClassName="block">
              <FieldGroup>
                <Field data-invalid>
                  <FieldLabel htmlFor="ds-roll">Roll number</FieldLabel>
                  <Input id="ds-roll" aria-invalid defaultValue="14" />
                  <FieldError>Roll 14 is already taken in Class 7 · B.</FieldError>
                </Field>
                <Field data-disabled>
                  <FieldLabel htmlFor="ds-session">Session</FieldLabel>
                  <Input id="ds-session" disabled defaultValue="2026" />
                  <FieldDescription>Set by the school admin.</FieldDescription>
                </Field>
              </FieldGroup>
            </Example>
          </div>
        </Block>

        <Block wide name="Input" when="Single-line text: names, phone numbers, amounts.">
          <Example title="State matrix" frameClassName="block">
            <StateMatrix
              rows={["input"] as const}
              states={FIELD_STATES}
              render={(_, state) => (
                <Input
                  aria-label="Guardian email"
                  placeholder="guardian@example.com"
                  aria-invalid={invalid(state)}
                  {...previewState(state)}
                />
              )}
            />
          </Example>
        </Block>

        <Block name="Label" when="Names a control. Inside forms, use FieldLabel; Label alone suits inline controls.">
          <Example title="Inline">
            <div className="flex items-center gap-2">
              <Checkbox id="ds-label-sms" defaultChecked />
              <Label htmlFor="ds-label-sms">Send SMS receipt</Label>
            </div>
          </Example>
        </Block>

        <Block name="InputGroup" when="An input with addons: a currency, an icon, or an inline action.">
          <Example title="Addons" frameClassName="flex-col items-stretch">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search by name or roll" aria-label="Search students" />
              <InputGroupAddon align="inline-end">
                <InputGroupText>124 results</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>৳</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput inputMode="numeric" defaultValue="4,020" aria-label="Amount received" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Clear amount" size="icon-xs">
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupTextarea placeholder="Reply to the guardian…" aria-label="Reply" />
              <InputGroupAddon align="block-end">
                <InputGroupText>0 / 160 characters</InputGroupText>
                <InputGroupButton size="sm" variant="default" className="ml-auto">
                  Send
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Example>
        </Block>

        <Block name="Textarea" when="Multi-line text such as a notice or a teacher's remark.">
          <Example title="State matrix" frameClassName="block">
            <StateMatrix
              rows={["textarea"] as const}
              states={["default", "disabled", "invalid"]}
              render={(_, state) => (
                <Textarea
                  aria-label="Teacher remark"
                  placeholder="Remark for the report card"
                  aria-invalid={invalid(state)}
                  {...previewState(state)}
                />
              )}
            />
          </Example>
        </Block>

        <Block name="Select" when="Picks one option from a short known list, such as a class or a term.">
          <Example title="Typical · sizes" frameClassName="flex-col items-start">
            <Select items={CLASSES} defaultValue="7">
              <SelectTrigger aria-label="Class" className="w-56">
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Junior</SelectLabel>
                  {CLASSES.slice(0, 3).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Secondary</SelectLabel>
                  {CLASSES.slice(3).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select items={CLASSES}>
              <SelectTrigger size="sm" aria-label="Class (small)" className="w-56">
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

        <Block name="NativeSelect" when="The browser's own select, for long lists on low-end phones.">
          <Example title="Typical · invalid">
            <NativeSelect aria-label="Term" defaultValue="t1">
              <NativeSelectOptGroup label="2026">
                <NativeSelectOption value="t1">First term</NativeSelectOption>
                <NativeSelectOption value="t2">Second term</NativeSelectOption>
                <NativeSelectOption value="final">Final</NativeSelectOption>
              </NativeSelectOptGroup>
            </NativeSelect>
            <NativeSelect aria-label="Fee head" aria-invalid defaultValue="">
              <NativeSelectOption value="" disabled>
                Choose a fee head
              </NativeSelectOption>
              <NativeSelectOption value="tuition">Tuition</NativeSelectOption>
              <NativeSelectOption value="exam">Exam fee</NativeSelectOption>
            </NativeSelect>
          </Example>
        </Block>

        <Block name="Combobox" when="Searches a long list, such as finding one student among 900.">
          <Example title="Typical" frameClassName="block">
            <StudentCombobox />
          </Example>
          <Example title="Edge case · no matches" frameClassName="block">
            <StudentCombobox empty />
          </Example>
        </Block>

        <Block name="Checkbox" when="Turns independent options on or off, such as which guardians get SMS.">
          <Example title="State matrix" frameClassName="block">
            <StateMatrix
              rows={["unchecked", "checked"] as const}
              states={["default", "disabled", "invalid"]}
              render={(row, state) => (
                <Checkbox
                  aria-label="Notify guardian"
                  defaultChecked={row === "checked"}
                  aria-invalid={invalid(state)}
                  {...previewState(state)}
                />
              )}
            />
          </Example>
          <Example title="Group" frameClassName="block">
            <FieldSet>
              <FieldLegend variant="label">Notify by</FieldLegend>
              <FieldGroup className="gap-3">
                <Field orientation="horizontal">
                  <Checkbox id="ds-notify-sms" defaultChecked />
                  <FieldLabel htmlFor="ds-notify-sms" className="font-normal">
                    SMS
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="ds-notify-app" defaultChecked />
                  <FieldLabel htmlFor="ds-notify-app" className="font-normal">
                    Guardian app
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal" data-disabled>
                  <Checkbox id="ds-notify-email" disabled />
                  <FieldLabel htmlFor="ds-notify-email" className="font-normal">
                    Email (no address on file)
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>
          </Example>
        </Block>

        <Block name="RadioGroup" when="Picks exactly one of a few options that should all stay visible.">
          <Example title="Typical" frameClassName="block">
            <FieldSet>
              <FieldLegend variant="label">Payment method</FieldLegend>
              <RadioGroup defaultValue="bkash">
                <Field orientation="horizontal">
                  <RadioGroupItem value="cash" id="ds-pay-cash" />
                  <FieldLabel htmlFor="ds-pay-cash" className="font-normal">
                    Cash at the office
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="bkash" id="ds-pay-bkash" />
                  <FieldLabel htmlFor="ds-pay-bkash" className="font-normal">
                    bKash
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal" data-disabled>
                  <RadioGroupItem value="card" id="ds-pay-card" disabled />
                  <FieldLabel htmlFor="ds-pay-card" className="font-normal">
                    Card (Basic plan and up)
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
          </Example>
        </Block>

        <Block name="Switch" when="A setting that takes effect immediately, like turning on absence SMS.">
          <Example title="Typical · sizes · disabled" frameClassName="block">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="ds-auto-sms">Absence SMS</FieldLabel>
                  <FieldDescription>Sent at 9:15 AM to guardians of absent students.</FieldDescription>
                </FieldContent>
                <Switch id="ds-auto-sms" defaultChecked />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="ds-weekly">Weekly summary</FieldLabel>
                <Switch id="ds-weekly" size="sm" />
              </Field>
              <Field orientation="horizontal" data-disabled>
                <FieldLabel htmlFor="ds-2fa">Two-factor sign-in (Premium)</FieldLabel>
                <Switch id="ds-2fa" disabled />
              </Field>
            </FieldGroup>
          </Example>
        </Block>

        <Block name="Slider" when="Picks a value in a range where the exact number matters less than the position.">
          <Example title="Typical" frameClassName="block">
            <SliderField />
          </Example>
        </Block>

        <Block name="InputOTP" when="One-time codes for guardian sign-in and two-factor checks.">
          <Example title="Typical · invalid" frameClassName="flex-col items-start">
            <Field>
              <FieldLabel htmlFor="ds-otp">Code sent to 01712 ••• 678</FieldLabel>
              <InputOTP id="ds-otp" maxLength={6} defaultValue="4817">
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
              <FieldLabel htmlFor="ds-otp-bad">Wrong code</FieldLabel>
              <InputOTP id="ds-otp-bad" maxLength={4} defaultValue="1234">
                <InputOTPGroup>
                  <InputOTPSlot index={0} aria-invalid />
                  <InputOTPSlot index={1} aria-invalid />
                  <InputOTPSlot index={2} aria-invalid />
                  <InputOTPSlot index={3} aria-invalid />
                </InputOTPGroup>
              </InputOTP>
              <FieldError>That code has expired. Request a new one.</FieldError>
            </Field>
          </Example>
        </Block>

        <Block name="Calendar" when="Picks a date: an exam day, a leave start, a fee due date.">
          <Example title="Single date">
            <CalendarExample />
          </Example>
        </Block>

        <Block wide name="RTL" when="Components follow the reading direction. Wrap with DirectionProvider and set dir on the container.">
          <Example title="dir=rtl" frameClassName="block">
            <DirectionProvider direction="rtl">
              <div dir="rtl" className="flex flex-col gap-4">
                <InputGroup>
                  <InputGroupAddon>
                    <MailIcon />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="guardian@example.com" aria-label="Email (RTL)" />
                </InputGroup>
                <Field orientation="horizontal">
                  <Switch id="ds-rtl-switch" defaultChecked />
                  <FieldLabel htmlFor="ds-rtl-switch">
                    <PhoneIcon data-icon="inline-start" />
                    SMS alerts
                  </FieldLabel>
                </Field>
                <Slider defaultValue={[60]} aria-label="Volume (RTL)" />
              </div>
            </DirectionProvider>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
