"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import type { Concept } from "@/lib/types";

type Props = {
  concept: Concept;
  conceptsById: Record<string, Concept>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ConceptSheet({ concept, conceptsById, open, onOpenChange }: Props) {
  const related = concept.relatedConceptIds
    .map((id) => conceptsById[id])
    .filter((c): c is Concept => Boolean(c));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{concept.name}</DrawerTitle>
          <DrawerDescription>{concept.definition}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <MarkdownContent
            source={concept.details}
            conceptsById={conceptsById}
            inlineOnly
          />

          {related.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                관련 개념
              </div>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => (
                  <Badge key={r.id} variant="outline">
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/concepts/${concept.id}`}>
                <ExternalLink className="h-4 w-4" />
                전체 페이지에서 보기
              </Link>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
