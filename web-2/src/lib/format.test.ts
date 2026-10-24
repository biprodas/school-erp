import { describe, expect, it } from "vitest"

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  groupLakh,
  toBanglaDigits,
} from "./format"

describe("groupLakh", () => {
  it.each([
    ["0", "0"],
    ["999", "999"],
    ["1000", "1,000"],
    ["100000", "1,00,000"],
    ["1234567", "12,34,567"],
    ["123456789", "12,34,56,789"],
    ["-1234567", "-12,34,567"],
  ])("%s → %s", (input, expected) => {
    expect(groupLakh(input)).toBe(expected)
  })
})

describe("toBanglaDigits", () => {
  it("replaces only the digits", () => {
    expect(toBanglaDigits("Class 10, 2026-10-24")).toBe("Class ১০, ২০২৬-১০-২৪")
  })
})

describe("formatMoney", () => {
  it("reads minor units with lakh grouping and the taka sign", () => {
    expect(formatMoney(123456750)).toBe("৳12,34,567.50")
    expect(formatMoney(5)).toBe("৳0.05")
    expect(formatMoney(0)).toBe("৳0.00")
  })

  it("puts the minus sign before the currency sign", () => {
    expect(formatMoney(-150000)).toBe("-৳1,500.00")
  })

  it("uses Bangla digits when the school does", () => {
    expect(formatMoney(10000000, { numerals: "bn" })).toBe("৳১,০০,০০০.০০")
  })

  it("supports thousand grouping, no symbol and trimmed fractions", () => {
    expect(formatMoney(123456700, { grouping: "thousand" })).toBe(
      "৳1,234,567.00"
    )
    expect(formatMoney(150000, { symbol: false })).toBe("1,500.00")
    expect(formatMoney(150000, { trimZeroFraction: true })).toBe("৳1,500")
    expect(formatMoney(150050, { trimZeroFraction: true })).toBe("৳1,500.50")
  })

  it("rounds stray fractions of a poisha", () => {
    expect(formatMoney(100.6)).toBe("৳1.01")
  })

  it("gives an empty string for missing values", () => {
    expect(formatMoney(null)).toBe("")
    expect(formatMoney(undefined)).toBe("")
    expect(formatMoney(Number.NaN)).toBe("")
  })
})

describe("formatNumber", () => {
  it("groups integers and keeps decimals as given", () => {
    expect(formatNumber(1234567)).toBe("12,34,567")
    expect(formatNumber("4.50")).toBe("4.50")
    expect(formatNumber(98.5, { numerals: "bn" })).toBe("৯৮.৫")
    expect(formatNumber(-12345, { grouping: "none" })).toBe("-12345")
  })

  it("leaves non-numeric text alone apart from digits", () => {
    expect(formatNumber("A+", { numerals: "bn" })).toBe("A+")
    expect(formatNumber("")).toBe("")
    expect(formatNumber(null)).toBe("")
  })
})

describe("formatDate", () => {
  it("shows business dates as written, whatever the time zone", () => {
    expect(formatDate("2026-10-24")).toBe("24/10/2026")
    expect(formatDate("2026-10-24", { timeZone: "America/Los_Angeles" })).toBe(
      "24/10/2026"
    )
  })

  it("converts timestamps to the school time zone (Asia/Dhaka by default)", () => {
    // 20:30 UTC is 02:30 the next day in Dhaka (UTC+6).
    expect(formatDate("2026-10-24T20:30:00Z")).toBe("25/10/2026")
    expect(formatDate("2026-10-24T20:30:00Z", { timeZone: "UTC" })).toBe(
      "24/10/2026"
    )
  })

  it("follows the school date format, language and numerals", () => {
    expect(formatDate("2026-10-04", { format: "YYYY-MM-DD" })).toBe(
      "2026-10-04"
    )
    expect(formatDate("2026-10-04", { format: "DD-MM-YYYY" })).toBe(
      "04-10-2026"
    )
    expect(formatDate("2026-10-04", { format: "D MMM YYYY" })).toBe(
      "4 Oct 2026"
    )
    expect(
      formatDate("2026-10-04", {
        format: "D MMM YYYY",
        language: "bn",
        numerals: "bn",
      })
    ).toBe("৪ অক্টো ২০২৬")
  })

  it("gives an empty string for missing or invalid values", () => {
    expect(formatDate(null)).toBe("")
    expect(formatDate("")).toBe("")
    expect(formatDate("not a date")).toBe("")
  })
})

describe("formatDateTime", () => {
  it("shows the time in the school time zone", () => {
    expect(formatDateTime("2026-10-24T09:05:00Z")).toBe("24/10/2026 3:05 PM")
  })
})
