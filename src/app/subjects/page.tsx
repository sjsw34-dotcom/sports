import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  loadSubjects,
  loadQuestionsForSubject,
  loadCertifications,
} from "@/lib/data-loader";
import type { CertId } from "@/lib/types";

const CERT_SHORT: Record<CertId, string> = {
  "life-2": "생활",
  youth: "유소년",
  senior: "노인",
};

export default function SubjectsIndexPage() {
  const subjects = loadSubjects();
  const certs = loadCertifications();
  const certById = Object.fromEntries(certs.map((c) => [c.id, c]));

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <header className="px-2 pt-2">
        <h1 className="text-xl font-semibold">과목별 학습</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          과목을 선택해 문제를 풀어보세요. 해설의 개념 링크를 탭하면 관련 개념이
          바로 열립니다.
        </p>
      </header>

      <ul className="grid gap-3">
        {subjects.map((subject) => {
          const count = loadQuestionsForSubject(subject.id).length;
          const certChips = subject.requiredFor.map((r) => ({
            id: r.certId,
            label: CERT_SHORT[r.certId] ?? r.certId,
            required: r.type === "required",
            name: certById[r.certId]?.name ?? r.certId,
          }));

          return (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.id}` as const}
                className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-start gap-3 space-y-0">
                    <span
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl"
                      style={{
                        backgroundColor: `${subject.color}22`,
                        color: subject.color,
                      }}
                      aria-hidden
                    >
                      {subject.icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">
                          {subject.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {count}문항
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {subject.description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {certChips.map((c) => (
                        <Badge
                          key={c.id}
                          variant={c.required ? "default" : "outline"}
                          title={c.required ? `${c.name} 필수` : `${c.name} 선택`}
                        >
                          {c.label}
                          {c.required ? " 필수" : ""}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
