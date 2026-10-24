"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import {
  BellIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  ReceiptIcon,
  RotateCwIcon,
  SendIcon,
  ThumbsUpIcon,
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
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "~/components/ui/bubble"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "~/components/ui/input-group"
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
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

/** Incoming: the guardian, on the left with an avatar. */
function Guardian({ children, time }: { children: ReactNode; time: string }) {
  return (
    <Message align="start">
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>NR</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Nasrin Rahman · Ayesha&apos;s mother</MessageHeader>
        {children}
        <MessageFooter>{time}</MessageFooter>
      </MessageContent>
    </Message>
  )
}

/** Outgoing: the signed-in teacher, on the right. */
function Teacher({
  children,
  footer,
}: {
  children: ReactNode
  footer: string
}) {
  return (
    <Message align="end">
      <MessageContent>
        {children}
        <MessageFooter>{footer}</MessageFooter>
      </MessageContent>
    </Message>
  )
}

function HomeworkPhoto() {
  return (
    <Attachment orientation="vertical" className="w-36">
      <AttachmentMedia variant="image">
        <div className="flex size-full items-center justify-center bg-chart-2/20 text-chart-2">
          <ImageIcon />
        </div>
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>math-hw-p42.jpg</AttachmentTitle>
        <AttachmentDescription>JPG · 1.2 MB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  )
}

