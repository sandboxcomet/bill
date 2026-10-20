import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PaymentError } from "./slip-verification";

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
  const { bucket, client } = storage();
  const key = `evidence/${evidenceId}.png`;
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
  const { bucket, client } = storage();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) throw new PaymentError("ไม่พบรูปสลิป", 404);
  return result.Body.transformToWebStream();
}
