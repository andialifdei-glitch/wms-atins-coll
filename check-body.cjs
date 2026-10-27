const fs = require("fs");
const parser = require("@babel/parser");
const code = fs.readFileSync("./app/DashboardClient.tsx", "utf8");
const lines = code.split("\n");

// Bungkus body 1562-4564 dalam function biasa
const body = lines.slice(1561, 4564).join("\n");
const wrapped = "function __dummy() {\n" + body + "\n}\n";

try {
  parser.parse(wrapped, { sourceType: "module", plugins: ["jsx", "typescript"] });
  console.log("BODY 1562-4564: VALID (sebagai body function)");
} catch (e) {
  console.log("BODY 1562-4564: ERROR");
  console.log("  ", e.message);
  if (e.loc) {
    console.log("  line", e.loc.line, "(offset +1561 = line", (e.loc.line + 1561) + " di file asli)");
  }
}
