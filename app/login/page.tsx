import { requestLocale } from "@/lib/server/locale";
import { translate, type TranslationKey } from "@/lib/i18n";
import { localizedPath, stripLocale } from "@/lib/locale";
import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icons";
import InstagramBrowserNotice from "@/components/InstagramBrowserNotice";
import PasskeyLogin from "@/components/PasskeyLogin";
import { loginDestination } from "@/lib/login-destination";

function ProviderLogo({ provider }: { provider: "google" | "line" }) {
  return (
    <svg
      className="provider-logo"
      width="24"
      height="24"
      viewBox={provider === "google" ? "0 0 24 24" : "8 8 32 32"}
      aria-hidden="true"
      focusable="false"
    >
      {provider === "google" ? (
        <>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </>
      ) : (
        <path
          fill="currentColor"
          d="M37.113,22.417c0-5.865-5.88-10.637-13.107-10.637s-13.108,4.772-13.108,10.637c0,5.258,4.663,9.662,10.962,10.495c0.427,0.092,1.008,0.282,1.155,0.646c0.132,0.331,0.086,0.85,0.042,1.185c0,0-0.153,0.925-0.187,1.122c-0.057,0.331-0.263,1.296,1.135,0.707c1.399-0.589,7.548-4.445,10.298-7.611h-0.001C36.203,26.879,37.113,24.764,37.113,22.417z M18.875,25.907h-2.604c-0.379,0-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687c0.379,0,0.687,0.308,0.687,0.687v4.521h1.917c0.379,0,0.687,0.308,0.687,0.687C19.562,25.598,19.254,25.907,18.875,25.907z M21.568,25.219c0,0.379-0.308,0.688-0.687,0.688s-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687s0.687,0.308,0.687,0.687V25.219z M27.838,25.219c0,0.297-0.188,0.559-0.47,0.652c-0.071,0.024-0.145,0.036-0.218,0.036c-0.215,0-0.42-0.103-0.549-0.275l-2.669-3.635v3.222c0,0.379-0.308,0.688-0.688,0.688c-0.379,0-0.688-0.308-0.688-0.688V20.01c0-0.296,0.189-0.558,0.47-0.652c0.071-0.024,0.144-0.035,0.218-0.035c0.214,0,0.42,0.103,0.549,0.275l2.67,3.635V20.01c0-0.379,0.309-0.687,0.688-0.687c0.379,0,0.687,0.308,0.687,0.687V25.219z M32.052,21.927c0.379,0,0.688,0.308,0.688,0.688c0,0.379-0.308,0.687-0.688,0.687h-1.917v1.23h1.917c0.379,0,0.688,0.308,0.688,0.687c0,0.379-0.309,0.688-0.688,0.688h-2.604c-0.378,0-0.687-0.308-0.687-0.688v-2.603c0-0.001,0-0.001,0-0.001c0,0,0-0.001,0-0.001v-2.601c0-0.001,0-0.001,0-0.002c0-0.379,0.308-0.687,0.687-0.687h2.604c0.379,0,0.688,0.308,0.688,0.687s-0.308,0.687-0.688,0.687h-1.917v1.23H32.052z"
        />
      )}
    </svg>
  );
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; connected?: string }>;
}) {
  const locale = await requestLocale();
  const t = (key: TranslationKey, values?: readonly unknown[]) => translate(locale, key, values);
  const query = await searchParams;
  const destination = localizedPath(loginDestination(query.callbackUrl), locale);
  if (stripLocale(destination.split(/[?#]/, 1)[0]) === "/demo") redirect(destination);
  if (await auth()) redirect(destination);
  const google = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const line = Boolean(
    process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET,
  );
  return (
    <>
    <InstagramBrowserNotice />
    <div id="content" className="auth-layout">
      <div className="auth-intro">
        <h1> {t("auth.sharedExpenses")} <br />
          <span>{t("auth.settledTogether")}</span>
        </h1>
        <p> {t("auth.intro")} <br /> {t("auth.trackingIntro")} </p>
        <div className="intro-note">
          <Icon name="shield" size={17} /> {t("auth.dedicatedAccount")} </div>
      </div>
      <section className="panel auth-panel">
        <h2>{t("auth.welcome")}</h2>
        <p>{t("auth.chooseAnAccountToContinue")}</p>
        {query.error && (
          <p className="error" role="alert"> {t(query.error === "OAuthAccountNotLinked" ? "connections.loginExisting" : "errors.loginFailed")} </p>
        )}
        {query.connected === "1" && <p className="success" role="status">{t("connections.completed")}</p>}
        <div className="auth-providers">
          <PasskeyLogin destination={destination} />
          {google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: destination });
              }}
            >
              <button
                className="button secondary full-width provider-button"
                type="submit"
              >
                <ProviderLogo provider="google" />
                <span>{t("auth.continueWithGoogle")}</span>
              </button>
            </form>
          )}
          {line && (
            <form
              action={async () => {
                "use server";
                await signIn("line", { redirectTo: destination });
              }}
            >
              <button
                className="button line-button full-width provider-button"
                type="submit"
              >
                <ProviderLogo provider="line" />
                <span>{t("auth.continueWithLINE")}</span>
              </button>
            </form>
          )}
          {!google && !line && (
            <p className="notice"> {t("auth.notConfigured")} </p>
          )}
        </div>
        <p className="auth-fine"> {t("auth.separateAccountNotice")} </p>
      </section>
    </div>
    </>
  );
}
