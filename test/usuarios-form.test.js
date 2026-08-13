import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../usuarios.html", import.meta.url), "utf8");

test("el alta conserva el formulario tras esperar a la API", () => {
  assert.match(source, /const form=e\.currentTarget,f=new FormData\(form\)/);
  assert.match(source, /await api\('POST',body\);form\.reset\(\)/);
  assert.doesNotMatch(source, /await api\('POST',body\);e\.currentTarget\.reset\(\)/);
});
