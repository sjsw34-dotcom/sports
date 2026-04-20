import { visit, SKIP } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Text, PhrasingContent } from "mdast";

const CONCEPT_RE = /\{\{concept:([a-z0-9-]+)\}\}/g;

/**
 * `{{concept:xxx}}` 인라인 태그를 커스텀 hast 요소 <concept-link>로 치환.
 * react-markdown의 components prop에서 "concept-link"를 ConceptLink 컴포넌트에 매핑한다.
 */
export const remarkConcept: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return;
      const value = node.value;
      CONCEPT_RE.lastIndex = 0;
      if (!CONCEPT_RE.test(value)) return;
      CONCEPT_RE.lastIndex = 0;

      const newNodes: PhrasingContent[] = [];
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      while ((match = CONCEPT_RE.exec(value)) !== null) {
        if (match.index > lastIdx) {
          newNodes.push({
            type: "text",
            value: value.slice(lastIdx, match.index),
          });
        }
        const conceptId = match[1] ?? "";
        const customNode = {
          type: "conceptLink",
          data: {
            hName: "concept-link",
            hProperties: { conceptid: conceptId },
          },
          children: [],
        } as unknown as PhrasingContent;
        newNodes.push(customNode);
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < value.length) {
        newNodes.push({ type: "text", value: value.slice(lastIdx) });
      }

      parent.children.splice(index, 1, ...newNodes);
      return [SKIP, index + newNodes.length];
    });
  };
};
