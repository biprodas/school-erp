"use client"

import {
  CalendarCheckIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  RotateCwIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "~/components/ui/attachment"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Bubble, BubbleContent, BubbleReactions } from "~/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "~/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "~/components/ui/message-scroller"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "~/components/ui/questionnaire"
import { toast } from "~/components/ui/toast"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "~/components/ui/trace"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"

function Guardian({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <Message align="start">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>KA</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Kamal Ahmed · Rafi&apos;s father</MessageHeader>
        {children}
        <MessageFooter>{time}</MessageFooter>
      </MessageContent>
    </Message>
  )
}

function Teacher({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <Message align="end">
      <MessageContent>
        {children}
        <MessageFooter>{time} · Seen</MessageFooter>
      </MessageContent>
    </Message>
  )
}

function Thread() {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="h-[28rem]">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-5 p-4">
            <MessageScrollerItem messageId="m0">
              <Marker variant="separator">
                <MarkerContent>Today</MarkerContent>
              </Marker>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="m1">
              <Marker>
                <MarkerIcon>
                  <CalendarCheckIcon />
                </MarkerIcon>
                <MarkerContent>
                  Rafi marked absent in Class 7 B at 9:05 AM. SMS sent at 9:15 AM.
                </MarkerContent>
              </Marker>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="m2">
              <Guardian time="9:21 AM">
                <Bubble variant="secondary">
                  <BubbleContent lang="bn">
                    আসসালামু আলাইকুম। রাফি আজ স্কুলে গেছে, তাকে অনুপস্থিত দেখাচ্ছে কেন?
                  </BubbleContent>
                </Bubble>
                <Bubble variant="secondary">
                  <BubbleContent>He left home at 7:45 with his cousin.</BubbleContent>
                </Bubble>
              </Guardian>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="m3" scrollAnchor>
              <Teacher time="9:30 AM">
                <Bubble align="end">
                  <BubbleContent>
                    Sorry for the worry. Rafi came in at 9:25 after assembly, so the register
                    had already gone. I&apos;ve marked him late instead.
                  </BubbleContent>
                  <BubbleReactions side="bottom" align="end">
                    <Badge variant="secondary">🙏 1</Badge>
                  </BubbleReactions>
                </Bubble>
              </Teacher>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="m4">
              <Guardian time="9:34 AM">
                <Attachment state="done" className="max-w-xs">
                  <AttachmentMedia variant="icon">
                    <FileTextIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>bus-delay-note.pdf</AttachmentTitle>
                    <AttachmentDescription>PDF · 180 KB</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction aria-label="Download bus-delay-note.pdf">
                      <DownloadIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
                <Bubble variant="secondary">
                  <BubbleContent>Thank you. The school bus was late, here is the note.</BubbleContent>
                </Bubble>
              </Guardian>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="m5">
              <Marker variant="border">
                <MarkerContent>Attendance corrected by Ms. Farzana · 9:36 AM</MarkerContent>
              </Marker>
            </MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export function Conversation() {
  return (
    <ShowcaseSection
      id="conversation"
      eyebrow="Components"
      title="Conversation"
      description="Guardian messages, system notes and the absence form. Bangla and English sit in the same bubble style."
    >
      <BlockGrid>
        <Block
          name="Message thread"
          when="MessageScroller holds the thread, Message lays out each row, Bubble is the surface, Marker the notes between."
          wide
        >
          <Example frameClassName="block p-0">
            <Thread />
          </Example>
        </Block>

        <Block name="Bubble" when="The message surface. Secondary for others, default for you, destructive for a failed send.">
          <Example title="variants" frameClassName="flex-col items-stretch">
            <MessageGroup className="flex flex-col gap-2">
              {(["default", "secondary", "muted", "tinted", "outline", "ghost", "destructive"] as const).map(
                (variant) => (
                  <Message key={variant} align={variant === "default" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant={variant} align={variant === "default" ? "end" : "start"}>
                        <BubbleContent>
                          {variant === "destructive"
                            ? "Not sent. Tap to retry."
                            : `Fee reminder for October (${variant})`}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                )
              )}
            </MessageGroup>
          </Example>
        </Block>

        <Block name="Attachment" when="Files on a message, with their real upload state.">
          <Example title="states" frameClassName="flex-col items-stretch">
            <Attachment state="uploading">
              <AttachmentMedia variant="icon">
                <ImageIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>prescription.jpg</AttachmentTitle>
                <AttachmentDescription>Uploading · 64%</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
            <Attachment state="error">
              <AttachmentMedia variant="icon">
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>admission-form-scan.pdf</AttachmentTitle>
                <AttachmentDescription>Too large. The limit is 5 MB.</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Retry upload">
                  <RotateCwIcon />
                </AttachmentAction>
                <AttachmentAction aria-label="Remove attachment">
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          </Example>
          <Example title="group, small">
            <AttachmentGroup>
              {["result-class-8.pdf", "seat-plan.pdf", "routine-oct.pdf"].map((name) => (
                <Attachment key={name} size="sm" state="done">
                  <AttachmentMedia variant="icon">
                    <FileTextIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{name}</AttachmentTitle>
                  </AttachmentContent>
                </Attachment>
              ))}
            </AttachmentGroup>
          </Example>
        </Block>

        <Block name="Marker" when="System notes and dividers between messages, not activity.">
          <Example title="variants" frameClassName="flex-col items-stretch gap-4">
            <Marker variant="separator">
              <MarkerContent>Yesterday</MarkerContent>
            </Marker>
            <Marker>
              <MarkerIcon>
                <MessageSquareIcon />
              </MarkerIcon>
              <MarkerContent>Ms. Farzana joined the conversation</MarkerContent>
            </Marker>
            <Marker variant="border">
              <MarkerContent>Results for Class 8 published · 4:10 PM</MarkerContent>
            </Marker>
          </Example>
        </Block>

        <Block name="Trace" when="What the system did on someone's behalf: one line per step, with its status.">
          <Example title="statuses" frameClassName="flex-col items-start">
            <Trace>
              <TraceLine>
                <TraceIcon>
                  <CalendarCheckIcon />
                </TraceIcon>
                <TraceTitle>Checked Class 7 B register</TraceTitle>
                <TraceDescription>44 students</TraceDescription>
              </TraceLine>
              <TraceCollapsible>
                <TraceCollapsibleTrigger>
                  <TraceLine>
                    <TraceIcon>
                      <SendIcon />
                    </TraceIcon>
                    <TraceTitle>Sent absence SMS</TraceTitle>
                    <TraceDescription>3 guardians</TraceDescription>
                  </TraceLine>
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent>
                  <ul className="flex flex-col gap-1 py-1 ps-6 type-caption text-muted-foreground">
                    <li>Kamal Ahmed · 01711-234567 · delivered</li>
                    <li>Shirin Akter · 01819-552210 · delivered</li>
                    <li>Mizanur Rahman · 01552-908877 · delivered</li>
                  </ul>
                </TraceCollapsibleContent>
              </TraceCollapsible>
              <TraceLine status="running">
                <TraceIcon>
                  <FileTextIcon />
                </TraceIcon>
                <TraceTitle>Generating report cards</TraceTitle>
              </TraceLine>
              <TraceLine status="error">
                <TraceIcon>
                  <SendIcon />
                </TraceIcon>
                <TraceTitle>Failed to send fee reminders</TraceTitle>
                <TraceDescription>SMS credit used up</TraceDescription>
              </TraceLine>
              <TraceLine status="pending">
                <TraceIcon>
                  <CalendarCheckIcon />
                </TraceIcon>
                <TraceTitle>Close the month&apos;s attendance</TraceTitle>
              </TraceLine>
            </Trace>
          </Example>
        </Block>

        <Block name="Questionnaire" when="A short step-by-step form, like a guardian explaining an absence from the SMS link.">
          <Example frameClassName="block">
            <Questionnaire
              onSubmit={(event) => {
                event.preventDefault()
                toast.add({
                  title: "Reason sent to Ms. Farzana",
                  description: "Rafi's absence on 19 October is now explained.",
                  type: "success",
                })
              }}
            >
              <QuestionnaireProgress />
              <QuestionnaireItem name="reason" required>
                <QuestionnaireTitle>Why was Rafi absent today?</QuestionnaireTitle>
                <QuestionnaireDescription>His class teacher sees your answer.</QuestionnaireDescription>
                <QuestionnaireChoices>
                  <QuestionnaireChoice value="sick">
                    Sick
                    <QuestionnaireChoiceDescription>Fever, cold or a doctor&apos;s visit</QuestionnaireChoiceDescription>
                  </QuestionnaireChoice>
                  <QuestionnaireChoice value="family">Family reason</QuestionnaireChoice>
                  <QuestionnaireChoice value="transport">Transport problem</QuestionnaireChoice>
                  <QuestionnaireChoice value="present">He was at school</QuestionnaireChoice>
                </QuestionnaireChoices>
                <QuestionnaireError>Choose a reason to continue.</QuestionnaireError>
              </QuestionnaireItem>
              <QuestionnaireItem name="note">
                <QuestionnaireTitle>Anything to add?</QuestionnaireTitle>
                <QuestionnaireInput placeholder="For example: back on Sunday" />
              </QuestionnaireItem>
              <QuestionnaireActions>
                <QuestionnairePrevious />
                <QuestionnaireSkip />
                <QuestionnaireNext />
                <QuestionnaireSubmit>Send reason</QuestionnaireSubmit>
              </QuestionnaireActions>
            </Questionnaire>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
