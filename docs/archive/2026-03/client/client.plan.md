# client Planning Document

> **Summary**: Agent-Realm 프론트엔드(React+Vite) UI/UX 전반 개선
>
> **Project**: agent-realm
> **Version**: 1.0.0
> **Author**: rlaeo
> **Date**: 2026-03-01
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

Agent-Realm 클라이언트의 UI/UX 품질을 전반적으로 개선하여, 멀티 에이전트 협업 플랫폼으로서의 사용성과 시각적 완성도를 높인다.

### 1.2 Background

- 현재 클라이언트는 기능 중심으로 빠르게 개발되어 레이아웃 일관성, 반응형 지원, 접근성 등이 부족
- Home.tsx에 상태 관리 로직이 집중되어 있어 컴포넌트 간 결합도가 높음
- 3패널 레이아웃(좌측 사이드바 + 중앙 패널 + 우측 상세)이 고정 폭으로 구현되어 화면 크기 대응이 미흡
- `--dc-*` CSS 변수 기반 라이트 테마가 적용되어 있으나 디자인 토큰이 체계적으로 정리되지 않음
- shadcn/ui 컴포넌트가 60+ 파일 존재하지만 실제 사용되지 않는 컴포넌트가 다수 포함

### 1.3 Related Documents

- Changelog: `docs/changelog-2026-03.md`
- 아카이브: `docs/archive/2026-02/multi-agent-advancement/`

---

## 2. Scope

### 2.1 In Scope

- [ ] 3패널 레이아웃 반응형 개선 (리사이즈 가능한 패널)
- [ ] 상태 관리 리팩토링 (Home.tsx 비대화 해소)
- [ ] 에러 핸들링 및 빈 상태(empty state) UI 통일
- [ ] 로딩/스켈레톤 패턴 일관성 확보
- [ ] 키보드 네비게이션 및 접근성(a11y) 개선
- [ ] 미사용 shadcn/ui 컴포넌트 정리

### 2.2 Out of Scope

- 다크 모드 추가 (현재 라이트 전용 유지)
- 백엔드 API 변경
- Electron IPC/메인 프로세스 변경
- 새로운 페이지 추가

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 3패널 레이아웃에 드래그 리사이즈 적용 (resizable panels) | High | Pending |
| FR-02 | Home.tsx 상태를 커스텀 훅/컨텍스트로 분리 | High | Pending |
| FR-03 | 에이전트 미선택 시 빈 상태 UI (일러스트 + 가이드 문구) | Medium | Pending |
| FR-04 | WebSocket 연결 끊김 시 재연결 표시 및 알림 | Medium | Pending |
| FR-05 | 모든 비동기 작업에 일관된 로딩/에러 패턴 적용 | Medium | Pending |
| FR-06 | 미사용 UI 컴포넌트 제거 (번들 사이즈 축소) | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 초기 로드 < 3s, 번들 < 500KB (gzip) | Vite bundle analyzer |
| Accessibility | 키보드로 모든 주요 기능 접근 가능 | 수동 테스트 |
| Maintainability | Home.tsx 200줄 이하로 축소 | 코드 라인 수 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 모든 FR 구현 완료
- [ ] 빌드 성공 (`npm run build` + `npm run electron:build`)
- [ ] 기존 기능 동작 검증 (채팅, 워크플로우, 회의실, 위젯)
- [ ] EXE 정상 실행 확인

### 4.2 Quality Criteria

- [ ] TypeScript 에러 없음 (`npm run check`)
- [ ] 빌드 성공
- [ ] 기존 기능 회귀 없음

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 상태 분리 시 기존 기능 회귀 | High | Medium | 단계별 리팩토링, 각 단계마다 수동 테스트 |
| 리사이즈 패널 성능 이슈 | Medium | Low | 이미 의존성에 포함된 resizable 컴포넌트 활용 |
| 컴포넌트 삭제 시 의존성 누락 | Medium | Medium | 삭제 전 import 참조 검색 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems | ☐ |

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | React + Vite | React + Vite (유지) | 기존 스택 유지 |
| State Management | 컨텍스트 / Zustand / useState 분리 | Custom Hooks + Context | 별도 라이브러리 없이 복잡도 관리 |
| API Client | react-query | react-query (유지) | 이미 사용 중 |
| Styling | Tailwind + CSS변수 | Tailwind + CSS변수 (유지) | `--dc-*` 토큰 체계 유지 |
| Routing | wouter | wouter (유지) | 경량 라우터 유지 |

### 6.3 Clean Architecture Approach

```
Selected Level: Dynamic

현재 구조:
client/src/
├── components/       ← 기능 컴포넌트 + UI 라이브러리
├── hooks/            ← WebSocket, Sound, TTS 등
├── lib/              ← 유틸리티
├── pages/            ← Home, Widget
└── types/            ← Electron 타입

개선 방향:
client/src/
├── components/       ← 기능 컴포넌트 (변경 없음)
├── hooks/            ← 기존 + useAppState, useAgentSelection 추가
├── lib/              ← 유틸리티 (변경 없음)
├── pages/            ← Home 경량화
└── types/            ← 타입 (변경 없음)
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] TypeScript configuration (`tsconfig.json`)
- [x] Tailwind CSS + `--dc-*` CSS 변수
- [x] shadcn/ui 컴포넌트 라이브러리
- [x] `@/` path alias → `client/src/`
- [ ] ESLint configuration — 없음
- [ ] Prettier configuration — 없음

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | PascalCase 컴포넌트 | 유지 | - |
| **Folder structure** | 기능별 분리 없음 | hooks 분리 규칙 | Medium |
| **Import order** | 없음 | 유지 (linter 없음) | Low |
| **Error handling** | toast 기반 | 통일된 에러 바운더리 | Medium |

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`client.design.md`)
2. [ ] 구현 시작 (FR-02 상태 분리 → FR-01 레이아웃 → FR-03~05 UX → FR-06 정리)
3. [ ] Gap Analysis 실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-01 | Initial draft | rlaeo |
