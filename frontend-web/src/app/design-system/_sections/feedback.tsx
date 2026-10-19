"use client"

import {
  CircleAlertIcon,
  InboxIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  SendIcon,
} from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Progress, ProgressLabel, ProgressValue } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/components/ui/toast"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function publishResults() {
  const id = toast.add({
    title: "Publishing Class 8 results",
    description: "Sending report cards to 142 guardians…",
    type: "loading",
    timeout: 0,
  })
  void wait(2000).then(() =>
    toast.update(id, {
      title: "Class 8 results published",
      description: "142 guardians notified by SMS and the portal.",
      type: "success",
      timeout: 5000,
    })
  )
}

export function Feedback() {
  return (
    <ShowcaseSection
      id="feedback"
      eyebrow="Components"
      title="Feedback"
      description="Tell people what happened and what to do next, in one sentence, with the name or amount they care about."
    >
      <BlockGrid>
        <Block
          name="Alert"
          when="An inline callout that stays on the page until the situation changes. Red only for absences, dues and errors."
          wide
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Example title="default" frameClassName="p-4">
              <Alert>
                <MegaphoneIcon />
                <AlertTitle>Half-yearly exams start Sunday</AlertTitle>
                <AlertDescription>
                  Seat plans for Classes 6–10 are ready to print from the Exams page.
                </AlertDescription>
              </Alert>
            </Example>
            <Example title="destructive" frameClassName="p-4">
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>৳1,24,500 overdue this month</AlertTitle>
                <AlertDescription>
                  38 students have fees more than 15 days late.
                </AlertDescription>
              </Alert>
            </Example>
            <Example title="with action" frameClassName="p-4">
              <Alert>
                <ReceiptTextIcon />
                <AlertTitle>Fee reminders are ready</AlertTitle>
                <AlertDescription>One SMS to each guardian with dues.</AlertDescription>
                <AlertAction>
                  <Button size="xs">Send</Button>
                </AlertAction>
              </Alert>
            </Example>
          </div>
          <Example title="long text" frameClassName="p-4">
            <Alert>
              <MegaphoneIcon />
              <AlertTitle>
                Notice from the headteacher about the revised schedule for the annual sports day
                and cultural programme
              </AlertTitle>
              <AlertDescription>
                Because of the forecast rain on Thursday, the sports day moves to the following
                Saturday. Classes run as usual on Thursday, and guardians who already booked leave
                can collect their children at 1:00 PM instead.
              </AlertDescription>
            </Alert>
          </Example>
        </Block>

        <Block
          name="Toast"
          when="A short confirmation after an action, which goes away on its own. Never for something people must act on."
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
                  title: "Couldn't send the SMS",
                  description: "Your SMS credit is used up. Top up to send 38 reminders.",
                  type: "error",
                })
              }
            >
              Error
            </Button>
            <Button variant="outline" onClick={publishResults}>
              Loading, then success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.add({
                  title: "Notice scheduled",
                  description: "Goes out to all guardians tomorrow at 8:00 AM.",
                })
              }
            >
              Default
            </Button>
          </Example>
        </Block>

        <Block name="Progress" when="How far a known task has got: a fee collection target, an upload, a term.">
          <Example title="labeled" frameClassName="flex-col items-stretch gap-6">
            <Progress value={72}>
              <ProgressLabel>October fee collection</ProgressLabel>
              <ProgressValue />
            </Progress>
            <Progress value={38}>
              <ProgressLabel>Report cards printed</ProgressLabel>
              <ProgressValue />
            </Progress>
            <Progress value={100}>
              <ProgressLabel>Class 10 marks entered</ProgressLabel>
              <ProgressValue />
            </Progress>
          </Example>
        </Block>

        <Block name="Spinner" when="Work of unknown length. Inside a button, it replaces the leading icon and the button is disabled.">
          <Example title="sizes and in a button">
            <Spinner className="size-3" />
            <Spinner />
            <Spinner className="size-6" />
            <Button disabled>
              <Spinner data-icon="inline-start" />
              Sending reminders
            </Button>
            <Button variant="outline" disabled>
              <Spinner data-icon="inline-start" />
              Saving
            </Button>
          </Example>
        </Block>

        <Block name="Skeleton" when="The shape of content that is loading, so the layout doesn't jump on a slow connection.">
          <Example title="card and list" frameClassName="flex-col items-stretch gap-4">
            <Card size="sm">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Example>
        </Block>

        <Block name="Empty" when="Nothing to show yet. Say why, and offer the one action that fills it.">
          <Example title="with action" frameClassName="p-0">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>No notices yet</EmptyTitle>
                <EmptyDescription>
                  Notices you send to guardians and staff will appear here.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button>
                  <SendIcon data-icon="inline-start" />
                  Write a notice
                </Button>
              </EmptyContent>
            </Empty>
          </Example>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Dues for Class 9</CardTitle>
              <CardDescription>Empty inside a card</CardDescription>
            </CardHeader>
            <CardContent>
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyTitle>Everyone is paid up</EmptyTitle>
                  <EmptyDescription>No dues for October. Nice work.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
