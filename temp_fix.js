const fs = require("fs");
const path = "src/pages/CreatePage.tsx";
let content = fs.readFileSync(path, "utf8");

// Find and replace first occurrence
const idx1 = content.indexOf("\u56fe\u7247\u8f6e\u64ad\u89c6\u9891");
console.log("Index 1:", idx1);
if (idx1 >= 0) {
  const oldEnd = content.indexOf(")", idx1) + 1;
  const oldStr = content.substring(idx1, oldEnd);
  const newStr = "\u56fe\u7247\u8f6e\u64ad\u89c6\u9891\u9700\u8981\u4f7f\u7528\u56fe\u7247\u751f\u6210\u529f\u80fd\uff0c\u8bf7\u5728\u300cAPI\u8bbe\u7f6e\u300d\u2192\u300c\u56fe\u7247\u6a21\u578b\u300d\u4e2d\u9009\u62e9\u4e00\u4e2a\u53ef\u7528\u7684\u6a21\u578b\uff08\u53ef\u7075\u5185\u7f6eAI\u3001\u5373\u68a6\u5185\u7f6eAI\u3001Vidu\u81ea\u5b9a\u4e49API\u3001MiniMax\u81ea\u5b9a\u4e49API\u3001\u5546\u6c64SenseNova\u81ea\u5b9a\u4e49API\u7b49\uff09";
  content = content.replace(oldStr, newStr);
  console.log("Replaced 1");
}

const idx2 = content.indexOf("\u5206\u6bb5\u89c6\u9891\u9700\u8981\u4f7f\u7528\u56fe\u7247\u751f\u6210\u529f\u80fd");
console.log("Index 2:", idx2);
if (idx2 >= 0) {
  const oldEnd = content.indexOf(")", idx2) + 1;
  const oldStr = content.substring(idx2, oldEnd);
  const newStr = "\u5206\u6bb5\u89c6\u9891\u9700\u8981\u4f7f\u7528\u56fe\u7247\u751f\u6210\u529f\u80fd\uff0c\u8bf7\u5728\u300cAPI\u8bbe\u7f6e\u300d\u2192\u300c\u56fe\u7247\u6a21\u578b\u300d\u4e2d\u9009\u62e9\u4e00\u4e2a\u53ef\u7528\u7684\u6a21\u578b\uff08\u53ef\u7075\u5185\u7f6eAI\u3001\u5373\u68a6\u5185\u7f6eAI\u3001Vidu\u81ea\u5b9a\u4e49API\u3001MiniMax\u81ea\u5b9a\u4e49API\u3001\u5546\u6c64SenseNova\u81ea\u5b9a\u4e49API\u7b49\uff09";
  content = content.replace(oldStr, newStr);
  console.log("Replaced 2");
}

fs.writeFileSync(path, content, "utf8");
console.log("Write complete");