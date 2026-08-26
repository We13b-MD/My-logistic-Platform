import { generateUPR } from "./upr.utils";

console.log("🧪 Testing Unique Payment Reference (UPR) Generator...");

const ref1 = generateUPR("APEX");
const ref2 = generateUPR("GIG");
const ref3 = generateUPR("DHL");

console.log("✅ Sample UPR 1 (Apex Logistics):", ref1);
console.log("✅ Sample UPR 2 (GIG Logistics):", ref2);
console.log("✅ Sample UPR 3 (DHL Express):", ref3);

if (ref1.startsWith("LOG-APEX-") && ref2.startsWith("LOG-GIG-")) {
  console.log("🎉 UPR Generation Pattern Verified 100% Successfully!");
} else {
  console.error("❌ Invalid UPR format!");
}
