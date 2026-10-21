"use client";
import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { request, jsonBody } from "@/lib/client";
import { Icon } from "@/components/Icons";

type Profile = {
  name: string | null;
  nickname: string | null;
  username: string | null;
  promptPayId: string | null;
};

export default function Settings() {
  const { t, feedback } = useI18n();
  const { data: session, update } = useSession();
  const userId = session?.user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [promptPay, setPromptPay] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    request<{ user: Profile }>("/api/profile")
      .then(({ user }) => {
        if (!active) return;
        setProfile(user);
        setNickname(user.nickname ?? "");
        setPromptPay(user.promptPayId ?? "");
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaveError("");
    setSaved(false);
    const value = nickname.trim();
    const invalidNickname =
      !value || value.length > 40 || /\p{Cc}/u.test(value);
    const invalidPayment =
      (Boolean(promptPay) || Boolean(profile?.promptPayId)) &&
      !/^(0\d{9}|\d{13})$/.test(promptPay);
    setNicknameError(
      invalidNickname ? t("errors.nicknameInvalid") : "",
    );
    setPaymentError(
      invalidPayment ? t("errors.promptPayFormat") : "",
    );
    if (invalidNickname || invalidPayment) return;

    setSaving(true);
    try {
      const { user } = await request<{ user: Profile }>("/api/profile", {
        method: "PATCH",
        ...jsonBody({
          nickname: value,
          ...(promptPay ? { promptPayId: promptPay } : {}),
        }),
      });
      setProfile(user);
      setNickname(user.nickname ?? "");
      setPromptPay(user.promptPayId ?? "");
      await update();
      setSaved(true);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="content" className="settings-page">
      <h1>{t("nav.accountSettings")}</h1>
      <p>{t("settings.description")}</p>
      {loading ? (
        <section className="panel" role="status">
          <p>{t("settings.loadingAccountDetails")}</p>
        </section>
      ) : loadError ? (
        <section className="panel">
          <p className="error" role="alert">
            {feedback(loadError)}
          </p>
          <button
            className="button secondary"
            onClick={() => setAttempt((v) => v + 1)}
          > {t("settings.reloadDetails")} </button>
        </section>
      ) : profile ? (
        <section id="nickname" className="panel">
          <form onSubmit={saveSettings} noValidate aria-busy={saving}>
            <div className="panel-heading">
              <h2>{t("settings.accountDetails")}</h2>
              <Icon name="users" />
            </div>
            <label className="field"><span>{t("account.username")}</span><input readOnly value={profile.username ? `@${profile.username}` : ""} /></label>
            <p className="field-hint">{t("account.usernameImmutableHint")}</p>
            <label className="field">
              <span>{t("settings.yourNickname")}</span>
              <input
                autoComplete="nickname"
                required
                maxLength={40}
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameError("");
                  setSaveError("");
                  setSaved(false);
                }}
                placeholder={t("settings.nicknamePlaceholder")}
                disabled={saving}
                aria-invalid={Boolean(nicknameError)}
                aria-describedby={
                  nicknameError
                    ? "nickname-hint nickname-error"
                    : "nickname-hint"
                }
              />
            </label>
            <p id="nickname-hint" className="field-hint"> {t("settings.nicknameHint")} </p>
            {nicknameError && (
              <p id="nickname-error" className="error" role="alert">
                {feedback(nicknameError)}
              </p>
            )}
            {profile.name && (
              <p className="field-hint">{t("settings.loggedInAccount")} {profile.name}</p>
            )}
            <label className="field">
              <span> {t("settings.promptPayNumber")}{!profile.promptPayId && t("common.optionalNote")}
              </span>
              <input
                inputMode="numeric"
                value={promptPay}
                maxLength={13}
                onChange={(e) => {
                  setPromptPay(e.target.value.replace(/\D/g, ""));
                  setPaymentError("");
                  setSaveError("");
                  setSaved(false);
                }}
                placeholder={t("settings.promptPayHint")}
                disabled={saving}
                aria-invalid={Boolean(paymentError)}
                aria-describedby={
                  paymentError ? "payment-hint payment-error" : "payment-hint"
                }
              />
            </label>
            <p id="payment-hint" className="field-hint"> {t("settings.promptPayChangeHint")} </p>
            {paymentError && (
              <p id="payment-error" className="error" role="alert">
                {feedback(paymentError)}
              </p>
            )}
            <button className="button primary full-width" disabled={saving}>
              {saving ? t("common.saving") : t("settings.saveSettings")}
            </button>
            {saveError && (
              <p className="error" role="alert">
                {feedback(saveError)}
              </p>
            )}
            {saved && (
              <p className="success" role="status"> {t("settings.settingsSaved")} </p>
            )}
          </form>
        </section>
      ) : null}
    </div>
  );
}