function FeeReceipt() {
  return (
    <Attachment className="max-w-xs">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>receipt-oct-2026-0412.pdf</AttachmentTitle>
        <AttachmentDescription>
          PDF · 86 KB · ৳ 2,500 paid
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Download receipt-oct-2026-0412.pdf">
          <DownloadIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}

function Thread() {
  const [draft, setDraft] = useState("")
  const [sent, setSent] = useState<string[]>([])

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSent((previous) => [...previous, text])
    setDraft("")
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Avatar>
          <AvatarFallback>NR</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">Nasrin Rahman</span>
          <span className="truncate text-xs text-muted-foreground">
            Guardian of Ayesha Rahman · Class 7 · Section B
          </span>
        </div>
      </div>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="h-[28rem]">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-5 p-4">
              <MessageScrollerItem messageId="day-yesterday">
                <Marker variant="separator">
                  <MarkerContent>Yesterday</MarkerContent>
                </Marker>
              </MessageScrollerItem>
              <MessageScrollerItem messageId="m1">
                <Guardian time="7:42 PM">
                  <Bubble variant="secondary">
                    <BubbleContent>
                      Assalamu alaikum. Ayesha says she lost the worksheet for
                      page 42. Is a photo of her answers okay?
                    </BubbleContent>
                  </Bubble>
                  <HomeworkPhoto />
                </Guardian>
              </MessageScrollerItem>
              <MessageScrollerItem messageId="m2">
                <Teacher footer="8:05 PM · Seen">
                  <Bubble align="end" className="mb-3">
                    <BubbleContent>
                      Walaikum assalam. Yes, the photo is fine. I&apos;ll mark
                      it tomorrow.
                    </BubbleContent>
                    <BubbleReactions align="start">
                      <ThumbsUpIcon
                        className="size-3.5"
                        aria-label="Liked by Nasrin Rahman"
                      />
                    </BubbleReactions>
                  </Bubble>
                </Teacher>
              </MessageScrollerItem>

              <MessageScrollerItem messageId="day-today">
                <Marker variant="separator">
                  <MarkerContent>Today</MarkerContent>
                </Marker>
              </MessageScrollerItem>
              <MessageScrollerItem messageId="m3">
                <Marker variant="border">
                  <MarkerIcon>
                    <ReceiptIcon />
                  </MarkerIcon>
                  <MarkerContent>
                    October tuition of ৳ 2,500 received by the accounts office ·
                    9:10 AM
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>
              <MessageScrollerItem messageId="new" scrollAnchor>
                <Marker
                  variant="separator"
                  className="font-medium text-primary before:bg-primary/40 after:bg-primary/40"
                >
                  <MarkerContent>New messages</MarkerContent>
                </Marker>
              </MessageScrollerItem>
              <MessageScrollerItem messageId="m4">
                <Guardian time="9:24 AM">
                  <Bubble variant="secondary">
                    <BubbleContent>
                      I paid this morning. Here is the receipt in case the
                      office asks.
                    </BubbleContent>
                  </Bubble>
                  <FeeReceipt />
                  <Bubble variant="secondary">
                    <BubbleContent>
                      Also, can Ayesha leave at 12:30 on Thursday? She has a
                      dentist appointment.
                    </BubbleContent>
                  </Bubble>
                </Guardian>
              </MessageScrollerItem>
              {sent.map((text, index) => (
                <MessageScrollerItem key={index} messageId={`sent-${index}`}>
                  <Teacher footer="Just now · Sent">
                    <Bubble align="end">
                      <BubbleContent>{text}</BubbleContent>
                    </Bubble>
                  </Teacher>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form onSubmit={send} className="border-t p-3">
        <InputGroup>
          <InputGroupTextarea
            aria-label="Message to Nasrin Rahman"
            placeholder="Write to Nasrin Rahman…"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <InputGroupAddon align="block-end">
            <InputGroupButton size="icon-xs" aria-label="Attach a file">
              <PaperclipIcon />
            </InputGroupButton>
            <InputGroupText className="hidden text-xs sm:flex">
              Guardians see replies in the app and by SMS
            </InputGroupText>
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-xs"
              className="ml-auto"
              aria-label="Send message"
              disabled={!draft.trim()}
            >
              <SendIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  )
}

const BUBBLE_VARIANTS = [
  { variant: "default", text: "Outgoing: your own message" },
  { variant: "secondary", text: "Incoming: from the guardian" },
  { variant: "muted", text: "A quieter incoming message" },
  { variant: "tinted", text: "A pinned note from the class teacher" },
  { variant: "outline", text: "Forwarded from the school office" },
  { variant: "ghost", text: "Plain text with no surface" },
  { variant: "destructive", text: "Not sent. Tap to retry." },
] as const

export function Conversation() {
  return (
    <ShowcaseSection
      id="conversation"
      title="Conversation"
      description="The pieces of two-way messaging between guardians and teachers: the scrolling thread, message rows, bubbles, attachments, markers and the composer."
    >
      <BlockGrid>
        <Block
          name="Message thread"
          when="MessageScroller holds the thread and keeps it pinned to the newest message, Message lays out each row, Bubble is the surface and Marker the notes between. Type in the composer to add a reply."
          wide
        >
          <Example frameClassName="block p-0">
            <Thread />
          </Example>
        </Block>

        <Block
          name="Message"
          when="One row: avatar, an optional header with the sender, the content and a footer with time or status. Align end for your own messages."
        >
          <Example title="start and end" frameClassName="block">
            <MessageGroup>
              <Message>
                <MessageAvatar>
                  <Avatar size="sm">
                    <AvatarFallback>AK</AvatarFallback>
                  </Avatar>
                </MessageAvatar>
                <MessageContent>
                  <MessageHeader>Mr. Karim (class teacher)</MessageHeader>
                  <Bubble variant="secondary">
                    <BubbleContent>
                      Parent-teacher meeting is on Saturday, 2 November at 10:00
                      AM.
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter>Mon 8:15 AM</MessageFooter>
                </MessageContent>
              </Message>
              <Message align="end">
                <MessageContent>
                  <Bubble align="end">
                    <BubbleContent>
                      We&apos;ll be there. Thank you.
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter>Mon 8:40 AM · Seen</MessageFooter>
                </MessageContent>
              </Message>
            </MessageGroup>
          </Example>
        </Block>

        <Block
          name="Bubble"
          when="The message surface. Default (primary) for your own messages, secondary for the other person, destructive for a failed send."
        >
          <Example title="variants" frameClassName="block">
            <BubbleGroup>
              {BUBBLE_VARIANTS.map(({ variant, text }) => (
                <Bubble
                  key={variant}
                  variant={variant}
                  align={variant === "default" ? "end" : "start"}
                >
                  <BubbleContent>
                    {text}
                    <span className="ml-2 font-mono text-xs opacity-70">
                      {variant}
                    </span>
                  </BubbleContent>
                </Bubble>
              ))}
            </BubbleGroup>
          </Example>
          <Example title="reactions" frameClassName="block pb-8">
            <BubbleGroup>
              <Bubble variant="secondary">
                <BubbleContent>
                  Ayesha scored 18 out of 20 in the class test.
                </BubbleContent>
                <BubbleReactions>
                  <ThumbsUpIcon className="size-3.5" aria-label="1 like" />
                  <span className="text-xs">2</span>
                </BubbleReactions>
              </Bubble>
            </BubbleGroup>
          </Example>
        </Block>

        <Block
          name="Attachment"
          when="Files on a message, with their real upload state. Use the image media for photos and an icon for documents."
        >
          <Example title="image and document">
            <HomeworkPhoto />
            <FeeReceipt />
          </Example>
          <Example title="states" frameClassName="flex-col items-stretch">
            <Attachment state="uploading">
              <AttachmentMedia>
                <ImageIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>medical-certificate.jpg</AttachmentTitle>
                <AttachmentDescription>Uploading · 64%</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
            <Attachment state="error">
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>birth-certificate-scan.pdf</AttachmentTitle>
                <AttachmentDescription>
                  Too large. The limit is 5 MB.
                </AttachmentDescription>
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
          <Example title="group, small" frameClassName="block">
            <AttachmentGroup>
              {[
                "routine-term-2.pdf",
                "seat-plan-hall-2.pdf",
                "syllabus-class-7.pdf",
              ].map((name) => (
                <Attachment key={name} size="sm">
                  <AttachmentMedia>
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

        <Block
          name="Marker"
          when="Dividers and system notes between messages: the day, where unread messages start, and things the system did."
        >
          <Example
            title="variants"
            frameClassName="flex-col items-stretch gap-4"
          >
            <Marker variant="separator">
              <MarkerContent>Today</MarkerContent>
            </Marker>
            <Marker
              variant="separator"
              className="font-medium text-primary before:bg-primary/40 after:bg-primary/40"
            >
              <MarkerContent>New messages</MarkerContent>
            </Marker>
            <Marker>
              <MarkerIcon>
                <BellIcon />
              </MarkerIcon>
              <MarkerContent>
                Mr. Karim (class teacher) joined the conversation
              </MarkerContent>
            </Marker>
            <Marker variant="border">
              <MarkerContent>
                Half-yearly results for Class 7 published · 4:10 PM
              </MarkerContent>
            </Marker>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
