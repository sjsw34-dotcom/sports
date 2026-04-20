import Link from "next/link";
import { BookOpen, Network, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  loadSubjects,
  loadConcepts,
  loadAllQuestions,
} from "@/lib/data-loader";

const QUICK_LINKS = [
  {
    href: "/subjects" as const,
    icon: BookOpen,
    label: "과목별 학습",
    description: "과목을 선택해 랜덤 문제 풀기",
  },
  {
    href: "/concepts" as const,
    icon: Network,
    label: "개념 사전",
    description: "핵심 개념 네트워크 탐색",
  },
  {
    href: "/years" as const,
    icon: FileText,
    label: "연도별 기출",
    description: "실제 시험 형식 (Phase 3)",
  },
];

export default function HomePage() {
  const subjectCount = loadSubjects().length;
  const conceptCount = loadConcepts().length;
  const questionCount = loadAllQuestions().length;

  return (
    <section className="flex flex-col gap-6 px-4 py-6">
      <header className="px-2 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          chedo-prep
        </p>
        <h1 className="mt-2 text-balance text-2xl font-semibold leading-snug">
          체육지도자 자격증,
          <br />
          개념망으로 공부하기
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          과년도 기출과 예상문제, 그리고 개념 간 연결로 합격까지 가장 빠른 길을
          만듭니다.
        </p>
      </header>

      <ul className="grid gap-3">
        {QUICK_LINKS.map(({ href, icon: Icon, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <div className="text-base font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-3 gap-2 px-2 pt-2">
        <Stat label="과목" value={subjectCount} />
        <Stat label="개념" value={conceptCount} />
        <Stat label="문제" value={questionCount} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-3 py-3">
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
