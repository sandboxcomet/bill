import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icons";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const query = await searchParams;
  const destination =
    query.callbackUrl?.startsWith("/") &&
    !query.callbackUrl.startsWith("//") &&
    !query.callbackUrl.includes("\\")
      ? query.callbackUrl
      : "/";
  if (await auth()) redirect(destination);
  const google = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const line = Boolean(
    process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET,
  );
  return (
    <div id="content" className="auth-layout">
      <div className="auth-intro">
        <h1>
          มื้อดี ๆ กับเพื่อน
          <br />
          <span>จบที่บิลลงตัว.</span>
        </h1>
        <p>
          เข้าสู่ระบบเพื่อบันทึกบิล แชร์ยอดรายคน
          <br />
          และติดตามว่าใครจ่ายแล้วบ้าง
        </p>
        <div className="intro-note">
          <Icon name="shield" size={17} />
          บัญชีสำหรับ WongLao Bill โดยเฉพาะ
        </div>
      </div>
      <section className="panel auth-panel">
        <h2>ยินดีต้อนรับ</h2>
        <p>เลือกบัญชีที่คุณต้องการใช้</p>
        {query.error && (
          <p className="error" role="alert">
            เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้งด้วยบัญชีที่เคยใช้
            หรือกลับมาลองใหม่ภายหลัง
          </p>
        )}
        <div className="auth-providers">
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
                เข้าสู่ระบบด้วย Google
                <Icon name="arrow" size={17} />
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
                เข้าสู่ระบบด้วย LINE
                <Icon name="arrow" size={17} />
              </button>
            </form>
          )}
          {!google && !line && (
            <p className="notice">
              ระบบเข้าสู่ระบบยังไม่ได้ตั้งค่า ผู้ดูแลต้องกำหนด Google หรือ LINE
              OAuth ก่อนเปิดใช้งาน
            </p>
          )}
        </div>
        <p className="auth-fine">
          แอปนี้ใช้บัญชีแยกจาก WongLao เดิม
          การเข้าสู่ระบบครั้งแรกจะสร้างบัญชีใหม่สำหรับบิลของคุณ
        </p>
        <Link href="/new" className="text-link">
          ลองสร้างบิลก่อนเข้าสู่ระบบ
          <Icon name="arrow" size={16} />
        </Link>
      </section>
    </div>
  );
}
