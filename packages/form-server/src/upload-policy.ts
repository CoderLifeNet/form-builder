export function validateUploadBytes(bytes: Buffer, contentType: string, policy: { maxBytes?: number; mediaTypes?: string[] }): void {
 if (bytes.length > (policy.maxBytes ?? 20 * 1024 * 1024)) throw new Error("UPLOAD_POLICY_REJECTED");
 if (policy.mediaTypes?.length && !policy.mediaTypes.includes(contentType)) throw new Error("UPLOAD_POLICY_REJECTED");
 const signatures: Record<string,(bytes:Buffer)=>boolean> = {
  "image/png": value => value.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
  "image/jpeg": value => value.length >= 3 && value[0]===255 && value[1]===216 && value[2]===255,
  "application/pdf": value => value.subarray(0,5).toString()==="%PDF-",
  "text/plain": value => !value.includes(0)
 };
 if (signatures[contentType] && !signatures[contentType](bytes)) throw new Error("UPLOAD_POLICY_REJECTED");
}
