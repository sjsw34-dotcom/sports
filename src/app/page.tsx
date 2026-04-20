export default function HomePage() {
  return (
    <section className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        chedo-prep
      </p>
      <h1 className="text-balance text-2xl font-semibold">
        체육지도자 자격증 학습
      </h1>
      <p className="max-w-sm text-balance text-sm leading-relaxed text-muted-foreground">
        과년도 기출과 예상문제, 그리고 개념망 기반의 심화 해설로
        <br />
        합격까지 가장 빠른 길을 만듭니다.
      </p>
      <p className="mt-8 text-xs text-muted-foreground">
        Phase 0 세팅 완료. 데이터는 Phase 1에서 채워집니다.
      </p>
    </section>
  );
}
