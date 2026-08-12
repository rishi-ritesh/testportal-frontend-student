// Turns formula code stored between dollar signs into drawn formulas.
//
// Read-only counterpart of the admin panel's lib/math.js. Questions are stored
// as normal HTML with formulas written between dollar signs, e.g.
//     <p>यदि x = 4 है, तो $\sqrt{x}$ का मान क्या होगा?</p>
// The student portal only ever displays that HTML, so the editor half of the
// admin version (chips, reading text back out) is deliberately left out.

import katex from "katex";
import "katex/contrib/mhchem"; // adds \ce{...} for chemical equations

const MATH_PATTERN = /\$([^$\n]+)\$/g;

// Draw one formula. Returns HTML, or null if the code is not finished/valid.
function drawFormula(code) {
  try {
    return katex.renderToString(code, {
      throwOnError: true,
      displayMode: false,
      strict: false, // needed so Hindi words inside \text{} are allowed
    });
  } catch {
    return null;
  }
}

// Walk every piece of text inside `root` and swap $...$ for whatever
// `makeNode(code)` returns.
function swapMathInText(root, makeNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const found = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.includes("$")) found.push(node);
  }

  found.forEach((textNode) => {
    const text = textNode.nodeValue;
    MATH_PATTERN.lastIndex = 0;
    if (!MATH_PATTERN.test(text)) return;

    MATH_PATTERN.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    let match;

    while ((match = MATH_PATTERN.exec(text))) {
      if (match.index > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }
      frag.appendChild(makeNode(match[1]));
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }
    textNode.replaceWith(frag);
  });
}

// Saved HTML in, drawn HTML out. Anything that is not a formula is left alone,
// and a formula that fails to parse falls back to showing its own source.
export function drawMathInHtml(html) {
  if (!html) return "";
  const holder = document.createElement("div");
  holder.innerHTML = html;
  swapMathInText(holder, (code) => {
    const span = document.createElement("span");
    const drawn = drawFormula(code);
    if (drawn) span.innerHTML = drawn;
    else span.textContent = "$" + code + "$";
    return span;
  });
  return holder.innerHTML;
}
