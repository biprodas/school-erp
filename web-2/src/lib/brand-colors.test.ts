import { describe, expect, it } from "vitest"

import { brandStyle, foregroundOn } from "./brand-colors"

describe("brandStyle", () => {
  it("sets the primary color and a readable foreground", () => {
    expect(brandStyle("#1d4ed8")).toEqual({
      "--primary": "#1d4ed8",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#1d4ed8",
      "--sidebar-primary-foreground": "#ffffff",
      "--ring": "#1d4ed8",
      "--sidebar-ring": "#1d4ed8",
    })
  })

  it("leaves the design system's colors without a valid color", () => {
    expect(brandStyle(null)).toBeUndefined()
    expect(brandStyle("")).toBeUndefined()
    expect(brandStyle("red")).toBeUndefined()
    expect(brandStyle("#fff")).toBeUndefined()
    expect(brandStyle("#12345g")).toBeUndefined()
    expect(brandStyle("#123456; color: red")).toBeUndefined()
  })
})

describe("foregroundOn", () => {
  it("uses dark text on light colors and white on dark ones", () => {
    expect(foregroundOn("#facc15")).toBe("#18181b")
    expect(foregroundOn("#ffffff")).toBe("#18181b")
    expect(foregroundOn("#000000")).toBe("#ffffff")
    expect(foregroundOn("#166534")).toBe("#ffffff")
  })
})
