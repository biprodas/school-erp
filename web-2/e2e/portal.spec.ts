import type { Page } from "@playwright/test"

import {
  bff,
  createSchool,
  firstSignIn,
  ownerPage,
  seedSchool,
  settle,
  uniquePhone,
  type School,
} from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// Section 9: a guardian lands on /student. M8: two children here, one at
// another school reached without signing in again.

/** A guardian (by phone) linked to students; returns the guardian id. */
async function linkGuardian(
  owner: Page,
  phone: string,
  studentIds: string[]
): Promise<string> {
  const guardian = await bff<{ id: string }>(owner, "/guardians", {
    method: "POST",
    body: { name: "Karim Ahmed", phone },
  })
  for (const studentId of studentIds) {
    await bff(owner, `/students/${studentId}/guardians`, {
      method: "POST",
      body: { guardianId: guardian.id, relation: "father", isPrimary: true },
    })
  }
  return guardian.id
}

test("a guardian picks between children and moves to another school signed in", async ({
  page,
  browser,
}) => {
  test.slow()
  const phone = uniquePhone()
  const a: School = await createSchool("portal-a")
  const b: School = await createSchool("portal-b")

  // School A first: it makes the guardian's account. A membership made
  // for a brand-new phone-only account stays pending until that first
  // sign-in (backend behaviour), so the account must exist before school
  // B links it, or B won't be listed until the guardian signs in there.
  const ownerA = await browser.newPage()
  await ownerPage(ownerA, a)
  const seededA = await seedSchool(ownerA, [
    ["Class 6", 6, [["Rafi", "Ahmed"]]],
    ["Class 3", 3, [["Nusrat", "Ahmed"]]],
  ])
  const rafi = seededA.students["Rafi Ahmed"]!.studentId
  const guardianId = await linkGuardian(ownerA, phone, [
    rafi,
    seededA.students["Nusrat Ahmed"]!.studentId,
  ])
  const slip = await bff<{ temporaryPassword: string }>(
    ownerA,
    `/guardians/${guardianId}/portal-slip`,
    { method: "POST", body: {} }
  )
  await ownerA.close()
  const ownerB = await browser.newPage()
  await ownerPage(ownerB, b)
  const seededB = await seedSchool(ownerB, [
    ["Class 9", 9, [["Tania", "Ahmed"]]],
  ])
  await linkGuardian(ownerB, phone, [
    seededB.students["Tania Ahmed"]!.studentId,
  ])
  await ownerB.close()

  await firstSignIn(page, a.origin, phone, slip.temporaryPassword)
  await expect(page).toHaveURL(/\/student$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nusrat Ahmed"
  )
  await expectAccessible(page)

  await page.getByLabel("Choose a child").selectOption(rafi)
  await expect(page).toHaveURL(new RegExp(`/student\\?child=${rafi}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rafi Ahmed")
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rafi Ahmed")

  // Sections keep the child; the staff app stays closed.
  const sections = page.getByRole("navigation", { name: "Sections" })
  await sections.getByRole("link", { name: "Fees" }).press("Enter")
  await expect(page).toHaveURL(new RegExp(`/student/fees\\?child=${rafi}$`))
  await expect(page.getByText(/on its way/)).toBeVisible()
  await expectAccessible(page)
  await page.goto(a.url("/dashboard"))
  await expect(page).toHaveURL(/\/student$/)
  await settle(page)

  await page.getByRole("button", { name: /Account menu for/ }).click()
  const other = page.getByRole("menuitem", { name: new RegExp(b.name) })
  await expect(other).toContainText("Tania Ahmed")
  await other.click()
  await page.waitForURL(`${b.origin}/student**`)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tania Ahmed"
  )
  await expect(page.getByLabel("Choose a child")).toHaveCount(0)
})
