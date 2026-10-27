const fs = require("fs");
const parser = require("@babel/parser");
const code = fs.readFileSync("./app/DashboardClient.tsx", "utf8");
try {
  parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
  console.log("FILE VALID — tidak ada syntax error");
} catch (e) {
  console.error("Syntax error:", e.message);
  if (e.loc) {
    console.error(`  line ${e.loc.line}, column ${e.loc.column}`);
    // Tampilkan 10 baris di sekitar
    const lines = code.split("\n");
    const start = Math.max(0, e.loc.line - 6);
    const end = Math.min(lines.length, e.loc.line + 5);
    for (let i = start; i < end; i++) {
      console.log(`${String(i+1).padStart(5)}  ${lines[i]}`);
    }
  }
}
