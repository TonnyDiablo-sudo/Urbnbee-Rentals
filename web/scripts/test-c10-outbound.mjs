import { createHmac } from "node:crypto";

function sign(secret, raw) {
  return `sha256=${createHmac("sha256", secret).update(raw, "utf8").digest("hex")}`;
}

function classify(httpStatus) {
  if (httpStatus === 400 || httpStatus === 401) return "drop";
  if (httpStatus === 200) return "delivered";
  if (httpStatus === 503 || httpStatus >= 500) return "retry";
  if (httpStatus >= 200 && httpStatus < 300) return "delivered";
  return "retry";
}

const body = JSON.stringify({ event_id: "evt_test", event: "booking.paid" });
const header = sign("secret", body);
if (!header.startsWith("sha256=") || header.length !== 7 + 64) {
  throw new Error("firma mal formada");
}
if (sign("secret", body) !== header) throw new Error("firma no estable");
if (sign("otro", body) === header) throw new Error("firma no cambia con el secreto");

const cases = [
  [200, "delivered"],
  [400, "drop"],
  [401, "drop"],
  [503, "retry"],
  [500, "retry"],
  [404, "retry"],
];
for (const [code, want] of cases) {
  const got = classify(code);
  if (got !== want) throw new Error(`classify ${code} => ${got}, quería ${want}`);
}

console.log("c10-outbound: OK", { headerPrefix: header.slice(0, 14), cases: cases.length });
