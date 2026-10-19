import { Section, SectionHeading } from "../ui/section";
import { Roles } from "./roles";

export function RolesSection() {
  return (
    <Section id="roles" labelledBy="roles-title" tone="forest">
      <SectionHeading
        id="roles-title"
        eyebrow="One platform, every role"
        title="Everyone sees what they need, and nothing they don't"
        dark
      >
        Roles decide what each person can see and change. Start from the standard roles, or copy
        one and adjust it.
      </SectionHeading>
      <Roles />
    </Section>
  );
}
