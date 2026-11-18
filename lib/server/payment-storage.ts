import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PaymentError } from "./slip-verification";
import { allowLocalSlipReuse } from "./local-slip-testing";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";

// Local copies of production data may read old evidence from R2, but new test
// slips must never be written into the production bucket.
function localSlipPath(key: string) {
  const directory = process.env.LOCAL_SLIP_STORAGE_DIR;
  if (!directory) return null;
  if (!allowLocalSlipReuse() || !path.isAbsolute(directory) || !/^evidence\/[a-zA-Z0-9_-]+\.png$/.test(key))
    throw new PaymentError("Local slip storage is not configured safely", 503);
  return path.join(directory, key.slice("evidence/".length));
}

function storage() {
  // Must be a private bucket without a public R2/custom domain.
  const bucket = process.env.PAYMENT_R2_BUCKET_NAME;
  const {
    R2_ENDPOINT: endpoint,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
  } = process.env;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey)
    throw new PaymentError("ระบบจัดเก็บสลิปยังไม่พร้อมใช้งาน", 503);
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function storeSlip(image: Buffer, evidenceId: string) {
  const key = `evidence/${evidenceId}.png`;
  const local = localSlipPath(key);
  if (local) {
    await mkdir(path.dirname(local), { recursive: true, mode: 0o700 });
    try {
      const file = await open(/* turbopackIgnore: true */ local, "wx", 0o600);
      try { await file.writeFile(image); } finally { await file.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return key;
  }
  const { bucket, client } = storage();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: image,
        ContentType: "image/png",
        CacheControl: "private, no-store",
        IfNoneMatch: "*",
      }),
    );
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 412
    )
      throw error;
  }
  return key;
}

export async function readSlip(key: string) {
  const local = localSlipPath(key);
  if (local) {
    try { return new Blob([new Uint8Array(await readFile(/* turbopackIgnore: true */ local))], { type: "image/png" }).stream(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const { bucket, client } = storage();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) throw new PaymentError("ไม่พบรูปสลิป", 404);
  return result.Body.transformToWebStream();
}
