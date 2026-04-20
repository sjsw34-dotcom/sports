"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Question, QuestionSource, Difficulty } from "@/lib/types";

type Props = {
  question: Question;
  chosen: number | null;
  onChoose: (index: number) => void;
};

const SOURCE_LABEL: Record<QuestionSource, string> = {
  "past-exam": "기출",
  practice: "연습",
  predicted: "예상",
};

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "쉬움",
  mid: "보통",
  hard: "어려움",
};

export function QuestionCard({ question, chosen, onChoose }: Props) {
  const answered = chosen !== null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {question.year} · {SOURCE_LABEL[question.source]}
          </Badge>
          {question.difficulty && (
            <Badge variant="outline">{DIFF_LABEL[question.difficulty]}</Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            #{question.number}
          </span>
        </div>
        <p className="text-[17px] font-medium leading-relaxed">
          {question.question}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="flex flex-col gap-2">
          {question.choices.map((choice, i) => {
            const isCorrect = i === question.answer;
            const isChosen = i === chosen;
            const showCorrect = answered && isCorrect;
            const showWrong = answered && isChosen && !isCorrect;

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => !answered && onChoose(i)}
                  disabled={answered}
                  aria-pressed={isChosen}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[15px] leading-relaxed transition-colors",
                    "min-h-[56px]",
                    !answered &&
                      "border-border bg-card hover:bg-accent active:scale-[0.99]",
                    showCorrect &&
                      "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
                    showWrong &&
                      "border-destructive bg-destructive/10",
                    answered &&
                      !isCorrect &&
                      !isChosen &&
                      "border-border opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-semibold",
                      showCorrect &&
                        "border-transparent bg-[hsl(var(--success))] text-white",
                      showWrong &&
                        "border-transparent bg-destructive text-white",
                      !showCorrect &&
                        !showWrong &&
                        "border-border text-muted-foreground"
                    )}
                    aria-hidden
                  >
                    {showCorrect ? (
                      <Check className="h-4 w-4" />
                    ) : showWrong ? (
                      <X className="h-4 w-4" />
                    ) : (
                      String.fromCharCode(9312 + i)
                    )}
                  </span>
                  <span className="flex-1">{choice}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
