# Agent Realm - Skills Rules

## 개요
이 문서는 Agent Realm 프로젝트의 스킬 시스템 규칙을 정의합니다.

## 프로젝트 구조
- **클라이언트**: React + Vite (`client/src/`)
- **서버**: Express + SQLite (`server/`)
- **공유**: 스키마 및 타입 (`shared/`)
- **Electron**: 데스크톱 앱 패키징 (`electron/`)

## 기술 스택
- Frontend: React, TypeScript, TailwindCSS, Framer Motion
- Backend: Express, better-sqlite3, WebSocket
- AI: Anthropic Claude API, Google Gemini API
- Desktop: Electron

## 코드 규칙
- 테마: 라이트 테마 전용 (`--dc-*` CSS 변수)
- 언어: UI 텍스트는 한국어
- 코드 변경 후 반드시 `npm run electron:build` 실행

## 에이전트 역할
- `pm`: 프로젝트 매니저
- `fullstack`: 풀스택 개발자
- `designer`: UI/UX 디자이너
- `tester`: QA 테스터
- `devops`: DevOps 엔지니어
- `general`: 범용 개발자

## API 패턴
- REST API: `/api/agents`, `/api/tasks`, `/api/meetings` 등
- WebSocket: `/ws` (실시간 이벤트)
- 이미지 업로드: `/api/upload`, `/uploads/` 정적 서빙
