# 해남제일중 업무 공유 웹앱

Google Apps Script 웹앱을 대체하는 **Next.js + Vercel + Google Sheets API** 프로젝트입니다.

## 제공 기능

- 오늘·이번 주·다음 주·이번 달·다음 달 일정 대시보드
- 업무 등록, 검색, 유형 필터, 수정, 완료 처리, 소프트 삭제
- 삭제한 업무를 `삭제 목록` 시트에 복사하고 `업무목록` K열에 삭제 여부 기록
- 안내사항 등록, 수정, 삭제
- PC·모바일 반응형 화면
- 서비스 계정 키를 브라우저에 노출하지 않는 서버 API

## 1. Google Cloud 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만듭니다.
2. `API 및 서비스 → 라이브러리`에서 **Google Sheets API**를 사용 설정합니다.
3. `IAM 및 관리자 → 서비스 계정`에서 서비스 계정을 만듭니다.
4. 서비스 계정의 `키 → 키 추가 → 새 키 만들기 → JSON`을 선택합니다.
5. JSON 파일의 `client_email`과 `private_key`를 안전한 곳에 보관합니다. JSON 파일 자체는 GitHub에 올리지 않습니다.
6. 원본 Google 스프레드시트를 서비스 계정의 `client_email` 주소에 **편집자**로 공유합니다.

## 2. 로컬 실행

```bash
cp .env.example .env.local
npm install
npm run dev
```

`.env.local`에 다음 값을 입력합니다.

```dotenv
GOOGLE_SHEET_ID=1kfm0c6X7YVYhS51x5UPgeiViJsKb9CExfEqGyWFKCkU
GOOGLE_SERVICE_ACCOUNT_EMAIL=서비스계정이메일
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n개인키\n-----END PRIVATE KEY-----\n"
```

`http://localhost:3000/api/health`에서 `sheetsConfigured: true`가 표시되는지 확인합니다.

## 3. GitHub에 올리기

1. GitHub에서 새 비공개 저장소를 만듭니다.
2. 이 폴더의 파일을 저장소에 업로드합니다.
3. `.env.local`이나 서비스 계정 JSON 파일이 올라가지 않았는지 반드시 확인합니다.

## 4. Vercel 배포

1. [Vercel](https://vercel.com/)에서 `Add New → Project`를 선택합니다.
2. 위에서 만든 GitHub 저장소를 가져옵니다.
3. Framework Preset은 `Next.js`를 선택합니다.
4. Environment Variables에 아래 3개를 등록합니다.
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
5. `GOOGLE_PRIVATE_KEY`는 JSON의 줄바꿈을 `\n` 문자로 유지해 한 줄로 입력합니다.
6. Deploy를 누르고, 배포 완료 후 `/api/health`와 메인 화면을 확인합니다.

## 5. 기존 스프레드시트 보안 변경

새 웹앱에서 읽기·등록·수정·삭제가 모두 정상 작동하는 것을 확인한 뒤, 원본 스프레드시트의 일반 액세스를 **제한됨**으로 변경하세요. 서비스 계정과 실제 관리자만 편집자로 남기면 됩니다.

## 주의사항

현재 요구사항은 “링크를 아는 사람은 로그인 없이 이용”이므로 링크를 받은 사람은 누구나 업무를 등록·수정·삭제할 수 있습니다. 링크를 외부에 공개하지 마세요. 추후 학교 계정 로그인이나 공용 비밀번호를 추가할 수 있습니다.

수정·삭제 직전에는 선택 당시의 날짜·업무명·담당부서와 현재 행을 다시 비교합니다. 다른 업무로 바뀐 경우 작업을 중단하고 새로고침을 안내합니다. 삭제할 때는 원본 행을 제거하지 않고 `삭제 목록` 복사와 `업무목록` K열의 `TRUE` 변경을 하나의 요청으로 처리합니다.
