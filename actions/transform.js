const jsdom = require("jsdom");
const TurndownService = require("turndown");
const { clone, itemsReference } = require("../common");
const pretty = require("pretty");

const keys = Object.keys(itemsReference);
const { JSDOM } = jsdom;

const turndownService = new TurndownService();

turndownService.addRule("pre", {
  filter: ["pre"],
  replacement: function (content) {
    return `\`\`\`rust
${content}
\`\`\``;
  },
});

// turndownService.addRule("pre", {
//   filter: ["pre", "code"],
//   replacement: function (content) {
//     return `<div>${content}</div>`;
//   },
// });

turndownService.addRule("code", {
  filter: ["code"],
  replacement: function (content) {
    return `<div>${content}</div>`;
  },
});

turndownService.addRule("br", {
  filter: ["br"],
  replacement: function (content) {
    return `<br/>`;
  },
});

turndownService.addRule("em", {
  filter: ["em"],
  replacement: function (content) {
    return `<em>${content}</em>`;
  },
});

const isRelativeLink = (link) => !link.startsWith("http");

const serializeDOM = (dom) =>
  pretty(
    dom
      .serialize()
      .replace(/^<html><head><\/head><body>/, "")
      .replace(/<\/body><\/html>$/, "")
      .replace(/<br>/g, "<br/>")
      .replace(/<wbr>/g, "<wbr/>")
      .replace(/_/g, "\\_")
  );

const transformLinks = (dom, crate) => {
  Array.from(dom.window.document.querySelectorAll("a")).forEach((anchor) => {
    if (isRelativeLink(anchor.href)) {
      // TO REFINE
      anchor.href = `/docs/api/rust/${crate}/` + anchor.href;
    }
  });
};

const removeRustdocTools = (dom) => {
  const selectors = ["#render-detail", "a.srclink", "a.anchor"];
  selectors.forEach((selector) => {
    Array.from(
      dom.window.document.querySelectorAll(selector)
    ).forEach((element) => element.parentNode.removeChild(element));
  });
};

const transformCodeBlocks = (dom) => {
  Array.from(dom.window.document.querySelectorAll("pre")).forEach((element) =>
    element.parentNode.removeChild(element)
  );
};

const transform = async (contents, crate) => {
  const transformedContents = clone(contents);
  const promises = keys.map(async (key) => {
    if (key === "module") {
      for (const path in transformedContents.module) {
        transformedContents.module[path] = await transform(
          transformedContents.module[path],
          crate
        );
      }
      return;
    }
    const res = transformedContents[key].map((item) => {
      const dom = new JSDOM(item.content);
      removeRustdocTools(dom);
      // transformCodeBlocks(dom);
      transformLinks(dom, crate);
      return {
        path: item.path,
        content: turndownService
          .turndown(serializeDOM(dom))
          .replace(/!\[/g, "&#33;[")
          .replace(/<(?!\/?div)/g, "&lt;")
          .replace(/(?<!div)(?<!")>/g, "&gt;")
          .replace(/{/g, "&#123;")
          .replace(/}/g, "&#125;"),
      };
    });
    transformedContents[key] = await Promise.all(res);
    return;
  });
  await Promise.all(promises);
  return transformedContents;
};

module.exports = transform;