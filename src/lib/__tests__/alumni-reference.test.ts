import { describe, expect, it } from "vitest";
import { alumniPublicReference, extractAlumniRef } from "../alumni-reference";

describe("extractAlumniRef", () => {
  it("extracts the reference from a message body starting with 'Reference: X'", () => {
    const ref = alumniPublicReference("some-id");
    expect(extractAlumniRef("", `Reference: ${ref}\n\nPlease remove my entry.`)).toBe(ref);
  });

  it("extracts the reference from a subject reading 'Alumni entry X'", () => {
    const ref = alumniPublicReference("some-id");
    expect(extractAlumniRef(`Alumni entry ${ref}`, "no reference here")).toBe(ref);
  });

  it("returns null when neither the subject nor the message contains a reference", () => {
    expect(extractAlumniRef("General enquiry", "Just a question, no reference.")).toBeNull();
  });

  it("does not treat arbitrary text as a reference", () => {
    expect(extractAlumniRef("Hello", "Reference: ")).toBeNull();
  });
});
