import { assertEquals } from "../supabase/functions/_shared/test_assert.ts";
import { normalizeDomain } from "../frontend/src/lib/domain.ts";

Deno.test("normalizeDomain removes protocol, www, path and query", () => {
  assertEquals(
    normalizeDomain("https://www.buzzmatic.net/path?gad_source=1"),
    "buzzmatic.net",
  );
});

Deno.test("normalizeDomain handles bare domains", () => {
  assertEquals(normalizeDomain("  Example.com/pricing  "), "example.com");
});
