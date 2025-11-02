import React from "react";
import katex from "katex";

type Props = { expression: string; fontSize?: number };
export const Latex: React.FC<Props> = ({ expression, fontSize = 18 }) => {
  const html = katex.renderToString(expression, {
    throwOnError: false,
    displayMode: false
  });
  return (
    <div
      style={{ fontSize, lineHeight: 1 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
