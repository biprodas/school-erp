"use client"

import { AlertCircleIcon, InfoIcon, UsersIcon } from "lucide-react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/components/ui/toast"
import {
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

function publishResults() {
  const id = toast.add({
    title: "Publishing Class 8 results",
    description: "Sending report cards to 142 guardians…",
    type: "loading",
    timeout: 0,
  })
  window.setTimeout(() => {
    toast.update(id, {
      title: "Class 8 results published",
      description: "142 guardians notified.",
      type: "success",
      timeout: 5000,
    })
  }, 2000)
}

function removeStudent() {
  toast.add({
    title: "Rafi Ahmed removed from Section B",
    description: "The record is kept in the archive.",
    actionProps: {
      children: "Undo",
      onClick: () =>
        toast.add({
          title: "Rafi Ahmed restored",
          description: "Back in Class 7 · Section B.",
          type: "success",
        }),
    },
  })
}

export function Feedback() {
  return (
    <ShowcaseSection
      id="feedback"
      title="Feedback"
      description="Tell people what happened, what is happening, and what to do next: alerts, progress, loading states, empty states and toasts."
    >
      <BlockGrid>
        <Block
          name="Alert"
          when="A message that stays on the page until the situation changes."
        >
          <Example frameClassName="flex-col items-stretch">
            <Alert>
              <InfoIcon />
              <AlertTitle>Half-yearly exams start 3 November</AlertTitle>
              <AlertDescription>
                Seat plans for Class 6 to 10 are published on the notice board.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>12 students have unpaid October fees</AlertTitle>
              <AlertDescription>
                ৳42,000 is outstanding for Class 7 · Section B.
              </AlertDescription>
              <AlertAction>
                <Button variant="outline" size="xs">
                  Review
                </Button>
              </AlertAction>
            </Alert>
          </Example>
        </Block>

        <Block
          name="Progress"
          when="How far a known task has got: a fee collection target, an import, a term."
        >
          <Example frameClassName="flex-col items-stretch gap-6">
            <Progress value={78}>
              <ProgressLabel>October fee collection</ProgressLabel>
              <ProgressValue />
            </Progress>
            <Progress value={93}>
              <ProgressLabel>Attendance today</ProgressLabel>
              <ProgressValue />
            </Progress>
            <Progress value={35} aria-label="Importing students" />
          </Example>
        </Block>

        <Block
          name="Spinner"
          when="Work of unknown length, inline with the thing that is waiting."
        >
          <Example title="sizes">
            <Spinner className="size-3" />
            <Spinner />
            <Spinner className="size-6" />
            <Spinner className="size-8 text-muted-foreground" />
          </Example>
          <Example title="in a button">
            <Button disabled>
              <Spinner data-icon="inline-start" />
              Saving attendance
            </Button>
          </Example>
        </Block>

        <Block
          name="Skeleton"
          when="The shape of content that is about to load, so the layout doesn't jump."
        >
          <Example frameClassName="block">
            <div className="flex flex-col gap-4 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
              <Skeleton className="h-8 w-28 self-end" />
            </div>
          </Example>
        </Block>

        <Block
          name="Empty"
          when="Nothing to show yet. Say why and offer the next step."
        >
          <Example frameClassName="block">
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>No students in this section yet</EmptyTitle>
                <EmptyDescription>
                  Class 7 · Section C has no enrolled students. Add them one by
                  one or import a spreadsheet.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm">Add student</Button>
                  <Button size="sm" variant="outline">
                    Import
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          </Example>
        </Block>

        <Block
          name="Toast"
          when="A brief confirmation after an action. It goes away on its own."
        >
          <Example title="types">
            <Button
              variant="outline"
              onClick={() =>
                toast.add({
                  title: "Attendance saved",
                  description: "Class 7 · Section B, 41 of 44 present.",
                  type: "success",
                })
              }
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.add({
                  title: "Notice scheduled",
                  description: "Goes out to all guardians tomorrow at 8:00 AM.",
                  type: "info",
                })
              }
            >
              Info
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.add({
                  title: "SMS credit is low",
                  description:
                    "38 messages left. Top up before sending fee reminders.",
                  type: "warning",
                })
              }
            >
              Warning
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.add({
                  title: "Couldn't record the payment",
                  description:
                    "Receipt ৳3,500 for Ayesha Rahman was not saved. Try again.",
                  type: "error",
                })
              }
            >
              Error
            </Button>
            <Button variant="outline" onClick={publishResults}>
              Loading, then success
            </Button>
          </Example>
          <Example title="with action">
            <Button variant="outline" onClick={removeStudent}>
              Remove student
            </Button>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
