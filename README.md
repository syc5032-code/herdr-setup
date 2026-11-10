# My Herdr & Antigravity Setup

다른 컴퓨터에서도 지금 컴퓨터와 100% 동일한 Herdr 및 Antigravity 개발 환경을 원클릭으로 세팅할 수 있는 설정 저장소입니다.

---

## 📦 포함된 세팅 내역

* **Herdr 최신 설치 및 최적화 (`config.toml`)**:
  * 라이트 테마 (`catppuccin-latte`)
  * 상단 바 우측 5시간 및 주간 잔여량 상시 표시 (`tab_bar_right`)
  * 마우스 창 크기 조절/선택 지원 (`mouse_capture = true`)
  * 윈도우 한글 IME 씹힘 방지 (`switch_ascii_input_source_in_prefix = true`)
  * 빠른 단축키 (`Alt + a` 자동 실행, `Alt + q` 쿼터 팝업)
* **Antigravity CLI 최신 설치 및 훅 연동**:
  * 윤자동 스타일 하단 상태줄 (`Gemini 3.8 Flash high · user [7d X% 5h Y%] · [ctx ...]`)
  * 일상 명령어 자동 승인 모드 (`agentMode: auto`)
* **터미널 단축키 (`a`, `herder`) 자동 등록**

---

## 🚀 다른 컴퓨터에서 1분 만에 설치하는 법

새 컴퓨터에서 **PowerShell**을 열고 아래 명령어를 순서대로 실행합니다:

```powershell
# 1. 이 저장소 다운로드 (본인 GitHub 주소로 변경)
git clone https://github.com/내아이디/herdr-setup.git
cd herdr-setup

# 2. 원클릭 설치 스크립트 실행
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

설치가 끝나면 터미널 창을 새로 열고 `herdr`를 실행하시면 바로 동일하게 작동합니다!
