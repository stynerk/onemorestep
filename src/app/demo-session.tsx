"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

const sessionKey = "onemorestep.demo-session";
const sessionChanged = "onemorestep:demo-session";
const loginPath = "/login";

// These public values only control entry to the demonstration interface.
const demoId = "medicom";
const demoPassword = "1234!";

function subscribeToSession(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(sessionChanged, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(sessionChanged, listener);
  };
}

function readSession() {
  try {
    return window.localStorage.getItem(sessionKey) === "1";
  } catch {
    return false;
  }
}

const readServerSession = () => null;

function writeSession(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(sessionKey, "1");
    else window.localStorage.removeItem(sessionKey);
    return true;
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(sessionChanged));
  }
}

export function DemoSessionGate({ children }: { children: ReactNode }) {
  const signedIn = useSyncExternalStore(subscribeToSession, readSession, readServerSession);
  const atLogin = usePathname() === loginPath;
  const router = useRouter();

  useEffect(() => {
    if (signedIn === false && !atLogin) router.replace(loginPath);
    if (signedIn === true && atLogin) router.replace("/");
  }, [atLogin, router, signedIn]);

  if (atLogin ? signedIn === true : signedIn !== true) return null;
  return children;
}

export function DemoLogoutButton({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => writeSession(false)}>로그아웃</button>;
}

export function DemoLogin() {
  const [error, setError] = useState("");
  const help = useRef<HTMLDialogElement>(null);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (fields.get("id") !== demoId || fields.get("password") !== demoPassword) {
      setError(`ID 또는 비밀번호가 맞지 않습니다. 시연 계정: ${demoId} / ${demoPassword}`);
      return;
    }

    if (!writeSession(true)) setError("브라우저 저장소를 사용할 수 없습니다.");
  }

  function openHelp() {
    help.current?.showModal();
  }

  return (
    <main className="demo-login">
      <section className="demo-login-panel" aria-labelledby="demo-login-title">
        <h1 id="demo-login-title">One More Step</h1>
        <p className="demo-login-intro">세일즈보다 한발 앞에서 리드를 선별하고 넘길 곳을 준비합니다.</p>

        <p className="demo-login-notice" id="demo-login-notice">
          테스트 기간에는 시연 계정으로 로그인하세요:<br />
          ID <strong>{demoId}</strong> / PW <strong>{demoPassword}</strong>
        </p>

        <form className="demo-login-form" method="post" aria-describedby="demo-login-notice" onSubmit={signIn}>
          <label htmlFor="demo-login-id">ID</label>
          <input id="demo-login-id" name="id" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          <label htmlFor="demo-login-password">PW</label>
          <input id="demo-login-password" name="password" type="password" autoComplete="current-password" required />
          {error && <p className="demo-login-error" role="alert">{error}</p>}
          <button className="demo-login-submit" type="submit">로그인</button>
        </form>

        <div className="demo-login-help">
          <button type="button" onClick={openHelp}>회원 가입</button>
          <span aria-hidden="true">|</span>
          <button type="button" onClick={openHelp}>비밀번호 찾기</button>
        </div>

        <dialog ref={help} className="demo-login-dialog" aria-labelledby="demo-login-help-title">
          <h2 id="demo-login-help-title">시연 계정 안내</h2>
          <p>현재는 테스트 기간이므로 아래 계정으로 로그인해주세요</p>
          <p>id : {demoId}<br />pw : {demoPassword}</p>
          <form method="dialog"><button className="demo-login-submit" type="submit">닫기</button></form>
        </dialog>
      </section>
    </main>
  );
}
