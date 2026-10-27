const fs = require("fs");
const parser = require("@babel/parser");
const code = fs.readFileSync("./app/DashboardClient.tsx", "utf8");
const lines = code.split("\n");

// Ambil 1-1561, tambahkan penutup minimal
const top = lines.slice(0, 1561).join("\n") + "\n}\n";

try {
  parser.parse(top, { sourceType: "module", plugins: ["jsx", "typescript"] });
  console.log("BARIS 1-1561: VALID (setelah ditutup artificial)");
} catch (e) {
  console.log("BARIS 1-1561: ERROR");
  console.log("  ", e.message);
  if (e.loc) console.log("  line", e.loc.line);
}
