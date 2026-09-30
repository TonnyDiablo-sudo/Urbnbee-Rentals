import assert from "node:assert/strict";

const sample = {
  skus: [
    {
      sku: "cabibee_pase_reserva",
      code: "pase_reserva",
      audience: "guest",
      label: "Pase",
      description: "x",
      public_price: 12,
      public_price_mxn: 200,
      billing: { kind: "one_time" },
      active: true,
      floor_price: 3,
    },
  ],
};

const publicPlan = {
  code: sample.skus[0].code,
  label: sample.skus[0].label,
  amount: sample.skus[0].public_price_mxn,
  currency: "mxn",
};
assert.equal(publicPlan.amount, 200);
assert.equal("floor_price" in publicPlan, false);
assert.equal("floorPrice" in publicPlan, false);
console.log("ok");
